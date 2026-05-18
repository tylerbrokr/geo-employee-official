// Canonical "ready to publish" semantics for autopilot.
//
// fetchNextReadyPost returns the oldest `scheduled` post whose `scheduled_for`
// is in the past. Posts in `pending_review` are intentionally excluded — they
// must be promoted to `scheduled` (with a `scheduled_for`) by an admin before
// autopilot will publish them.

// Statuses that count toward the per-client draft buffer (anything not yet published).
export const BUFFER_STATUSES = ["draft", "pending_review", "scheduled"] as const;

export async function fetchNextReadyPost(admin: any, client_id: string) {
  const nowIso = new Date().toISOString();
  const { data } = await admin
    .from("posts")
    .select("*")
    .eq("client_id", client_id)
    .eq("status", "scheduled")
    .not("scheduled_for", "is", null)
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function countBuffer(admin: any, client_id: string): Promise<number> {
  const { count } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client_id)
    .in("status", BUFFER_STATUSES as unknown as string[]);
  return count ?? 0;
}
