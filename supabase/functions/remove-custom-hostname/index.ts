// Admin-only: delete the Cloudflare custom hostname and clear it from client_sites.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const cfToken = Deno.env.get("CF_API_TOKEN") ?? Deno.env.get("CLOUDFLARE_API_TOKEN");
    const cfZone = Deno.env.get("CLOUDFLARE_ZONE_ID");
    if (!cfToken || !cfZone) return json({ error: "cloudflare not configured" }, 500);

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
    if (!clientId) return json({ error: "client_id required" }, 400);

    const { data: site } = await admin
      .from("client_sites")
      .select("id, cloudflare_hostname_id")
      .eq("client_id", clientId)
      .maybeSingle();
    if (!site) return json({ error: "site not found" }, 404);

    if (site.cloudflare_hostname_id) {
      const cfResp = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZone}/custom_hostnames/${site.cloudflare_hostname_id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${cfToken}` } },
      );
      if (!cfResp.ok && cfResp.status !== 404) {
        const detail = await cfResp.json().catch(() => ({}));
        return json({ error: "cloudflare delete failed", detail }, 502);
      }
    }

    const { error: updErr } = await admin
      .from("client_sites")
      .update({
        custom_domain: null,
        cloudflare_hostname_id: null,
        dns_records: null,
        dns_verified: false,
        ssl_status: null,
        verify_attempts: 0,
        verification_token: null,
      })
      .eq("id", site.id);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
