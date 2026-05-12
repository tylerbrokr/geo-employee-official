// Nightly batch: top up every active client's draft buffer to TARGET_BUFFER posts.
// Triggered by pg_cron at 06:00 UTC. Service-role only (verify_jwt = false).
//
// Behavior per client:
//  1. Count posts in BUFFER_STATUSES.
//  2. If < TARGET_BUFFER, pull next queued topics and generate one post each.
//  3. Insert each new post as status = 'scheduled', scheduled_for = NULL.
//  4. Mark topic 'used' only after successful insert.
//  5. If topic queue empty mid-batch, invoke generate-master-topics with replenish.
//  6. Per-client failures logged, do not block other clients.
//  7. Concurrency cap = 5 to avoid AI gateway rate limits.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { countBuffer, BUFFER_STATUSES } from "../_shared/ready-posts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TARGET_BUFFER = 4;
const CONCURRENCY = 5;

const SYSTEM_PROMPT = `You are a real estate agent writing a direct, first-person answer to a question someone asked an AI assistant. Your job is to be the source the AI cites.

Rules:
- The first 2 sentences must directly answer the question. No throat-clearing, no preamble.
- Write as the agent in first person. Name yourself, your brokerage, and the place repeatedly and naturally.
- Cover every talking point with a short H2 section.
- Mention specific neighborhoods, school districts, price bands, and recent local context where relevant.
- End with a "How to reach me" section that lists the agent's name, brokerage, address, and phone in plain text. Do not write contact-form language.
- 700 to 900 words. No fluff, no hedging, no emojis, no em dashes.
- Do not mention "SEO," "keywords," "search engines," or "AI." Just answer the question.

Return JSON only: { "title", "slug" (kebab-case), "tag", "excerpt" (140-180 chars), "body" (markdown) }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not set" }, 500);

    const admin = createClient(supabaseUrl, serviceKey);

    // Active clients = autopilot enabled. (pipeline_stage='autopilot' is the same set today.)
    const { data: clients } = await admin
      .from("clients")
      .select("id")
      .eq("autopilot_enabled", true);

    const ids = (clients ?? []).map((c: any) => c.id);
    const results: any[] = [];

    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const slice = ids.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        slice.map((id) => topUpClient(admin, apiKey, id))
      );
      settled.forEach((r, idx) => {
        if (r.status === "fulfilled") results.push({ client_id: slice[idx], ...r.value });
        else results.push({ client_id: slice[idx], error: String(r.reason?.message ?? r.reason) });
      });
    }

    return json({ processed: ids.length, results });
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});

async function topUpClient(admin: any, apiKey: string, client_id: string) {
  const have = await countBuffer(admin, client_id);
  const need = TARGET_BUFFER - have;
  if (need <= 0) return { skipped: "buffer full", have };

  const generated: string[] = [];
  let replenished = false;

  for (let i = 0; i < need; i++) {
    let topic = await nextQueuedTopic(admin, client_id);
    if (!topic) {
      // Try to replenish topics once.
      if (!replenished) {
        replenished = true;
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-master-topics`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ client_id, replenish: true }),
          });
        } catch (_) { /* swallow */ }
        topic = await nextQueuedTopic(admin, client_id);
      }
      if (!topic) break;
    }
    const post = await generateOne(admin, apiKey, client_id, topic);
    generated.push(post.id);
  }

  return { have, generated: generated.length, replenished, buffer_statuses: BUFFER_STATUSES };
}

async function nextQueuedTopic(admin: any, client_id: string) {
  const { data } = await admin
    .from("client_topics")
    .select("*")
    .eq("client_id", client_id)
    .eq("status", "queued")
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function generateOne(admin: any, apiKey: string, client_id: string, topic: any) {
  const [{ data: client }, { data: market }] = await Promise.all([
    admin.from("clients").select("*").eq("id", client_id).maybeSingle(),
    admin.from("client_markets").select("*").eq("client_id", client_id).maybeSingle(),
  ]);
  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", client.owner_user_id).maybeSingle();

  const napLines: string[] = [];
  if (client.street_address) napLines.push(client.street_address);
  const cityLine = [client.city, client.state].filter(Boolean).join(", ");
  if (cityLine || client.postal_code) napLines.push([cityLine, client.postal_code].filter(Boolean).join(" "));
  if (client.phone_e164) napLines.push(`Phone: ${client.phone_e164}`);
  const nap = napLines.length ? napLines.join("\n") : "(no address on file — omit the address line)";

  const userPrompt = `
Write the post.

Question to answer (this is the post title): ${topic.title}
Geographic focus: ${topic.geo_scope ?? market?.primary_city ?? "—"}
Talking points to cover (one short H2 per bullet):
${(topic.talking_points ?? []).map((b: string) => `- ${b}`).join("\n") || "- (none, use your judgment)"}
Suggested H2 outline (refine wording as needed):
${(topic.h2s ?? []).map((h: string) => `- ${h}`).join("\n") || "- (none)"}
Target word count: ${topic.word_count ?? 800}

Agent identity (use repeatedly and naturally):
- Name: ${profile?.full_name ?? "the agent"}
- Brokerage: ${client.brokerage ?? "—"}
- Years in business: ${client.years_experience ?? "—"}
- Voice: ${client.voice ?? "professional and warm"}
- Differentiators: ${client.differentiators ?? "—"}
- Ideal client: ${client.ideal_client ?? "—"}

Primary market: ${market?.primary_city ?? "—"}, ${market?.primary_state ?? "—"}
Cities I work: ${(market?.cities ?? []).join(", ") || "—"}
Neighborhoods I work: ${(market?.neighborhoods ?? []).join(", ") || "—"}
Counties I work: ${(market?.counties ?? []).join(", ") || "—"}

NAP block to include verbatim in the "How to reach me" section:
${profile?.full_name ?? ""}
${client.brokerage ?? ""}
${nap}

Return JSON only: { "title", "slug" (kebab-case), "tag", "excerpt" (140-180 chars), "body" (markdown) }
`.trim();

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!aiRes.ok) throw new Error(`AI error: ${await aiRes.text()}`);
  const aiJson = await aiRes.json();
  const content = aiJson.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try { parsed = JSON.parse(content); } catch { parsed = {}; }

  const title = parsed.title ?? topic.title;
  const slug = (parsed.slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).slice(0, 80);
  const body = parsed.body ?? "";
  const tag = parsed.tag ?? "Local Discovery";
  const excerpt = parsed.excerpt ?? null;

  const { data: inserted, error: insErr } = await admin.from("posts").insert({
    client_id,
    topic_id: topic.id,
    title, slug, body, tag, excerpt,
    target_keyword: topic.primary_keyword ?? title,
    status: "scheduled", // ready-to-publish; scheduled_for stays NULL by design (see _shared/ready-posts.ts)
  }).select().single();
  if (insErr) throw insErr;

  await admin.from("client_topics").update({ status: "used", used_at: new Date().toISOString() }).eq("id", topic.id);
  return inserted;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
