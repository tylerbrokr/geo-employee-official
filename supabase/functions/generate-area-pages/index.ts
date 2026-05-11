// Generates per-area landing pages for a client.
// Walks client_markets (cities, neighborhoods, counties), creates/updates a
// row per area in client_areas, and uses the Lovable AI Gateway to fill the
// intro, market_blurb, FAQs, and meta tags.
//
// Body: { client_id: string, area_id?: string, regenerate_all?: boolean }
//   - area_id: regenerate just one area (ignores stale flag)
//   - regenerate_all: regenerate every area for the client (ignores stale flag)
//   - default: only regenerate areas that are stale or have empty copy
//
// Auth: admin user OR cron (apikey === service role).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "google/gemini-3-flash-preview";
const SUBDOMAIN_HOST = "mygeosite.com";

const STATE_SLUG: Record<string, string> = {
  AL: "al", AK: "ak", AZ: "az", AR: "ar", CA: "ca", CO: "co", CT: "ct", DE: "de",
  FL: "fl", GA: "ga", HI: "hi", ID: "id", IL: "il", IN: "in", IA: "ia", KS: "ks",
  KY: "ky", LA: "la", ME: "me", MD: "md", MA: "ma", MI: "mi", MN: "mn", MS: "ms",
  MO: "mo", MT: "mt", NE: "ne", NV: "nv", NH: "nh", NJ: "nj", NM: "nm", NY: "ny",
  NC: "nc", ND: "nd", OH: "oh", OK: "ok", OR: "or", PA: "pa", RI: "ri", SC: "sc",
  SD: "sd", TN: "tn", TX: "tx", UT: "ut", VT: "vt", VA: "va", WA: "wa", WV: "wv",
  WI: "wi", WY: "wy", DC: "dc",
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function areaSlug(name: string, state: string | null | undefined, areaType: string): string {
  const base = slugify(name);
  const st = state ? (STATE_SLUG[state.toUpperCase()] ?? slugify(state)) : "";
  if (areaType === "neighborhood") return base; // parent city carries the state
  return st ? `${base}-${st}` : base;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const admin = createClient(supabaseUrl, serviceKey);

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
    const oneAreaId: string | undefined = body.area_id;
    const regenAll: boolean = !!body.regenerate_all;
    if (!clientId) return json({ error: "client_id required" }, 400);

    // Load context
    const [{ data: client }, { data: market }, { data: specialties }] = await Promise.all([
      admin.from("clients").select("*").eq("id", clientId).maybeSingle(),
      admin.from("client_markets").select("*").eq("client_id", clientId).maybeSingle(),
      admin.from("client_specialties").select("specialty").eq("client_id", clientId),
    ]);
    if (!client) return json({ error: "client not found" }, 404);

    const { data: profile } = await admin.from("profiles").select("full_name, email").eq("id", client.owner_user_id).maybeSingle();
    const agentName = profile?.full_name?.trim() || profile?.email?.split("@")[0] || "the agent";

    // Build the canonical list of areas from client_markets
    const desired: { name: string; state: string | null; area_type: "city" | "neighborhood" | "county"; parent_name: string | null }[] = [];
    const primaryCity = market?.primary_city ?? null;
    const primaryState = market?.primary_state ?? null;

    if (primaryCity) desired.push({ name: primaryCity, state: primaryState, area_type: "city", parent_name: null });
    for (const c of (market?.cities ?? []) as string[]) {
      if (c && c !== primaryCity) desired.push({ name: c, state: primaryState, area_type: "city", parent_name: null });
    }
    for (const n of (market?.neighborhoods ?? []) as string[]) {
      if (n) desired.push({ name: n, state: primaryState, area_type: "neighborhood", parent_name: primaryCity });
    }
    for (const co of (market?.counties ?? []) as string[]) {
      if (co) desired.push({ name: co, state: primaryState, area_type: "county", parent_name: null });
    }

    // Existing rows
    const { data: existingAreas } = await admin
      .from("client_areas")
      .select("*")
      .eq("client_id", clientId);
    const bySlug = new Map((existingAreas ?? []).map((a: any) => [a.slug, a]));

    // Upsert rows for desired areas (creates missing, no-op on existing)
    for (const d of desired) {
      const slug = areaSlug(d.name, d.state, d.area_type);
      if (bySlug.has(slug)) continue;
      const { data: inserted } = await admin
        .from("client_areas")
        .insert({
          client_id: clientId,
          slug,
          area_type: d.area_type,
          name: d.name,
          state: d.state,
          stale: true,
        })
        .select()
        .single();
      if (inserted) bySlug.set(slug, inserted);
    }

    // Wire neighborhood -> parent city (best-effort match by name)
    for (const d of desired) {
      if (d.area_type !== "neighborhood" || !d.parent_name) continue;
      const slug = areaSlug(d.name, d.state, "neighborhood");
      const parentSlug = areaSlug(d.parent_name, d.state, "city");
      const child = bySlug.get(slug);
      const parent = bySlug.get(parentSlug);
      if (child && parent && child.parent_area_id !== parent.id) {
        await admin.from("client_areas").update({ parent_area_id: parent.id }).eq("id", child.id);
      }
    }

    // Decide which areas to regenerate
    const allAreas = Array.from(bySlug.values());
    let toGen: any[];
    if (oneAreaId) {
      toGen = allAreas.filter((a: any) => a.id === oneAreaId);
    } else if (regenAll) {
      toGen = allAreas;
    } else {
      toGen = allAreas.filter((a: any) => a.stale || !a.intro || !a.market_blurb);
    }

    if (toGen.length === 0) {
      return json({ ok: true, generated: 0, total: allAreas.length });
    }

    // AI generation, one area at a time (keeps prompts focused + costs predictable)
    const specialtyList = (specialties ?? []).map((s: any) => s.specialty);
    let generatedCount = 0;
    const errors: any[] = [];

    for (const area of toGen) {
      const ctx = {
        agent_name: agentName,
        brokerage: client.brokerage,
        years_experience: client.years_experience,
        voice: client.voice,
        differentiators: client.differentiators,
        ideal_client: client.ideal_client,
        property_types: client.property_types,
        specialties: specialtyList,
        primary_city: primaryCity,
        primary_state: primaryState,
        area: { name: area.name, type: area.area_type, state: area.state },
      };

      const systemPrompt = `You write GEO-optimized landing-page copy for real estate agents. The page is /areas/${area.slug} and its only job is to be cited by ChatGPT, Perplexity, and Google AI when someone asks about real estate in ${area.name}.

Voice rules (strict):
- Direct, story-first, professional. Warm but not salesy.
- Short sentences. Periods over commas.
- No hype words: "unlock", "supercharge", "game-changer", "leverage", "passionate".
- No emojis. No em dashes (use periods, commas, or en-dashes).
- Third person. The agent is named, the agent is the subject.
- Mention ${area.name} by name multiple times across the copy. Mention the state too where natural.
- Pull from the agent's specialties, voice, and differentiators where they fit.
- FAQs must be questions a real buyer/seller would type into ChatGPT or Google about ${area.name} real estate.

Return STRICT JSON with these exact keys:
{
  "intro": "string, 1-2 sentences, under 240 chars. Hooks the page. Names ${area.name} and the agent.",
  "market_blurb": "string, 2-3 short paragraphs separated by \n\n. What it's like to buy or sell here, who lives here, what makes the market distinct. Reference price ranges only in vague terms (e.g., 'mid-range' not specific dollars). Mention the agent's relevant specialties.",
  "faqs": [ { "q": "string", "a": "string, 2-4 sentences" }, ... exactly 5 entries ],
  "meta_title": "string, under 60 chars. Format: '${area.name} Real Estate | {Agent Name}' or similar.",
  "meta_description": "string, under 160 chars. Mentions ${area.name} and the agent."
}

No prose, no markdown, no code fences. JSON object only.`;

      const userPrompt = `Context:\n${JSON.stringify(ctx, null, 2)}`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableKey}` },
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
        errors.push({ area_id: area.id, slug: area.slug, status: aiResp.status, detail: txt.slice(0, 200) });
        continue;
      }
      const aiBody = await aiResp.json();
      const content = aiBody.choices?.[0]?.message?.content;
      if (!content) { errors.push({ area_id: area.id, slug: area.slug, error: "no content" }); continue; }

      let gen: any;
      try { gen = JSON.parse(content); } catch { errors.push({ area_id: area.id, slug: area.slug, error: "bad json" }); continue; }

      const update: any = {
        ai_generated_at: new Date().toISOString(),
        ai_model: MODEL,
        stale: false,
      };
      if (typeof gen.intro === "string") update.intro = gen.intro.trim();
      if (typeof gen.market_blurb === "string") update.market_blurb = gen.market_blurb.trim();
      if (Array.isArray(gen.faqs)) {
        update.faqs = gen.faqs.filter((f: any) => f && typeof f.q === "string" && typeof f.a === "string").slice(0, 8);
      }
      if (typeof gen.meta_title === "string") update.meta_title = gen.meta_title.trim();
      if (typeof gen.meta_description === "string") update.meta_description = gen.meta_description.trim();

      const { error: updErr } = await admin.from("client_areas").update(update).eq("id", area.id);
      if (updErr) { errors.push({ area_id: area.id, slug: area.slug, error: updErr.message }); continue; }
      generatedCount++;
    }

    // Enqueue cache purge for areas index + each area we touched
    const { data: site } = await admin
      .from("client_sites")
      .select("subdomain, custom_domain, dns_verified")
      .eq("client_id", clientId)
      .maybeSingle();
    if (site) {
      const hostname = site.dns_verified && site.custom_domain
        ? site.custom_domain
        : site.subdomain ? `${site.subdomain}.${SUBDOMAIN_HOST}` : null;
      if (hostname) {
        const paths = ["/", ...toGen.map((a: any) => `/areas/${a.slug}`)];
        await admin.from("site_cache_purges").insert({
          client_id: clientId,
          hostname,
          paths,
          purge_trigger: "markets_updated",
        });
      }
    }

    return json({ ok: true, generated: generatedCount, total: allAreas.length, errors });
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
