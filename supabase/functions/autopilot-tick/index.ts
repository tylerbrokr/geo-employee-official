// Hourly cron publisher. Does NOT generate; that's autopilot-generate's job.
// For each client whose autopilot day is today and who hasn't published in
// 7 days: pull the oldest ready post (status IN scheduled|pending_review) and
// flip it to published. If buffer is empty (buffer_miss), generate one inline
// as fallback so the slot isn't skipped.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchNextReadyPost } from "../_shared/ready-posts.ts";
import { generateOne } from "../_shared/generate-post.ts";
import { triggerVisibilityScore } from "../_shared/trigger-visibility.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const admin = createClient(supabaseUrl, serviceKey);

    const today = new Date();
    const todayDow = today.getUTCDay();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: dueClients } = await admin
      .from("clients")
      .select("id")
      .eq("autopilot_enabled", true)
      .eq("autopilot_day", todayDow)
      .or(`last_autopublish_at.is.null,last_autopublish_at.lt.${sevenDaysAgo}`);

    const results: any[] = [];
    for (const c of dueClients ?? []) {
      try {
        results.push({ client_id: c.id, ...(await publishForClient(admin, apiKey, c.id)) });
      } catch (e: any) {
        results.push({ client_id: c.id, error: e.message ?? String(e) });
      }
    }
    return json({ processed: results.length, results });
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});

async function publishForClient(admin: any, apiKey: string | undefined, client_id: string) {
  let post = await fetchNextReadyPost(admin, client_id);
  let buffer_miss = false;

  if (!post) {
    // Buffer miss: fall back to inline generation so the publish slot isn't lost.
    buffer_miss = true;
    if (!apiKey) return { error: "buffer empty and LOVABLE_API_KEY not set" };
    const { data: topic } = await admin
      .from("client_topics")
      .select("*")
      .eq("client_id", client_id)
      .eq("status", "queued")
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!topic) {
      console.warn(`[autopilot-tick] buffer_miss + no topics for client=${client_id}`);
      return { skipped: "buffer empty and no topics queued", buffer_miss };
    }
    post = await generateOne(admin, apiKey, client_id, topic);
    console.warn(`[autopilot-tick] buffer_miss for client=${client_id} — generated inline`);
  }

  const nowIso = new Date().toISOString();
  await admin.from("posts").update({ status: "published", published_at: nowIso }).eq("id", post.id);
  await admin.from("clients").update({ last_autopublish_at: nowIso }).eq("id", client_id);
  triggerVisibilityScore(client_id);
  return { published_post_id: post.id, buffer_miss };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
