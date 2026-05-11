// Cron-driven: for every client on autopilot whose schedule is due,
// pick the next queued topic and generate + publish a post.
// Triggered hourly by pg_cron; idempotent per client per day.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    // Find clients whose autopilot is due
    const today = new Date();
    const todayDow = today.getUTCDay(); // 0=Sun..6=Sat
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: dueClients } = await admin
      .from("clients")
      .select("id, owner_user_id, brokerage, years_experience, autopilot_day, last_autopublish_at, voice")
      .eq("autopilot_enabled", true)
      .eq("autopilot_day", todayDow)
      .or(`last_autopublish_at.is.null,last_autopublish_at.lt.${sevenDaysAgo}`);

    const results: any[] = [];
    for (const c of dueClients ?? []) {
      try {
        const result = await runForClient(admin, apiKey, c.id);
        results.push({ client_id: c.id, ...result });
      } catch (e: any) {
        results.push({ client_id: c.id, error: e.message ?? String(e) });
      }
    }

    return json({ processed: results.length, results });
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});

async function runForClient(admin: any, apiKey: string, client_id: string) {
  // Pick next queued topic
  const { data: topic } = await admin
    .from("client_topics")
    .select("*")
    .eq("client_id", client_id)
    .eq("status", "queued")
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!topic) return { skipped: "no queued topics" };

  const [{ data: client }, { data: market }] = await Promise.all([
    admin.from("clients").select("*").eq("id", client_id).maybeSingle(),
    admin.from("client_markets").select("*").eq("client_id", client_id).maybeSingle(),
  ]);
  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", client.owner_user_id).maybeSingle();

  const userPrompt = `
Write the blog post.

Agent: ${profile?.full_name ?? "the agent"}
Brokerage: ${client.brokerage ?? "—"}
Primary market: ${market?.primary_city ?? "—"}, ${market?.primary_state ?? "—"}
Voice: ${client.voice ?? "professional and warm"}

Topic: ${topic.title}
Primary keyword: ${topic.primary_keyword ?? "—"}
Secondary keywords: ${(topic.secondary_keywords ?? []).join(", ") || "—"}
Geo scope: ${topic.geo_scope ?? "—"}
Niche: ${topic.niche ?? "—"}
Target word count: ${topic.word_count ?? 900}
H2 outline: ${(topic.h2s ?? []).join(" | ") || "—"}
Talking points: ${(topic.talking_points ?? []).join(" | ") || "—"}

Return JSON: { "title": string, "slug": string (kebab-case), "tag": string, "excerpt": string (140-180 chars), "body": string (markdown) }
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
  const tag = parsed.tag ?? (topic.kind === "geo" ? "Local Discovery" : "Insights");
  const excerpt = parsed.excerpt ?? null;

  const { data: post, error: insErr } = await admin.from("posts").insert({
    client_id,
    topic_id: topic.id,
    title,
    slug,
    body,
    tag,
    excerpt,
    target_keyword: topic.primary_keyword ?? title,
    status: "published",
    published_at: new Date().toISOString(),
  }).select().single();
  if (insErr) throw insErr;

  await admin.from("client_topics").update({ status: "used", used_at: new Date().toISOString() }).eq("id", topic.id);
  await admin.from("clients").update({ last_autopublish_at: new Date().toISOString() }).eq("id", client_id);

  // Auto-replenish if queued count < 4
  const { count: queuedCount } = await admin
    .from("client_topics")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client_id)
    .eq("status", "queued");
  let replenished = false;
  if ((queuedCount ?? 0) < 4) {
    // Fire-and-forget: invoke generate-master-topics with replenish flag via internal HTTP
    try {
      const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-master-topics`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ client_id, count: 15, replenish: true }),
      });
      replenished = true;
    } catch (_) { /* ignore */ }
  }

  return { post_id: post.id, topic_id: topic.id, replenished };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
