// Cron-driven (every 15 min): poll Cloudflare for DNS + SSL status on pending custom hostnames.
// Optionally accepts { client_id } in body to recheck a single row immediately.
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
    const cfToken = Deno.env.get("CF_API_TOKEN") ?? Deno.env.get("CLOUDFLARE_API_TOKEN");
    const cfZone = Deno.env.get("CLOUDFLARE_ZONE_ID");
    if (!cfToken || !cfZone) return json({ error: "cloudflare not configured" }, 500);

    const admin = createClient(supabaseUrl, serviceKey);

    let body: any = {};
    if (req.method === "POST") body = await req.json().catch(() => ({}));
    const onlyClientId: string | undefined = body.client_id;

    let q = admin
      .from("client_sites")
      .select("id, client_id, custom_domain, cloudflare_hostname_id, dns_verified, ssl_status, verify_attempts, dns_records, subdomain")
      .not("cloudflare_hostname_id", "is", null);
    if (onlyClientId) q = q.eq("client_id", onlyClientId);
    else q = q.eq("dns_verified", false);

    const { data: rows, error } = await q;
    if (error) throw error;

    const results: any[] = [];
    for (const row of rows ?? []) {
      results.push(await checkOne(row, cfToken, cfZone, admin));
    }
    return json({ checked: results.length, results });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

async function checkOne(row: any, cfToken: string, cfZone: string, admin: any) {
  const cfResp = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${cfZone}/custom_hostnames/${row.cloudflare_hostname_id}`,
    { headers: { Authorization: `Bearer ${cfToken}` } },
  );

  // Hostname removed at Cloudflare — surface as failed so the UI offers retry.
  if (cfResp.status === 404) {
    await admin.from("client_sites").update({
      cloudflare_hostname_id: null,
      ssl_status: "failed",
      verify_attempts: (row.verify_attempts ?? 0) + 1,
    }).eq("id", row.id);
    return { client_id: row.client_id, ssl_status: "failed", dns_verified: false, gone: true };
  }

  const cfBody = await cfResp.json().catch(() => ({}));
  const result = cfBody?.result ?? {};
  const status: string = result?.status ?? "unknown";

  if (status === "deleted") {
    await admin.from("client_sites").update({
      cloudflare_hostname_id: null,
      ssl_status: "failed",
      verify_attempts: (row.verify_attempts ?? 0) + 1,
    }).eq("id", row.id);
    return { client_id: row.client_id, ssl_status: "failed", dns_verified: false, gone: true };
  }

  if (status === "active") {
    const wasVerified = !!row.dns_verified;
    await admin.from("client_sites").update({
      dns_verified: true,
      ssl_status: "active",
      verify_attempts: (row.verify_attempts ?? 0) + 1,
      last_verified_at: new Date().toISOString(),
    }).eq("id", row.id);

    if (!wasVerified) {
      await admin.from("clients")
        .update({ pipeline_stage: "site_live" })
        .eq("id", row.client_id)
        .eq("pipeline_stage", "in_production");
      await admin.from("site_cache_purges").insert({
        client_id: row.client_id,
        hostname: row.custom_domain,
        paths: ["/"],
        purge_trigger: "manual",
      });
    }
    return { client_id: row.client_id, ssl_status: "active", dns_verified: true };
  }

  // pending_validation, pending_blocked, pending_*, etc — leave verified=false, bump attempts.
  await admin.from("client_sites").update({
    ssl_status: "pending",
    verify_attempts: (row.verify_attempts ?? 0) + 1,
  }).eq("id", row.id);
  return { client_id: row.client_id, ssl_status: "pending", dns_verified: false, raw_status: status };
}
