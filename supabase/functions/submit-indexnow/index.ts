// Submit URLs to IndexNow for a client. Callable by any authenticated user who owns
// the client (or admin). Used by the PostEditor "Publish" action and the autopilot tick.
//
// Body: { client_id: string, paths?: string[], slug?: string }
//   - If `slug` is provided, defaults to [/blog/{slug}, /blog, /sitemap.xml].
//   - If `paths` is provided, those paths are used instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { submitIndexNow, publishPaths } from "../_shared/indexnow.ts";

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
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    const body = await req.json().catch(() => ({}));
    const client_id: string | undefined = body.client_id;
    if (!client_id) return json({ error: "client_id required" }, 400);

    // Auth: must own client or be admin (skip when called with service-role internally).
    const admin = createClient(supabaseUrl, serviceKey);
    const isInternal = authHeader.includes(serviceKey);
    if (!isInternal) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "unauthorized" }, 401);
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = roles?.some((r: any) => r.role === "admin");
      if (!isAdmin) {
        const { data: ok } = await admin.rpc("owns_client", { _user_id: user.id, _client_id: client_id });
        if (!ok) return json({ error: "forbidden" }, 403);
      }
    }

    const paths: string[] = Array.isArray(body.paths) && body.paths.length
      ? body.paths
      : body.slug
      ? publishPaths(String(body.slug))
      : ["/", "/blog", "/sitemap.xml"];

    const result = await submitIndexNow(admin, client_id, paths);
    return json(result, result.ok ? 200 : 200);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
