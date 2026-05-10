// Admin-only: create a new client account.
// - Creates auth user (or finds existing by email)
// - Ensures profile + client_role + clients row + intake_status row
// - Generates a magic link the admin can share
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, full_name, first_name, last_name, business_name, resend } = await req.json();
    if (!email || typeof email !== "string") {
      return json({ error: "email required" }, 400);
    }
    // Derive first name for email personalization (the {name} token).
    const firstName: string | null =
      (first_name && String(first_name).trim()) ||
      (full_name && String(full_name).trim().split(/\s+/)[0]) ||
      null;

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

    // Find or create auth user
    let userId: string | null = null;
    const { data: existing } = await admin.auth.admin.listUsers();
    const match = existing.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      userId = match.id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: full_name ?? null },
      });
      if (createErr) throw createErr;
      userId = created.user.id;
    }
    if (!userId) throw new Error("failed to resolve user id");

    // Ensure profile (the trigger usually handles this, but be defensive for pre-existing users)
    await admin.from("profiles").upsert(
      { id: userId, email, full_name: full_name ?? null },
      { onConflict: "id" }
    );

    // Ensure client role
    await admin.from("user_roles").insert({ user_id: userId, role: "client" }).select();

    // Ensure clients row
    const { data: existingClient } = await admin
      .from("clients")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    let clientId = existingClient?.id;
    if (!clientId) {
      const { data: newClient, error: clErr } = await admin
        .from("clients")
        .insert({ owner_user_id: userId, business_name: business_name ?? null })
        .select("id")
        .single();
      if (clErr) throw clErr;
      clientId = newClient.id;
    } else if (business_name) {
      await admin.from("clients").update({ business_name }).eq("id", clientId);
    }

    // Ensure intake_status row
    await admin.from("intake_status").upsert(
      { client_id: clientId, current_step: 1 },
      { onConflict: "client_id" }
    );

    // Generate magic link for the client
    const origin = req.headers.get("origin") ?? "";
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/onboarding` },
    });
    if (linkErr) throw linkErr;
    const magicLink = linkData.properties?.action_link ?? null;

    // Send branded intake invite email via send-transactional-email.
    let email_sent = false;
    let email_error: string | null = null;
    if (magicLink) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Forward the admin caller's JWT — the gateway rejects raw service-role keys.
            Authorization: authHeader,
            apikey: anonKey,
          },
          body: JSON.stringify({
            templateName: "client-intake-invite",
            recipientEmail: email,
            idempotencyKey: `intake-invite-${userId}-${resend ? Date.now() : "initial"}`,
            templateData: { name: firstName, magicLink },
          }),
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          email_error = `send-transactional-email ${resp.status}: ${txt}`;
        } else {
          email_sent = true;
        }
      } catch (e: any) {
        email_error = e?.message ?? String(e);
      }
    }

    return json({
      client_id: clientId,
      user_id: userId,
      magic_link: magicLink,
      email_sent,
      email_error,
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
