## Goal

Add three high-ROI capabilities to the GEO delivery platform: instant search-engine indexing on every publish, a guided GMB/Zillow/Bing NAP onboarding checklist, and a baseline cadence upgrade from 1x/week to 2x/week for every client (no tiering).

---

### 1. IndexNow on every publish

Notify Bing, Yandex, Seznam, Naver, and Yep the moment a post goes live so it gets crawled in hours, not weeks.

**What ships**
- Shared helper `submitIndexNow(host, key, urls[])` that POSTs to `https://api.indexnow.org/indexnow`.
- A per-site key generated at provision time and stored on `client_sites.indexnow_key`. Renderer serves it at `https://{host}/{key}.txt`.
- Called from:
  - `autopilot-tick` right after a post flips to `published` (post URL + `/blog` + sitemap).
  - The admin "Publish now" action in `PostEditor`.
  - `regenerate-stale-site-copy` when homepage/about copy changes.
- Failures logged, never block publishing.

**Admin surface**
- New line on `VisibilityCard`: "Last IndexNow ping: 2h ago · 5 URLs".

**Going-forward**
- `provision-site` generates the key automatically. Every new client is covered with zero manual work.

---

### 2. GMB / Zillow / Bing Places onboarding checklist

Not automated — a guided in-portal step that makes the agent verify NAP consistency before site goes live. Biggest local-SEO lever we don't currently touch.

**What ships**
- New `nap_checklist` table: `client_id`, `item_key` (`gmb_verified`, `gmb_nap_matches`, `bing_places_claimed`, `zillow_profile_matches`, `realtor_profile_matches`, `facebook_page_matches`), `status` (`pending`/`done`/`skipped`), `completed_at`, `notes`.
- New portal page `/portal/profiles` (admin mirror under `/admin/.../profiles`):
  - Pre-fills each row with the agent's canonical NAP from `clients`.
  - Each item shows: what to check, one-line how-to, link to the provider, "Mark done" toggle.
  - Progress bar in sidebar + on dashboard.
- After `intake_status.completed = true`, the dashboard CTA becomes "Verify your profiles (6 items)" until checklist is ≥ 5/6 done.
- `score-ai-visibility` reads the checklist and adds a "NAP consistency" line item (full at 5/6+, partial at 3/6+, miss otherwise).

**Going-forward**
- Trigger on `clients` insert seeds all 6 checklist rows automatically.

---

### 3. Baseline cadence: 2x/week for every client

Bump the default service from 1 post/week to 2 posts/week. No tiers, no Pro plan, no `publish_cadence` enum. Existing clients are auto-upgraded via backfill.

**Schema**
- Add `clients.autopilot_days smallint[]` (nullable). New source of truth for scheduling.
- Keep existing `clients.autopilot_day` column for backward compat — no longer read by the scheduler.
- Backfill: for every client with `autopilot_day IS NOT NULL`, set `autopilot_days = ARRAY[autopilot_day, ((autopilot_day + 3) % 7)::smallint]` (e.g. Tue=2 → [2,5] Tue/Fri).
- New clients default to `[1, 4]` (Mon/Thu) at insert time.

**Pipeline changes**
- `_shared/ready-posts.ts`: `TARGET_BUFFER` constant → 8 (was 4). ~2.5 weeks of runway at 2x/week.
- `autopilot-tick`:
  - Due-today filter switches from `.eq("autopilot_day", todayDow)` to `autopilot_days @> ARRAY[todayDow]`.
  - "Last published" guard becomes `> 3 days ago` (was 7).
- `_shared/generate-post.ts` next-slot helper: walk forward day-by-day to the next entry in `autopilot_days` instead of always +7.
- `generate-master-topics`: bump replenish batch size proportionally so no client hits an empty queue at the higher cadence.

**Admin UI**
- On `ClientDetail`, replace the single "autopilot day" dropdown with a **Publish days** multi-select (Sun–Sat checkboxes, min 1, max 7). Pre-selects existing `autopilot_days`. No cadence label, no tier copy.
- `VisibilityCard` autopilot line: "autopilot on · Mon/Thu · 8 buffered drafts".
- Dashboard / Posts pages show the day list ("Mon · Thu") instead of a single weekday.

**Going-forward**
- All existing clients are upgraded automatically by the backfill. All new clients default to Mon/Thu. Admins can change the days; nothing else to maintain.

---

### Technical section

**Migrations**
1. `client_sites.indexnow_key text` (unique, generated on provision).
2. `nap_checklist` table + RLS (owner read/write own, admin read/write all) + trigger to seed 6 rows on `clients` insert.
3. `clients.autopilot_days smallint[]`. Backfill from `autopilot_day`. Set new-client default to `{1,4}`.

**New edge function / shared modules**
- `supabase/functions/_shared/indexnow.ts` — `submitIndexNow(host, key, urls[])`.
- `supabase/functions/submit-indexnow/index.ts` — thin debug wrapper for the admin "Re-ping" button.
- Touch: `autopilot-tick`, `autopilot-generate`, `_shared/ready-posts.ts`, `_shared/generate-post.ts`, `score-ai-visibility`, `provision-site`, `regenerate-stale-site-copy`, `generate-master-topics`.

**Renderer handoff (`geo-sites`, separate repo)**
- Add route `/<indexnow_key>.txt` returning the key as plain text from `client_sites.indexnow_key`.
- Document in `docs/renderer-handoff.md` §9.

**Frontend**
- New page `src/pages/portal/Profiles.tsx` + sidebar entry.
- New admin component `src/components/admin/PublishDaysCard.tsx` on `ClientDetail` (replaces the single-day dropdown).
- Extend `VisibilityCard` to show publish-days list + last-IndexNow timestamp.
- Update `useClient`, `src/lib/autopilot.ts`, and `Dashboard`/`Posts` to render day lists.
- `src/integrations/supabase/types.ts` regenerates after migrations — do not hand-edit.

**Order of build**
1. Migrations (indexnow key, checklist, autopilot_days + backfill).
2. IndexNow shared helper + autopilot-tick wiring + provision-site key gen + renderer doc.
3. NAP checklist table seed + portal/admin UI + scorer line item.
4. Cadence: pipeline branches on `autopilot_days` → admin multi-select → dashboard/posts day-list rendering.
5. End-to-end re-run of the visibility scorer on the test client.

**Out of scope (explicit)**
- Google Search Console / sitemap ping (separate item; IndexNow doesn't cover Google).
- GMB/Zillow API automation.
- Any tiered/Pro plan, `publish_cadence` enum, or paid-cadence concept.
