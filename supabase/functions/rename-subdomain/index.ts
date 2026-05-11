// Admin-only: rename a client's subdomain.
// Validates the slug, ensures uniqueness, swaps it, and enqueues a cache purge
// for both the old and new hostnames. Plain subdomains are served via the
// *.mygeosite.com wildcard, so no Cloudflare changes are required here.
//
// Body: { client_id: string, new_subdomain: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUBDOMAIN_HOST = "mygeosite.com";
const RESERVED = new Set(["www", "api", "admin", "app", "site", "blog", "test", "staging", "preview"]);

function validSlug(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "admin")) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const clientId: string | undefined = body.client_id;
    const newSub: string | undefined = body.new_subdomain;
    if (!clientId || !newSub) return json({ error: "client_id and new_subdomain required" }, 400);

    const slug = String(newSub).trim().toLowerCase();
    if (!validSlug(slug)) return json({ error: "invalid subdomain (lowercase, a-z 0-9 hyphens, 2-40 chars)" }, 400);
    if (RESERVED.has(slug)) return json({ error: "that subdomain is reserved" }, 400);

    const { data: site } = await admin
      .from("client_sites")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();
    if (!site) return json({ error: "site not provisioned yet" }, 404);
    if (site.subdomain === slug) return json({ ok: true, subdomain: slug, unchanged: true });

    const { data: clash } = await admin
      .from("client_sites")
      .select("id")
      .eq("subdomain", slug)
      .maybeSingle();
    if (clash) return json({ error: "that subdomain is already taken" }, 409);

    const oldSub = site.subdomain;
    const { error: updErr } = await admin
      .from("client_sites")
      .update({ subdomain: slug })
      .eq("id", site.id);
    if (updErr) return json({ error: updErr.message }, 500);

    // Enqueue purges for both hostnames so caches catch up.
    const purges: any[] = [];
    if (oldSub) {
      purges.push({
        client_id: clientId,
        hostname: `${oldSub}.${SUBDOMAIN_HOST}`,
        paths: ["/"],
        purge_trigger: "manual",
      });
    }
    purges.push({
      client_id: clientId,
      hostname: `${slug}.${SUBDOMAIN_HOST}`,
      paths: ["/"],
      purge_trigger: "manual",
    });
    await admin.from("site_cache_purges").insert(purges);

    return json({
      ok: true,
      old_subdomain: oldSub,
      subdomain: slug,
      url: `https://${slug}.${SUBDOMAIN_HOST}`,
    });
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
