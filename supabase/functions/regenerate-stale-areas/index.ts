// Cron-driven: scans for client_areas where stale=true and triggers regeneration
// per distinct client_id. The generate-area-pages function already defaults to
// "only regenerate stale or empty" and flips stale=false on success — so we just
// drive it once per client. Batched at 10 distinct clients per tick.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Service-role gate. Allows manual invocation by admins too (their JWT won't
  // match, but cron uses the service key in the apikey header).
  const apiKeyHeader = req.headers.get("apikey") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const tokenFromAuth = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (apiKeyHeader !== serviceKey && tokenFromAuth !== serviceKey) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: stale, error } = await admin
    .from("client_areas")
    .select("client_id")
    .eq("stale", true)
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const distinctClients = Array.from(new Set((stale ?? []).map((r: any) => r.client_id))).slice(0, 10);

  const results: any[] = [];
  for (const clientId of distinctClients) {
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/generate-area-pages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ client_id: clientId }),
      });
      const text = await r.text();
      let payload: any = null;
      try { payload = JSON.parse(text); } catch { payload = text.slice(0, 200); }
      results.push({ client_id: clientId, status: r.status, ok: r.ok, payload });
    } catch (e: any) {
      results.push({ client_id: clientId, error: e?.message ?? String(e) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
