
# GEO Pipeline — Plan

Reshape the app around the real workflow you described. Three big surfaces:

1. **Admin** drives the pipeline (create client → review intake → generate site → generate topics → go live).
2. **Client portal** is read-only + change requests + the intake wizard (gated by magic link).
3. **Public blog renderer** is one separate multi-tenant app that serves every client's blog from their custom domain.

---

## Pipeline stages (admin-visible status on each client)

```text
draft  →  intake_sent  →  intake_complete  →  site_live  →  topics_ready  →  autopilot
```

Each stage unlocks the next button on the admin Client Detail page.

### Stage 1 — Create client + send intake
- Admin "+ New client" form: name, email.
- Creates `auth.users` (admin API), `profiles`, `clients`, `user_roles=client`, `intake_status=1`.
- Sends a **magic link** (Supabase `signInWithOtp`) to the client's email pointing to `/portal`. First login lands them on `/onboarding`. Status flips to `intake_sent`.

### Stage 2 — Client fills questionnaire
- Existing 5-step wizard, but expanded to capture everything the content-engine skill needs:
  - Voice & values, ideal client profile, areas of expertise, market characteristics, property types, brokerage story, differentiators.
- On final submit → `intake_status.completed_at = now()` → admin sees **intake_complete**.

### Stage 3 — Admin review + Generate site
- Admin Client Detail shows full intake side-by-side with an editable notes field.
- **"Generate Site"** button does:
  1. Insert a `client_sites` row with a chosen subdomain slug + (optional) custom domain.
  2. Call `provision-site` edge function — see Custom Domain section below.
  3. Set `site_status = live`, status → `site_live`.

### Stage 4 — Generate Client Master Topics
- **"Generate Master Topics"** button calls `generate-topics` edge function.
- Function reads client + intake + market + specialties, runs the content-engine skill prompt against Lovable AI Gateway, and inserts ~20 rows into a new `client_topics` table (mix of SEO + GEO topics with all metadata fields from the skill: title, primary_keyword, secondary_keywords[], talking_points[], h2s[], word_count, kind=`seo|geo`, geo_scope, niche, status=`queued`).
- UI: editable table — admin can edit any field, reorder, delete, add manually. Status flips to `topics_ready`.

### Stage 5 — Go Live (autopilot)
- **"Go Live"** button sets `clients.autopilot_enabled = true`, `autopilot_started_at = now()`, picks a weekly publish day/time.
- Cron job (`pg_cron` calling `auto-publish` edge function) runs daily; for each autopilot client whose next publish slot is due:
  1. Pop next `queued` topic.
  2. Call `generate-post` (already exists, expanded to consume topic metadata).
  3. Insert post with `status = published`, `published_at = now()`.
  4. Auto-replenish: if `queued` count < 5, trigger `generate-topics` to add another batch.
- No admin review gate — fully automatic, as you requested. Client and admin both see published posts in their dashboards.

---

## Custom domain + hosting (the multi-tenant approach)

Recommendation: **one Next.js/Astro blog renderer deployed once on Vercel**, not a new deploy per client.

Why: Vercel's per-project domain attach is rate-limited and per-client deploys add an ops burden (build queues, env vars, repo per client). A single multi-tenant renderer is simpler:

- Build a separate small Next.js app (`/blog-renderer`, deployed once to Vercel).
- It reads `Host` header → looks up `client_sites.domain` in Supabase → renders that client's posts.
- For each client, an admin action calls Vercel's API to attach their custom domain to the single project. DNS instructions (A record / CNAME) are shown in the admin UI.
- Domain purchase stays manual on your side (Namecheap/Cloudflare); admin pastes the purchased domain into the client record. Automating purchase is a later add-on.

Required new secrets: `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`.

If you'd rather isolate each client into its own Vercel project, we can revisit — but I'd start multi-tenant.

---

## Database changes

New / updated tables:

- `clients` add: `pipeline_stage` enum, `autopilot_enabled bool`, `autopilot_day smallint` (0–6), `autopilot_started_at`, plus richer intake fields (voice, values, ideal_client, story, differentiators).
- `client_sites` *(new)*: `client_id`, `subdomain`, `custom_domain`, `vercel_domain_id`, `dns_verified bool`, `provisioned_at`.
- `client_topics` *(new)*: id, client_id, kind (`seo`|`geo`), title, primary_keyword, secondary_keywords text[], talking_points text[], h2s text[], geo_scope, niche, word_count, status (`queued`|`used`|`skipped`), position int, used_at, created_at.
- `posts` add: `topic_id` FK, `excerpt`, `cover_image_url`.
- All new tables get RLS using existing `owns_client` / `has_role` helpers.

---

## Edge functions

- `provision-site` (new) — creates Vercel domain, writes DNS instructions to `client_sites`.
- `generate-topics` (new) — admin-only; runs content-engine prompt; inserts `client_topics`.
- `generate-post` (existing, refactor) — accepts a `topic_id`, uses topic metadata in the prompt, returns published post.
- `auto-publish` (new) — cron-triggered; iterates autopilot clients, calls `generate-post`, replenishes topics.
- Schedule via `pg_cron` daily at e.g. 09:00 UTC.

---

## Admin UI changes

- **Client Detail** becomes a stage-driven page: a stepper at the top showing the 5 stages, the active stage's panel below.
- **Topics tab**: editable table with inline edit, drag-to-reorder, add row, regenerate batch.
- **Site tab**: subdomain field, custom domain field, DNS records to share, verification status pill.
- **Autopilot tab**: weekly day picker, "Go Live" / "Pause" toggle, next scheduled post countdown.

## Client portal changes

- Onboarding wizard expanded with the new intake fields.
- Dashboard adds: site URL (when live), next scheduled post date, recent published posts.
- No editing of topics or posts — change requests only (already built).

---

## Build order (small reviewable chunks)

1. Schema migration (clients additions, client_sites, client_topics, posts.topic_id).
2. Expanded intake wizard + admin intake review panel.
3. `generate-topics` edge function + Topics tab UI.
4. `provision-site` + Site tab UI + multi-tenant blog renderer (new mini-app).
5. `auto-publish` cron + Autopilot tab + refactored `generate-post`.
6. Magic-link "Send intake" flow + status stepper polish.

Each chunk ships and is testable on its own. I'd start with #1 + #2 in the next message.

---

## Open items I'm assuming unless you say otherwise

- Magic-link email goes through Supabase's default sender for now; we can swap to a branded sender later (`scaffold_auth_email_templates`).
- Blog renderer is a separate small Next.js app that you'll deploy to Vercel once; I'll generate it inside this repo under `/blog-renderer` so it's all in one place.
- Domain purchase stays manual; we automate Vercel attach + DNS instructions only.
- Topic batch size = 20 per generation (matches the skill's 60-day calendar).
