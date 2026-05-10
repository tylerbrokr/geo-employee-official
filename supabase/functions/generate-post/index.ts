// Generate a GEO-optimized blog post draft for a client.
// Admin-only: requires authenticated admin caller.
// Body: { client_id: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are an expert SEO/GEO content writer for U.S. real estate agents.
Write a single blog post optimized for Generative Engine Optimization (GEO) — meaning it should:
- Directly answer a likely search query in the first 2 sentences
- Use clear H2/H3 structure with question-style headings
- Include named entities (city, neighborhood, county, brokerage, agent name) frequently and naturally
- Be factual, conversational, and ~700-900 words
- End with a "Why work with [agent name]" section and a single-line CTA
Output JSON only.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id } = await req.json();
    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Verify caller is admin using their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load client + market + specialties + profile
    const [{ data: client }, { data: market }, { data: spec }] = await Promise.all([
      admin.from("clients").select("*").eq("id", client_id).maybeSingle(),
      admin.from("client_markets").select("*").eq("client_id", client_id).maybeSingle(),
      admin.from("client_specialties").select("specialty").eq("client_id", client_id),
    ]);
    if (!client) {
      return new Response(JSON.stringify({ error: "client not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", client.owner_user_id).maybeSingle();

    const specialties = (spec ?? []).map((s: any) => s.specialty);
    const cities: string[] = market?.cities ?? [];
    const neighborhoods: string[] = market?.neighborhoods ?? [];

    // Pick a target combo
    const targets = [
      ...cities.map((c) => ({ kind: "city", area: c })),
      ...neighborhoods.map((n) => ({ kind: "neighborhood", area: n })),
      ...(market?.primary_city ? [{ kind: "city", area: market.primary_city }] : []),
    ];
    const target = targets[Math.floor(Math.random() * Math.max(1, targets.length))] ?? { kind: "city", area: market?.primary_city ?? "your area" };
    const angle = specialties[Math.floor(Math.random() * Math.max(1, specialties.length))] ?? null;

    const userPrompt = `
Write a blog post for this real estate agent:
- Agent: ${profile?.full_name ?? "the agent"}
- Brokerage: ${client.brokerage ?? "their brokerage"}
- Years experience: ${client.years_experience ?? "experienced"}
- Primary market: ${market?.primary_city ?? ""}, ${market?.primary_state ?? ""}
- Target ${target.kind}: ${target.area}
${angle ? `- Specialty angle: ${angle}` : ""}

Return JSON: { "title": string, "slug": string (kebab-case), "tag": string, "target_keyword": string, "body": string (markdown) }
`.trim();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ error: "AI gateway error", detail: txt }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const title = parsed.title ?? `Best realtor in ${target.area}`;
    const slug = (parsed.slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).slice(0, 80);
    const body = parsed.body ?? "";
    const tag = parsed.tag ?? (target.kind === "neighborhood" ? "Neighborhood" : "Local Discovery");
    const target_keyword = parsed.target_keyword ?? `${title}`;

    const { data: inserted, error: insErr } = await admin.from("posts").insert({
      client_id, title, slug, body, tag, target_keyword, status: "pending_review",
    }).select().single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ post: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
