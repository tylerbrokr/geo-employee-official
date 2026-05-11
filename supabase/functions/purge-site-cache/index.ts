// Cron-driven: drain pending site_cache_purges by POSTing to the geo-sites
// /api/revalidate webhook.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REVALIDATE_URL = "https://geo-sites.pages.dev/api/revalidate";
const MAX_ATTEMPTS = 5;
const BATCH = 25;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const secret = Deno.env.get("GEO_SITES_REVALIDATE_SECRET");
    if (!secret) return json({ error: "revalidate secret not configured" }, 500);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: rows, error } = await admin
      .from("site_cache_purges")
      .select("id, hostname, paths, attempt_count, status")
      .in("status", ["pending", "failed"])
      .lt("attempt_count", MAX_ATTEMPTS)
      .order("updated_at", { ascending: true })
      .limit(BATCH);
    if (error) throw error;

    const results: any[] = [];
    for (const row of rows ?? []) {
      try {
        const resp = await fetch(REVALIDATE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-revalidate-secret": secret,
          },
          body: JSON.stringify({ hostname: row.hostname, paths: row.paths }),
        });
        if (resp.ok) {
          await admin
            .from("site_cache_purges")
            .update({ status: "success", attempt_count: (row.attempt_count ?? 0) + 1, last_error: null, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          results.push({ id: row.id, ok: true });
        } else {
          const txt = await resp.text().catch(() => "");
          const nextCount = (row.attempt_count ?? 0) + 1;
          const nextStatus = nextCount >= MAX_ATTEMPTS ? "dead" : "failed";
          await admin
            .from("site_cache_purges")
            .update({ status: nextStatus, attempt_count: nextCount, last_error: `${resp.status}: ${txt.slice(0, 500)}`, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          results.push({ id: row.id, ok: false, status: resp.status });
        }
      } catch (e: any) {
        const nextCount = (row.attempt_count ?? 0) + 1;
        const nextStatus = nextCount >= MAX_ATTEMPTS ? "dead" : "failed";
        await admin
          .from("site_cache_purges")
          .update({ status: nextStatus, attempt_count: nextCount, last_error: (e?.message ?? String(e)).slice(0, 500), updated_at: new Date().toISOString() })
          .eq("id", row.id);
        results.push({ id: row.id, ok: false, error: e?.message });
      }
    }

    return json({ processed: results.length, results });
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
