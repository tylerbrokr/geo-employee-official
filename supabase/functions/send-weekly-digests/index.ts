// Sends the weekly GEO report digest to every client with autopilot_enabled = true.
// Per-client: pulls posts published in the last 7 days, latest AI visibility score,
// and any pending NAP checklist items, then invokes send-transactional-email with
// an idempotency key derived from the Monday-of-week date.
//
// Intended trigger: Mondays 09:00 UTC via pg_cron. Until Phase 2 lands the
// scheduled_for fix in autopilot-tick, the cron should NOT be enabled — this
// function exists for manual admin invocation in the meantime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Human-readable labels for known nap_checklist.item_key values.
const NAP_LABELS: Record<string, string> = {
  gmb_verified: "Google Business Profile verified",
  gmb_nap_matches: "Google Business Profile NAP matches site",
  bing_places_claimed: "Bing Places claimed",
  zillow_profile_matches: "Zillow profile matches NAP",
  realtor_profile_matches: "Realtor.com profile matches NAP",
  facebook_page_matches: "Facebook Page matches NAP",
};

function mondayOfThisWeekUTC(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
  const delta = (dow + 6) % 7; // distance back to Monday
  d.setUTCDate(d.getUTCDate() - delta);
  return d;
}

function formatWeekOf(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function firstName(full: string | null | undefined): string | undefined {
  if (!full) return undefined;
  const trimmed = full.trim().split(/\s+/)[0];
  return trimmed || undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const dryRun = body?.dry_run === true;
  const onlyClientId: string | undefined = body?.client_id;

  const monday = mondayOfThisWeekUTC();
  const mondayIso = monday.toISOString().slice(0, 10); // YYYY-MM-DD
  const weekOf = formatWeekOf(monday);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch eligible clients
  let q = admin
    .from("clients")
    .select("id, owner_user_id, autopilot_enabled")
    .eq("autopilot_enabled", true);
  if (onlyClientId) q = q.eq("id", onlyClientId);
  const { data: clients, error: clientsErr } = await q;
  if (clientsErr) {
    return new Response(JSON.stringify({ error: clientsErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  let sent = 0, skipped = 0, failed = 0;

  for (const c of clients ?? []) {
    try {
      // profile (email + name)
      const { data: profile } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", c.owner_user_id)
        .maybeSingle();

      if (!profile?.email) {
        skipped++;
        results.push({ client_id: c.id, status: "skipped", reason: "no_email" });
        continue;
      }

      // Posts (last 7 days)
      const { data: posts } = await admin
        .from("posts")
        .select("title, slug, published_at")
        .eq("client_id", c.id)
        .eq("status", "published")
        .gte("published_at", sevenDaysAgo)
        .order("published_at", { ascending: false });

      // Latest visibility report
      const { data: report } = await admin
        .from("client_visibility_reports")
        .select("total_score")
        .eq("client_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Pending NAP items
      const { data: napRows } = await admin
        .from("nap_checklist")
        .select("item_key")
        .eq("client_id", c.id)
        .neq("status", "done");
      const pendingNapItems = (napRows ?? [])
        .map((r: any) => NAP_LABELS[r.item_key] ?? r.item_key)
        .filter(Boolean);

      // Site URL (custom domain if verified, else subdomain)
      const { data: site } = await admin
        .from("client_sites")
        .select("subdomain, custom_domain, dns_verified")
        .eq("client_id", c.id)
        .maybeSingle();
      let siteUrl: string | undefined;
      if (site?.dns_verified && site.custom_domain) siteUrl = site.custom_domain;
      else if (site?.subdomain) siteUrl = `${site.subdomain}.mygeosite.com`;

      const templateData = {
        firstName: firstName(profile.full_name),
        weekOf,
        posts: (posts ?? []).map((p: any) => ({ title: p.title, slug: p.slug })),
        siteUrl: siteUrl ?? "",
        visibilityScore: report?.total_score ?? null,
        pendingNapItems,
        portalUrl: "https://www.geoemployee.com/dashboard",
      };

      if (dryRun) {
        results.push({ client_id: c.id, status: "dry_run", recipient: profile.email, templateData });
        continue;
      }

      const idempotencyKey = `weekly-digest-${c.id}-${mondayIso}`;
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          templateName: "weekly-client-digest",
          recipientEmail: profile.email,
          idempotencyKey,
          templateData,
        }),
      });
      const respJson: any = await resp.json().catch(() => ({}));
      if (!resp.ok || respJson?.error) {
        failed++;
        results.push({ client_id: c.id, status: "failed", recipient: profile.email, error: respJson?.error ?? `http ${resp.status}` });
      } else {
        sent++;
        results.push({ client_id: c.id, status: "sent", recipient: profile.email, provider_id: respJson?.provider_id ?? null });
      }
    } catch (e: any) {
      failed++;
      results.push({ client_id: c.id, status: "failed", error: e?.message ?? String(e) });
    }
  }

  return new Response(JSON.stringify({ weekOf, mondayIso, processed: clients?.length ?? 0, sent, skipped, failed, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
