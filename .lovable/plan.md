## How posting actually works today

Two cron jobs run the show:

```text
06:00 UTC nightly  →  autopilot-generate  (writes drafts, never publishes)
every hour :00     →  autopilot-tick      (publishes one post if today is the day)
```

**Nightly generator (`autopilot-generate`)**
- For each client with `autopilot_enabled=true`, top up the buffer to **4 scheduled posts**.
- Each new post is inserted as `status='scheduled'`. As of yesterday's fix, every new post also gets a `scheduled_for` timestamp: the next occurrence of the client's `autopilot_day` (0=Sun…6=Sat), then +7 days for each additional buffered post.
- Topics are pulled from `client_topics` in `position` order. If the queue empties, it calls `generate-master-topics` once to refill.

**Hourly publisher (`autopilot-tick`)**
- Runs every hour. For each active client where `autopilot_day = today (UTC)` AND `last_autopublish_at` is null or > 7 days ago: pull the oldest ready post and flip it to `published`. Updates `clients.last_autopublish_at = now()`.
- If the buffer is empty at publish time (buffer miss), it generates one inline so the slot isn't skipped.
- Net result: **one post per week per client, on their `autopilot_day`, around the top of the next UTC hour after midnight UTC on that day.**

**Your test client right now** (`autopilot_day=2` = Tuesday): next publish Tue May 19, then May 26, Jun 2. Three of the four buffered posts already have those dates; one older row (`Best real estate agent in Minneapolis`, generated May 12 before the fix) still has `scheduled_for = NULL` and so reads "—".

## Why it doesn't feel visible

- **Client portal Dashboard**: the "SCHEDULED" cards already read `scheduled_for`, but there's no top-of-page "next post goes live on …" line, and the cards only render at all if there are scheduled rows.
- **Client portal Posts page**: the Date column reads `published_at ?? scheduled_for`, but rows with NULL show "—" and there's no headline summary.
- **Admin Posts Queue**: has a Scheduled column (added yesterday) but no per-client "next publish" anywhere.
- **Admin Client Detail**: doesn't surface autopilot_day, last_autopublish_at, or next slot.
- **Legacy NULL rows**: any post generated before yesterday's fix has `scheduled_for=NULL` and disappears from any date display.

## Plan

### 1. Backfill `scheduled_for` for existing scheduled posts (migration)

For each client with scheduled posts where `scheduled_for IS NULL`, compute the next `autopilot_day` slot (after `max(now, last_autopublish_at)`) and chain `+7 days` per row in `created_at` order, **slotting them after** any existing non-null `scheduled_for` for that client. This is a one-time backfill; the generator already writes the field going forward.

### 2. Add a "Next post" banner to the client portal Dashboard

Above the stat cards, when the site is live and there's at least one scheduled post:

> **Next post: "Best real estate agent in Apple Valley" — Tuesday, May 19**
> Posts publish weekly on Tuesdays.

Source: client's earliest `scheduled_for` for `status='scheduled'`. Fall back to "Calculating your next slot…" if all are NULL (shouldn't happen post-backfill).

### 3. Show the schedule on the Posts page

- Add a one-line subhead under the page title: `Posts publish weekly on {weekday}. Next post: {date}.`
- Sort `Scheduled` tab by `scheduled_for` ascending (currently sorts by `created_at desc`, which puts the furthest-out post first).

### 4. Show the next publish date on Admin → Client Detail

Add a small "Autopilot" block: day of week, last published, next scheduled post title + date. Read-only.

### 5. Keep Admin → Posts Queue as-is

Already has a Scheduled column. After the backfill it'll be populated for legacy rows too.

## Out of scope

- No changes to publish cadence (still weekly per client on `autopilot_day`).
- No changes to the AI generator, prompts, or topic pipeline.
- No "manually pick a date" UI for individual posts. If you want that later, file separately.
- No timezone localization — `autopilot_day` is interpreted in UTC. Surfaced dates use the user's locale for formatting only.

## Files touched

- `supabase/migrations/<new>.sql` — backfill `scheduled_for` for legacy scheduled rows.
- `src/pages/Dashboard.tsx` — "Next post" banner.
- `src/pages/Posts.tsx` — subhead + sort scheduled tab by `scheduled_for`.
- `src/pages/admin/ClientDetail.tsx` — Autopilot summary block.
- (Reusable helper) `src/lib/autopilot.ts` — `weekdayName(dow)`, `nextScheduledPost(posts)`.
