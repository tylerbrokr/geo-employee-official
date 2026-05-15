// Helpers for surfacing autopilot publish schedule in the UI.

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayName(dow: number | null | undefined): string | null {
  if (dow === null || dow === undefined) return null;
  return WEEKDAYS[dow] ?? null;
}

export function nextScheduledPost<T extends { status: string; scheduled_for: string | null }>(
  posts: T[]
): T | null {
  const now = Date.now();
  const upcoming = posts
    .filter((p) => p.status === "scheduled" && p.scheduled_for)
    .filter((p) => new Date(p.scheduled_for!).getTime() >= now - 60 * 60 * 1000)
    .sort((a, b) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime());
  return upcoming[0] ?? null;
}

export function formatPublishDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
