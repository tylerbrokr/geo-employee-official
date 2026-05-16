// Fire-and-forget call to the AI visibility scorer. Never throws.
// Used by provision-site, generate-area-pages, generate-site-copy, autopilot-tick.
export function triggerVisibilityScore(clientId: string): void {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    // Don't await — fire and forget.
    fetch(`${url}/functions/v1/score-ai-visibility`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({ client_id: clientId, internal: true }),
    }).catch(() => {/* swallow */});
  } catch {/* swallow */}
}
