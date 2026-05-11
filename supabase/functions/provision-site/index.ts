// Admin-only: provision a client's site row.
// - Generates/ensures a unique subdomain (lives instantly on *.mygeosite.com)
// - If a custom_domain is provided, creates a Cloudflare SaaS Custom Hostname
//   and stores the returned id + the DNS records the agent needs to add.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUBDOMAIN_HOST = "mygeosite.com";
const PAGES_TARGET = "geo-sites.pages.dev";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "site";
}

function isValidDomain(d: string): boolean {
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i.test(d);
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
    const rawCustom: string | undefined = body.custom_domain;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const customDomain = rawCustom ? String(rawCustom).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null;
    if (customDomain && !isValidDomain(customDomain)) {
      return json({ error: "invalid custom_domain" }, 400);
    }

    // Load client + existing site row
    const { data: client } = await admin.from("clients").select("id, business_name").eq("id", clientId).maybeSingle();
    if (!client) return json({ error: "client not found" }, 404);

    const { data: existingSite } = await admin
      .from("client_sites")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    // Resolve subdomain
    let subdomain = existingSite?.subdomain ?? null;
    if (!subdomain) {
      const base = slugify(client.business_name ?? "site");
      let candidate = base;
      let n = 2;
      while (true) {
        const { data: clash } = await admin
          .from("client_sites")
          .select("id")
          .eq("subdomain", candidate)
          .maybeSingle();
        if (!clash) break;
        candidate = `${base}-${n++}`;
        if (n > 200) return json({ error: "could not allocate subdomain" }, 500);
      }
      subdomain = candidate;
    }

    // Cloudflare custom hostname (only when a custom domain is provided)
    let cfHostnameId: string | null = existingSite?.cloudflare_hostname_id ?? null;
    let dnsRecords: any = existingSite?.dns_records ?? null;
    let verificationToken: string | null = existingSite?.verification_token ?? null;

    if (customDomain && customDomain !== existingSite?.custom_domain) {
      const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
      const cfZone = Deno.env.get("CLOUDFLARE_ZONE_ID");
      if (!cfToken || !cfZone) return json({ error: "cloudflare not configured" }, 500);

      const cfResp = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cfZone}/custom_hostnames`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hostname: customDomain,
            ssl: {
              method: "http",
              type: "dv",
              settings: { min_tls_version: "1.2" },
            },
          }),
        },
      );
      const cfBody = await cfResp.json();
      if (!cfResp.ok || cfBody.success === false) {
        return json({ error: "cloudflare error", detail: cfBody }, 502);
      }
      cfHostnameId = cfBody.result?.id ?? null;
      verificationToken = cfBody.result?.ownership_verification?.value ?? crypto.randomUUID();
      dnsRecords = {
        cname: { name: customDomain, value: PAGES_TARGET },
        ownership: cfBody.result?.ownership_verification ?? null,
      };
    }

    const upsertRow: any = {
      client_id: clientId,
      subdomain,
      custom_domain: customDomain,
      cloudflare_hostname_id: cfHostnameId,
      verification_token: verificationToken,
      dns_records: dnsRecords,
      ssl_status: customDomain ? "pending" : null,
      verify_attempts: customDomain && customDomain !== existingSite?.custom_domain ? 0 : (existingSite?.verify_attempts ?? 0),
      provisioned_at: existingSite?.provisioned_at ?? new Date().toISOString(),
      dns_verified: customDomain ? (existingSite?.custom_domain === customDomain ? existingSite?.dns_verified ?? false : false) : true,
    };

    if (existingSite) {
      await admin.from("client_sites").update(upsertRow).eq("id", existingSite.id);
    } else {
      await admin.from("client_sites").insert(upsertRow);
    }

    return json({
      subdomain,
      subdomain_url: `https://${subdomain}.${SUBDOMAIN_HOST}`,
      custom_domain: customDomain,
      dns_records: dnsRecords,
      cloudflare_hostname_id: cfHostnameId,
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
