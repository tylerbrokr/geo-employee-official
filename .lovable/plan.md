## Fix admin/client mixup, then ship chunks 3 & 4

### A. Quick cleanup (admin showing as client)
- Delete the stray `clients` row owned by your admin user.
- Update `handle_new_user()` trigger: only auto-insert into `clients` for users with role `client`. Admins won't get a phantom client row.
- Update `/admin` Clients list query to also exclude any user that has the `admin` role (defense in depth).

### B. Chunk 3 — Master Topics generation (admin-driven)
- New edge function `generate-master-topics`:
  - Input: `client_id`
  - Reads client profile + market + specialties + voice/story
  - Calls Lovable AI Gateway (Gemini) with the GEO topic-generation prompt (based on the Claude skill the user shared earlier)
  - Inserts ~30 rows into `client_topics` (mix of `seo` + `geo` kinds, with primary keyword, secondary keywords, talking points, H2s, geo_scope, niche, word_count)
  - Sets `clients.pipeline_stage = 'topics_ready'`
- New admin tab on `ClientDetail` → **Topics**:
  - "Generate Master Topics" button (disabled until `intake_complete`)
  - Editable list: title, primary keyword, status (`queued` / `skipped` / `used`), drag to reorder (`position`)
  - "Add topic" + "Regenerate batch" buttons
  - Auto-replenish hook: when queued count drops below 4, queue a background generation

### C. Chunk 4 — "Go Live" autopilot
- "Go Live" button on `ClientDetail` (enabled when `topics_ready` AND at least 4 queued topics):
  - Sets `autopilot_enabled = true`, `autopilot_day = <today's weekday>`, `autopilot_started_at = now()`, `pipeline_stage = 'autopilot'`
- Edge function `autopilot-tick` (cron, hourly):
  - Finds clients where `autopilot_enabled` AND (`last_autopublish_at` is null OR > 7 days ago) AND today = `autopilot_day`
  - Picks next queued topic by `position`, calls `generate-post` with `topic_id`, sets post status `published`, marks topic `used`, updates `last_autopublish_at`
- Add `pg_cron` schedule in migration to invoke `autopilot-tick` hourly.

### D. Admin UX polish (small)
- Add "New client" button on `/admin` → modal that creates auth user (admin invite via service role in an edge function), inserts profile + client + role, copies magic link to clipboard so you can hand it to the client until email sending is wired up later.

### Out of scope for now
- Email sending (questionnaire link delivery) — deferred until domain/email provider is chosen.
- Vercel/Netlify domain provisioning — `client_sites` schema is ready; we'll wire the actual API calls in a later chunk.
- Reset-intake admin button — skipping per your direction.

### Suggested order
1. A (5 min, unblocks your admin view)
2. D (so you can spin up test client accounts on demand)
3. B (Master Topics — the meaty one)
4. C (Autopilot)

Want me to run all four, or stop after A+D so you can create a real test client first?
