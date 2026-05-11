// Cron-driven: scans for site_copy rows where stale=true and triggers regeneration.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: stale } = await admin
    .from("site_copy")
    .select("client_id")
    .eq("stale", true)
    .limit(20);

  const results: any[] = [];
  for (const row of stale ?? []) {
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/generate-site-copy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ client_id: row.client_id }),
      });
      results.push({ client_id: row.client_id, status: r.status });
    } catch (e: any) {
      results.push({ client_id: row.client_id, error: e.message });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
