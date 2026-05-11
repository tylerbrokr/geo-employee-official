// Generates AI-curated site copy for a client.
// Reads intake answers, markets, specialties, and agent name.
// Writes to site_copy, refreshes client_sites.agent_display_name, enqueues a cache purge.
//
// Body: { client_id: string, only_field?: string, ignore_manual?: boolean }
// Auth: admin OR cron-invoked (service role via apikey header).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "google/gemini-3-flash-preview";
const SUBDOMAIN_HOST = "mygeosite.com";

const COPY_FIELDS = [
  "tagline",
  "bio_short",
  "bio_long",
  "ideal_client_blurb",
  "area_blurb",
  "meta_title",
  "meta_description",
] as const;

type CopyField = (typeof COPY_FIELDS)[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const admin = createClient(supabaseUrl, serviceKey);

    // Auth: allow if Authorization is admin user OR if apikey === service role (cron)
    const authHeader = req.headers.get("Authorization") ?? "";
    const apiKeyHeader = req.headers.get("apikey") ?? "";
    let allowed = apiKeyHeader === serviceKey;
    if (!allowed && authHeader) {
      const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
        if (roles?.some((r: any) => r.role === "admin")) allowed = true;
      }
    }
    if (!allowed) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const clientId: string | undefined = body.client_id;
    const onlyField: CopyField | undefined = body.only_field;
    const ignoreManual: boolean = !!body.ignore_manual;
    if (!clientId) return json({ error: "client_id required" }, 400);
    if (onlyField && !COPY_FIELDS.includes(onlyField)) return json({ error: "invalid only_field" }, 400);

    // Load context
    const [{ data: client }, { data: markets }, { data: specialties }, { data: existingCopy }] = await Promise.all([
      admin.from("clients").select("*").eq("id", clientId).maybeSingle(),
      admin.from("client_markets").select("*").eq("client_id", clientId).maybeSingle(),
      admin.from("client_specialties").select("specialty").eq("client_id", clientId),
      admin.from("site_copy").select("*").eq("client_id", clientId).maybeSingle(),
    ]);
    if (!client) return json({ error: "client not found" }, 404);

    const { data: profile } = await admin.from("profiles").select("full_name, email").eq("id", client.owner_user_id).maybeSingle();
    const agentName = profile?.full_name?.trim() || profile?.email?.split("@")[0] || "the agent";

    // Refresh agent_display_name on client_sites
    await admin.from("client_sites").update({ agent_display_name: agentName }).eq("client_id", clientId);

    const manuallyEdited = (existingCopy?.manually_edited ?? {}) as Record<string, boolean>;

    // Build prompt context
    const ctx = {
      agent_name: agentName,
      brokerage: client.brokerage,
      business_name: client.business_name,
      years_experience: client.years_experience,
      voice: client.voice,
      values_text: client.values_text,
      ideal_client_raw: client.ideal_client,
      brokerage_story: client.brokerage_story,
      differentiators: client.differentiators,
      property_types: client.property_types,
      primary_city: markets?.primary_city,
      primary_state: markets?.primary_state,
      cities: markets?.cities,
      counties: markets?.counties,
      neighborhoods: markets?.neighborhoods,
      specialties: (specialties ?? []).map((s: any) => s.specialty),
    };

    const fieldsToGenerate = onlyField
      ? [onlyField]
      : COPY_FIELDS.filter((f) => ignoreManual || !manuallyEdited[f]);

    if (fieldsToGenerate.length === 0) {
      return json({ ok: true, generated: [], reason: "all fields manually edited" });
    }

    const fieldSchemas: Record<CopyField, string> = {
      tagline: "string, under 80 chars, one sentence. Sits under the agent's name on the homepage. Specific to their market and approach. No quotes.",
      bio_short: "string, 1-2 sentences, under 240 chars. Third person. Introduces the agent. Story-first, not hype.",
      bio_long: "string, 2-4 short paragraphs separated by \\n\\n. Third person. Tells who they serve, where, how, and why. Pulls from brokerage_story and values. Professional but warm.",
      ideal_client_blurb: "string, 1-2 sentences, under 280 chars. Third person. Reframes ideal_client_raw into clean professional copy. Never quote the raw answer.",
      area_blurb: "string, 1-2 sentences, under 280 chars. Sets up an /areas page. References the primary market and any specialties.",
      meta_title: "string, under 60 chars. Format: '{Agent Name} | {City} Real Estate' or similar. Include primary keyword.",
      meta_description: "string, under 160 chars. Description for search results. Mention agent, market, what they do.",
    };

    const fieldsBlock = fieldsToGenerate.map((f) => `  "${f}": ${fieldSchemas[f]}`).join("\n");

    const systemPrompt = `You write public website copy for real estate agents.

Voice rules (strict):
- Direct, story-first, professional. Warm but not salesy.
- Short sentences. Periods over commas.
- No hype words: "unlock", "supercharge", "game-changer", "leverage", "passionate".
- No emojis. No em dashes (use periods, commas, or en-dashes).
- Never quote the agent's raw intake answers verbatim. Reframe them.
- Third person. The agent is the subject, not the speaker.
- If a field in the input is null/empty, infer reasonably from other context. Do not mention the gap.

Return STRICT JSON with exactly these keys and string values:
{
${fieldsBlock}
}

No prose, no markdown, no code fences. JSON object only.`;

    const userPrompt = `Agent context:\n${JSON.stringify(ctx, null, 2)}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text().catch(() => "");
      return json({ error: "ai gateway error", status: aiResp.status, detail: txt }, 502);
    }
    const aiBody = await aiResp.json();
    const content = aiBody.choices?.[0]?.message?.content;
    if (!content) return json({ error: "no content from ai" }, 502);

    let generated: Record<string, string>;
    try {
      generated = JSON.parse(content);
    } catch {
      return json({ error: "ai returned non-json", raw: content }, 502);
    }

    // Build update
    const update: Record<string, any> = {
      ai_generated_at: new Date().toISOString(),
      ai_model: MODEL,
      stale: false,
    };
    for (const f of fieldsToGenerate) {
      if (typeof generated[f] === "string") update[f] = generated[f].trim();
    }

    if (existingCopy) {
      await admin.from("site_copy").update(update).eq("client_id", clientId);
    } else {
      await admin.from("site_copy").insert({ client_id: clientId, ...update });
    }

    // Enqueue cache purge for the homepage
    const { data: site } = await admin.from("client_sites").select("subdomain, custom_domain, dns_verified").eq("client_id", clientId).maybeSingle();
    if (site) {
      const hostname = site.dns_verified && site.custom_domain
        ? site.custom_domain
        : site.subdomain ? `${site.subdomain}.${SUBDOMAIN_HOST}` : null;
      if (hostname) {
        await admin.from("site_cache_purges").insert({
          client_id: clientId,
          hostname,
          paths: ["/"],
          purge_trigger: "manual",
        });
      }
    }

    return json({ ok: true, generated: fieldsToGenerate, model: MODEL });
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
