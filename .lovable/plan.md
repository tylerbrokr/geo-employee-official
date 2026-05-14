# Scheduled posts: empty bodies + missing publish dates

## What's wrong

Looking at your test client's 4 scheduled posts:

- 3 of 4 have `body` length **0** (only the title was saved). 1 has a full body.
- All 4 have `scheduled_for = NULL`, so the UI has no date to show.

Two separate bugs.

### Bug 1 — Empty bodies get saved as "scheduled" posts

In `_shared/generate-post.ts`, `generateOne` does:

```ts
let parsed; try { parsed = JSON.parse(content); } catch { parsed = {}; }
const body = parsed.body ?? "";
await admin.from("posts").insert({ ... body, status: "scheduled" });
await admin.from("client_topics").update({ status: "used" }).eq("id", topic.id);
```

When the AI returns malformed JSON or an empty `body` field, we still insert a "scheduled" post with an empty body **and** burn the topic (`status='used'`). The autopilot publisher will eventually publish that empty post.

### Bug 2 — No publish date is ever set

`scheduled_for` is never written. `autopilot-tick` just publishes the oldest ready post on the client's `autopilot_day`. The portal and admin queue have no date to display, so they show `—` and you can't tell when (or whether) a post will go live.

## Fix

### 1. Validate AI output before saving (`supabase/functions/_shared/generate-post.ts`)

In `generateOne`:

- Parse the JSON. If parsing fails, throw — do NOT insert, do NOT mark topic used.
- Require `parsed.body` to be a string of at least ~400 chars and to contain at least one `## ` H2. Otherwise retry the AI call once. If the retry still fails, throw.
- Only after a successful insert, mark the topic `used`.

This means failed generations leave the topic queued so the next autopilot run retries it, and no empty drafts pile up.

### 2. Compute and store `scheduled_for` at insert time

When inserting a new scheduled post, compute the next publish slot for that client:

- Look up the client's `autopilot_day` (0=Sun…6=Sat) and `last_autopublish_at`.
- Find the **latest** `scheduled_for` already on that client's `scheduled` posts.
- Next slot = (latest existing `scheduled_for` OR next occurrence of `autopilot_day` after `last_autopublish_at`/now), then `+ 7 days` for each additional post generated in the same run.
- Store that timestamp in `posts.scheduled_for`.

This is purely a display/scheduling hint. `autopilot-tick` keeps its existing "publish the oldest ready post on autopilot_day" rule, so behavior is backward-compatible — the dates just become visible.

### 3. Show the date in the UI

- `src/pages/Posts.tsx` (client portal): "Date" column already reads `published_at ?? scheduled_for`, so it'll start showing real dates once #2 is in.
- `src/pages/admin/PostsQueue.tsx` (admin): add a "Scheduled" column showing `scheduled_for` for `status='scheduled'` rows. Keep the existing "Created" column.

### 4. One-time cleanup of the existing bad rows

Delete the 3 empty-body scheduled posts for the test client and re-queue their topics so autopilot regenerates them properly. SQL only, run via migration:

```sql
-- requeue topics tied to empty bodies
UPDATE client_topics SET status='queued', used_at=NULL
 WHERE id IN (SELECT topic_id FROM posts WHERE length(body)=0 AND status='scheduled');
DELETE FROM posts WHERE length(body)=0 AND status='scheduled';
```

## Out of scope

- No changes to the AI prompt, model, or third-person voice rules.
- No changes to the publisher cadence (still one post per `autopilot_day`).
- No admin "regenerate this post" button — file separately if you want it.
