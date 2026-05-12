// Canonical "ready to publish" semantics for autopilot.
//
// We use post_status = 'scheduled' to mean "next in line, no specific timestamp."
// posts.scheduled_for is intentionally NULL on autopilot drafts. A non-null
// scheduled_for is reserved for a future explicit-time-of-day feature and is
// NOT used by the current autopilot pipeline.
//
// Every caller looking for the next post to publish MUST use this helper (or
// the same status filter) — do not add `scheduled_for IS NOT NULL` filters,
// they will accidentally hide all autopilot drafts.

export const READY_STATUSES = ["scheduled", "pending_review"] as const;

// Statuses that count toward the per-client draft buffer (anything not yet published).
export const BUFFER_STATUSES = ["draft", "pending_review", "scheduled"] as const;

export async function fetchNextReadyPost(admin: any, client_id: string) {
  const { data } = await admin
    .from("posts")
    .select("*")
    .eq("client_id", client_id)
    .in("status", READY_STATUSES as unknown as string[])
    .order("created_at", { ascending: true })
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
