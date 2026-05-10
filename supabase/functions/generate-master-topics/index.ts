// Admin-only: generate ~30 GEO-optimized master topics for a client.
// Body: { client_id: string, count?: number, replenish?: boolean }
// Inserts rows into client_topics with status='queued' and ascending position.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a Generative Engine Optimization (GEO) strategist for U.S. real estate agents.
Your job is to produce a master content plan: a diverse list of blog post topics that will get the agent
surfaced in AI answer engines (ChatGPT, Perplexity, Google AI Overviews) and traditional search.

For each topic, balance these GEO patterns:
- Direct-answer queries ("Is now a good time to buy in <city>?", "What's the average home price in <neighborhood>?")
- Entity-rich local guides ("Best neighborhoods in <city> for <buyer persona>")
- Comparison queries ("<City A> vs <City B>: which is better for first-time buyers?")
- Process explainers tied to the agent's specialties
- Hyper-local landmarks, schools, lifestyle queries

Mix of kinds: ~60% "geo" (location-anchored) and ~40% "seo" (broader real-estate intent).

Return JSON only. No prose outside the JSON.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id, count = 30, replenish = false } = await req.json();
    if (!client_id) return json({ error: "client_id required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    const admin = createClient(supabaseUrl, serviceKey);

    // Allow internal service-role calls (autopilot replenish); otherwise require admin user
    const isServiceRoleCall = authHeader === `Bearer ${serviceKey}`;
    if (!isServiceRoleCall) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "unauthorized" }, 401);
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      if (!roles?.some((r: any) => r.role === "admin")) return json({ error: "forbidden" }, 403);
    }

    const [{ data: client }, { data: market }, { data: spec }] = await Promise.all([
      admin.from("clients").select("*").eq("id", client_id).maybeSingle(),
      admin.from("client_markets").select("*").eq("client_id", client_id).maybeSingle(),
      admin.from("client_specialties").select("specialty").eq("client_id", client_id),
    ]);
    if (!client) return json({ error: "client not found" }, 404);
    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", client.owner_user_id).maybeSingle();

    const specialties = (spec ?? []).map((s: any) => s.specialty);

    const userPrompt = `
Agent: ${profile?.full_name ?? "the agent"}
Brokerage: ${client.brokerage ?? "—"}
Years experience: ${client.years_experience ?? "—"}
Primary market: ${market?.primary_city ?? "—"}, ${market?.primary_state ?? "—"}
Cities: ${(market?.cities ?? []).join(", ") || "—"}
Neighborhoods: ${(market?.neighborhoods ?? []).join(", ") || "—"}
Counties: ${(market?.counties ?? []).join(", ") || "—"}
Specialties: ${specialties.join(", ") || "—"}
Property types: ${(client.property_types ?? []).join(", ") || "—"}
Voice: ${client.voice ?? "—"}
Values: ${client.values_text ?? "—"}
Ideal client: ${client.ideal_client ?? "—"}
Story: ${client.brokerage_story ?? "—"}
Differentiators: ${client.differentiators ?? "—"}

Generate exactly ${count} unique blog topics. Return JSON:
{ "topics": [
  {
    "kind": "geo" | "seo",
    "title": string,                          // headline-style
    "primary_keyword": string,
    "secondary_keywords": string[],           // 2-5 supporting keywords
    "talking_points": string[],               // 3-6 bullets the writer should hit
    "h2s": string[],                          // 4-7 proposed H2 headings (question-style preferred)
    "geo_scope": string | null,               // city/neighborhood/county the topic anchors to (null for non-geo)
    "niche": string | null,                   // specialty angle if any
    "word_count": number                      // target length, 700-1200
  }
] }
`.trim();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not set" }, 500);

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
    try { parsed = JSON.parse(content); } catch { parsed = { topics: [] }; }
    const topics: any[] = Array.isArray(parsed.topics) ? parsed.topics : [];
    if (topics.length === 0) return json({ error: "AI returned no topics" }, 502);

    // Determine starting position
    const { data: maxRow } = await admin
      .from("client_topics")
      .select("position")
      .eq("client_id", client_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const startPos = (maxRow?.position ?? -1) + 1;

    const rows = topics.map((t: any, i: number) => ({
      client_id,
      kind: t.kind === "seo" ? "seo" : "geo",
      title: String(t.title ?? "Untitled").slice(0, 300),
      primary_keyword: t.primary_keyword ?? null,
      secondary_keywords: Array.isArray(t.secondary_keywords) ? t.secondary_keywords : [],
      talking_points: Array.isArray(t.talking_points) ? t.talking_points : [],
      h2s: Array.isArray(t.h2s) ? t.h2s : [],
      geo_scope: t.geo_scope ?? null,
      niche: t.niche ?? null,
      word_count: Number.isFinite(t.word_count) ? Math.min(2000, Math.max(400, Math.round(t.word_count))) : 900,
      status: "queued",
      position: startPos + i,
    }));

    const { data: inserted, error: insErr } = await admin.from("client_topics").insert(rows).select();
    if (insErr) throw insErr;

    if (!replenish) {
      await admin.from("clients").update({ pipeline_stage: "topics_ready" }).eq("id", client_id);
    }

    return json({ count: inserted?.length ?? 0 });
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
