// Nightly batch: top up every active client's draft buffer to TARGET_BUFFER posts.
// Triggered by pg_cron at 06:00 UTC. Service-role only (verify_jwt = false).
//
// Behavior per client:
//  1. Count posts in BUFFER_STATUSES.
//  2. If < TARGET_BUFFER, pull next queued topics and generate one post each.
//  3. Insert each new post as status = 'scheduled', scheduled_for = NULL.
//  4. Mark topic 'used' only after successful insert.
//  5. If topic queue empty mid-batch, invoke generate-master-topics with replenish.
//  6. Per-client failures logged, do not block other clients.
//  7. Concurrency cap = 5 to avoid AI gateway rate limits.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { countBuffer, BUFFER_STATUSES } from "../_shared/ready-posts.ts";
import { generateOne } from "../_shared/generate-post.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Baseline cadence: 2 posts/week, so 8 buffered drafts ≈ 2.5 weeks of runway.
const TARGET_BUFFER = 8;
const CONCURRENCY = 5;


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not set" }, 500);

    const admin = createClient(supabaseUrl, serviceKey);

    // Active clients = autopilot enabled. (pipeline_stage='autopilot' is the same set today.)
    const { data: clients } = await admin
      .from("clients")
      .select("id")
      .eq("autopilot_enabled", true);

    const ids = (clients ?? []).map((c: any) => c.id);
    const results: any[] = [];

    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const slice = ids.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        slice.map((id) => topUpClient(admin, apiKey, id))
      );
      settled.forEach((r, idx) => {
        if (r.status === "fulfilled") results.push({ client_id: slice[idx], ...r.value });
        else results.push({ client_id: slice[idx], error: String(r.reason?.message ?? r.reason) });
      });
    }

    return json({ processed: ids.length, results });
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});

async function topUpClient(admin: any, apiKey: string, client_id: string) {
  const have = await countBuffer(admin, client_id);
  const need = TARGET_BUFFER - have;
  if (need <= 0) return { skipped: "buffer full", have };

  const generated: string[] = [];
  let replenished = false;

  for (let i = 0; i < need; i++) {
    let topic = await nextQueuedTopic(admin, client_id);
    if (!topic) {
      // Try to replenish topics once.
      if (!replenished) {
        replenished = true;
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-master-topics`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ client_id, replenish: true }),
          });
        } catch (_) { /* swallow */ }
        topic = await nextQueuedTopic(admin, client_id);
      }
      if (!topic) break;
    }
    const post = await generateOne(admin, apiKey, client_id, topic);
    generated.push(post.id);
  }

  return { have, generated: generated.length, replenished, buffer_statuses: BUFFER_STATUSES };
}

async function nextQueuedTopic(admin: any, client_id: string) {
  const { data } = await admin
    .from("client_topics")
    .select("*")
    .eq("client_id", client_id)
    .eq("status", "queued")
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
