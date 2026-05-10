// Admin-only: hard-delete a client and all related rows.
// - Deletes child rows (markets, specialties, intake, topics, sites, posts, change requests)
// - Deletes the clients row
// - Deletes user_roles + profile + auth user for the owner
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id } = await req.json();
    if (!client_id || typeof client_id !== "string") {
      return json({ error: "client_id required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    // Verify admin caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "admin")) return json({ error: "forbidden" }, 403);

    // Look up the client to get owner_user_id
    const { data: client, error: cErr } = await admin
      .from("clients")
      .select("id, owner_user_id")
      .eq("id", client_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!client) return json({ error: "client not found" }, 404);

    const ownerId = client.owner_user_id as string;

    // Refuse to delete admins
    const { data: ownerRoles } = await admin
      .from("user_roles").select("role").eq("user_id", ownerId);
    if (ownerRoles?.some((r: any) => r.role === "admin")) {
      return json({ error: "cannot delete an admin user" }, 400);
    }

    // Delete child rows
    const childTables = [
      "change_requests",
      "client_markets",
      "client_specialties",
      "client_sites",
      "client_topics",
      "intake_status",
      "posts",
    ];
    for (const t of childTables) {
      const { error } = await admin.from(t).delete().eq("client_id", client_id);
      if (error) throw new Error(`${t}: ${error.message}`);
    }

    // Delete client row
    {
      const { error } = await admin.from("clients").delete().eq("id", client_id);
      if (error) throw error;
    }

    // Owner cleanup: roles, profile, auth user
    await admin.from("user_roles").delete().eq("user_id", ownerId);
    await admin.from("profiles").delete().eq("id", ownerId);
    const { error: delUserErr } = await admin.auth.admin.deleteUser(ownerId);
    if (delUserErr) {
      // Non-fatal: report but don't fail the whole delete
      return json({ ok: true, warning: `auth user delete failed: ${delUserErr.message}` });
    }

    return json({ ok: true });
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
