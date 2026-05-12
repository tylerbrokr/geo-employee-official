// Admin-only: create a Cloudflare for SaaS custom hostname for a client.
// Stores the returned hostname id + DNS records the agent must add.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_CNAME = "customer.mygeosite.com";

function isValidDomain(d: string): boolean {
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i.test(d);
}

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
    const rawDomain: string | undefined = body.custom_domain;
    if (!clientId || !rawDomain) return json({ error: "client_id and custom_domain required" }, 400);

    const customDomain = String(rawDomain).trim().toLowerCase()
      .replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!isValidDomain(customDomain)) return json({ error: "invalid domain format" }, 400);

    const { data: site } = await admin
      .from("client_sites")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();
    if (!site) return json({ error: "site not provisioned — allocate a subdomain first" }, 400);

    if (site.cloudflare_hostname_id && site.custom_domain && site.custom_domain !== customDomain) {
      return json({ error: "another domain is already connected — disconnect it first" }, 409);
    }

    const cfResp = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cfZone}/custom_hostnames`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          hostname: customDomain,
          ssl: { method: "txt", type: "dv", settings: { min_tls_version: "1.2" } },
        }),
      },
    );
    const cfBody = await cfResp.json().catch(() => ({}));
    if (!cfResp.ok || cfBody?.success === false) {
      const detail = cfBody?.errors?.[0]?.message ?? "Cloudflare rejected the request";
      return json({ error: detail, cloudflare: cfBody }, 502);
    }

    const result = cfBody.result ?? {};
    const cnameName = customDomain.startsWith("www.") ? "www" : "@";

    const dnsRecords = {
      cname: { name: cnameName, value: FALLBACK_CNAME },
      ownership_txt: {
        name: result?.ownership_verification?.name ?? null,
        value: result?.ownership_verification?.value ?? null,
      },
    };

    const { error: updErr } = await admin
      .from("client_sites")
      .update({
        custom_domain: customDomain,
        cloudflare_hostname_id: result.id,
        dns_records: dnsRecords,
        dns_verified: false,
        ssl_status: "pending",
        verify_attempts: 0,
        verification_token: result?.ownership_verification?.value ?? null,
      })
      .eq("id", site.id);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({
      custom_domain: customDomain,
      cloudflare_hostname_id: result.id,
      dns_records: dnsRecords,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
