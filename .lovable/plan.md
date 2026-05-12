# Autonomous post generation + scheduled publishing

Turn the pipeline into a true "AI employee": no admin clicks required after the initial topic list is generated. Two cron jobs do all the work.

## What changes

```text
Today:
  admin clicks "Generate post"  ->  draft created (pending_review)
  admin clicks "Publish"        ->  post goes live
  autopilot-tick (hourly)       ->  generates AND publishes in one shot, only when "due"

Target:
  autopilot-generate (nightly)  ->  tops every client's draft buffer to 4 ready posts
  autopilot-tick (hourly)       ->  if client is due, grabs next ready post and publishes it
  admin                          ->  watches dashboards, intervenes only on errors
```

## 1. New edge function: `autopilot-generate` (nightly batch)

Runs once per night via pg_cron. For every client where `pipeline_stage = 'live'` (or `autopilot_enabled = true`):

1. Count posts in `status IN ('draft','pending_review','scheduled')` for that client.
2. If buffer < 4, pull the next `(4 - buffer)` queued topics and generate one post each, inserting as `status = 'scheduled'` with `scheduled_for = NULL` and `published_at = NULL`.
3. Mark each topic `status = 'used'` only when the post insert succeeds.
4. If the topic queue runs dry, internally invoke `generate-master-topics` with `replenish: true`, then continue.
5. Per-client failures are logged, do not block other clients.
6. Concurrency cap: process up to 5 clients in parallel to avoid AI gateway rate limits.

## 2. Rewrite `autopilot-tick` (hourly publisher)

Stops generating. New behavior per due client:

1. Look for the oldest post matching the canonical "ready to publish" query (see §4).
2. If found: flip to `status = 'published'`, set `published_at = now()`, update `clients.last_autopublish_at`. Done.
3. If none found (buffer miss): generate one post inline as a fallback so the client doesn't miss their slot, then publish it immediately. Log this as a `buffer_miss` event so we can tell if the nightly job is falling behind.
4. Drop the auto-replenish call here — the nightly batch owns that responsibility.

"Due" check stays the same: `autopilot_enabled = true`, `autopilot_day = today_dow`, `last_autopublish_at` null or > 7 days ago.

## 3. Drop the human review gate (per user decision)

- Manual "Generate post" admin button still exists for ad-hoc use, but defaults new posts to `status = 'scheduled'` instead of `pending_review`.
- The admin posts queue keeps both statuses visible so old `pending_review` rows aren't orphaned.
- An admin can still edit any post before its publish slot lands.

## 4. Canonical "ready to publish" query (watch item)

`status = 'scheduled'` here means "next in line, no specific timestamp" — slightly unconventional, since that status normally implies a future `scheduled_for`. To prevent regressions:

- Every "ready to publish" lookup uses exactly: `status IN ('scheduled','pending_review') ORDER BY created_at ASC LIMIT 1`.
- Do NOT add `scheduled_for IS NOT NULL` or `scheduled_for <= now()` to these queries.
- Centralize the query in a tiny shared helper inside `supabase/functions/_shared/` so `autopilot-tick`, `autopilot-generate`, and any future caller use the same definition.
- Add a code comment on the `posts.scheduled_for` column usage explaining: "null = ready on next due tick; non-null = reserved for future explicit scheduling, not used by autopilot today."

## 5. Schedule the new cron job

Add a pg_cron entry for `autopilot-generate` at `0 6 * * *` UTC (≈ overnight US). Created via SQL insert (the schedule SQL contains the project URL + anon key, so it goes through the insert tool, not a migration).

## 6. Admin UI nudges (small, optional)

On `ClientDetail.tsx` Posts tab:
- "Drafts ready: N / 4" badge so admins can see the buffer at a glance.
- "Last autopublish" timestamp + "Next slot: <day>" so it's obvious the system is alive.

Nothing else changes — no new buttons, no review modal.

## Files touched

- `supabase/functions/autopilot-generate/index.ts` — new
- `supabase/functions/_shared/ready-posts.ts` — new (shared "ready to publish" query)
- `supabase/functions/autopilot-tick/index.ts` — strip generation, add publisher logic + buffer_miss fallback
- `supabase/functions/generate-post/index.ts` — default new posts to `scheduled`
- `supabase/config.toml` — register `autopilot-generate` with `verify_jwt = false`
- pg_cron — new nightly schedule (via SQL insert)
- `src/pages/admin/ClientDetail.tsx` — buffer badge + next-slot label

## Out of scope / scaling notes

- **Replenish thundering herd**: if many clients hit an empty topic queue on the same night, `autopilot-generate` will fire several `generate-master-topics` re-enumeration calls in parallel. Fine at 5 concurrent clients today; revisit when scaling past ~50 — likely fix is a per-client lock or a queue.
- Publishing at a specific time of day (currently "any tick on the right weekday wins"). Hour-of-day can be added later via `autopilot_hour` column.
- Per-client overrides for buffer size (hardcoded to 4).
- Notification emails on `buffer_miss` (logged for now, no alerting).
- Backfill: existing clients with no buffer will get topped up on the first nightly run.
