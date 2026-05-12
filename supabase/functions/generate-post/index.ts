// Admin-only: generate a single GEO blog post draft for a client from the next queued topic.
// Body: { client_id: string }
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

Return JSON only: { "title": string, "slug": string (kebab-case), "tag": string, "excerpt": string (140-180 chars), "body": string (markdown) }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id } = await req.json();
    if (!client_id) return json({ error: "client_id required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "admin")) return json({ error: "forbidden" }, 403);

    const [{ data: client }, { data: market }, { data: topic }] = await Promise.all([
      admin.from("clients").select("*").eq("id", client_id).maybeSingle(),
      admin.from("client_markets").select("*").eq("client_id", client_id).maybeSingle(),
      admin.from("client_topics").select("*").eq("client_id", client_id).eq("status", "queued").order("position", { ascending: true }).limit(1).maybeSingle(),
    ]);
    if (!client) return json({ error: "client not found" }, 404);
    if (!topic) return json({ error: "no queued topics — click Generate Master Topics first" }, 400);

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", client.owner_user_id).maybeSingle();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not set" }, 500);

    const userPrompt = buildUserPrompt({ topic, client, market, profile });

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
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return json({ error: "AI gateway error", detail: txt }, 502);
    }
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
      client_id, topic_id: topic.id, title, slug, body, tag, excerpt,
      target_keyword: topic.primary_keyword ?? title,
      // Default to 'scheduled' so it joins the autopilot publish queue automatically.
      // Admin can edit before its slot lands. See supabase/functions/_shared/ready-posts.ts.
      status: "scheduled",
    }).select().single();
    if (insErr) throw insErr;

    return json({ post: inserted });
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});

function buildUserPrompt({ topic, client, market, profile }: any): string {
  const napLines: string[] = [];
  if (client.street_address) napLines.push(client.street_address);
  const cityLine = [client.city, client.state].filter(Boolean).join(", ");
  if (cityLine || client.postal_code) napLines.push([cityLine, client.postal_code].filter(Boolean).join(" "));
  if (client.phone_e164) napLines.push(`Phone: ${client.phone_e164}`);
  const nap = napLines.length ? napLines.join("\n") : "(no address on file — omit the address line)";

  return `
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
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
