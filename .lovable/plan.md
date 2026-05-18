
# Phase 1 — Client Retention Signals (Approved)

Two units. Ship 1.1 first, verify, then 1.2.

---

## Unit 1.1 — Stale Area Regeneration Cron

### What to build
New edge function **`regenerate-stale-areas`** (`verify_jwt = false`):
1. Selects up to 10 distinct `client_id`s from `client_areas WHERE stale = true`.
2. For each, invokes `generate-area-pages` with `{ client_id }` using service role headers. That function already defaults to "regenerate only stale or empty" and flips `stale=false` itself.
3. Returns `{ processed, results }`.

### Cron
`pg_cron` + `pg_net`, every 30 minutes, POST to `/functions/v1/regenerate-stale-areas` with service-role `apikey` + `Authorization`. Inserted via SQL (not migration) because it embeds project-specific keys.

### Verification
- Manual invoke → test client's 7 stale areas flip to `stale=false`, `ai_generated_at` updates.
- `cron.job` shows the schedule.

---

## Unit 1.2 — Weekly Client Email Digest

### Recipient scope (decided)
**`autopilot_enabled = true` only.** dns_verified is infra, not billing. Engine off → no "engine published X posts" email.

### Signature (decided)
Personal sign-off: **"— Blake & Tyler"** under the body. Reinforces white-glove DFY tone.

### New React Email template — `weekly-client-digest.tsx`
Location: `supabase/functions/_shared/transactional-email-templates/weekly-client-digest.tsx`.

Props:
- `firstName?: string`
- `weekOf: string` (e.g. "May 11, 2026")
- `posts: { title: string; slug: string }[]`
- `siteUrl: string` (live host, no protocol)
- `visibilityScore?: number`
- `pendingNapItems: string[]` (human-readable labels)
- `portalUrl: string`

Sections in order:
- Eyebrow: "WEEKLY GEO REPORT"
- H1: "Your Inner Cirql GEO report" (Cormorant Garamond)
- Sub: "Week of {weekOf}"
- "Published this week" — count + bulleted list of `title` → `https://{siteUrl}/blog/{slug}`. Empty state: "No posts published this week."
- "AI Visibility score" — large gold number `{score}/100`. Omitted entirely if no report row exists.
- "Action items" — pending NAP labels as a list. Section omitted when empty.
- CTA button: "Open your dashboard" → `portalUrl` (https://www.geoemployee.com/dashboard).
- Signature: "— Blake & Tyler".

Styling per brand bible: white body, Helvetica Neue UI, Cormorant Garamond for the H1, ink (#1a1a1a) text, gold (#c9a96e) accent (score number + CTA only), zero border-radius, hairline ink/8 dividers, no shadows, no emojis, no em dashes.

Subject as function: `Your Inner Cirql GEO report — week of ${weekOf}`. Wait — no em dash. Use en-dash: `Your Inner Cirql GEO report – week of ${weekOf}`.

Register in `registry.ts` under key `weekly-client-digest`.

### Admin-editable copy row
Insert one `email_template_copy` row (via insert tool, not migration) for `template_name = 'weekly-client-digest'`:
- subject: "Your Inner Cirql GEO report – week of {weekOf}" (literal — `{weekOf}` replaced at render time by the subject function, not the DB)
- eyebrow: "WEEKLY GEO REPORT"
- headline: "Your Inner Cirql GEO report"
- body_paragraphs: [] (digest body is data-driven, not copy-driven)
- cta_label: "Open your dashboard"
- signature_line_1: "— Blake & Tyler"
- signature_line_2: "" 

### `/admin/emails` template picker upgrade (included)
The page currently hardcodes `TEMPLATE_NAME = "client-intake-invite"`. Upgrade:
- Load all rows from `email_template_copy` on mount.
- Add a top-of-page dropdown to switch between templates (label = `template_display_name` map or humanized `template_name`).
- Selected template drives the editor + preview + test-send — rest of the page logic stays as-is.

### New scheduled edge function — `send-weekly-digests` (`verify_jwt = false`)
Auth: require `apikey === SUPABASE_SERVICE_ROLE_KEY`.

Per-tick logic:
1. Select clients where `autopilot_enabled = true`.
2. For each, join `profiles` on `owner_user_id = profiles.id` to get email + `full_name`. Skip + log if no email.
3. Query published posts: `status='published' AND published_at >= now() - interval '7 days'` ordered desc, fields `title, slug`.
4. Latest `client_visibility_reports.total_score` for the client (nullable).
5. `nap_checklist WHERE status <> 'done'` → map known item_keys to labels:
   - `gmb_verified` → "Google Business Profile verified"
   - `gmb_nap_matches` → "Google Business Profile NAP matches site"
   - `bing_places_claimed` → "Bing Places claimed"
   - `zillow_profile_matches` → "Zillow profile matches NAP"
   - `realtor_profile_matches` → "Realtor.com profile matches NAP"
   - `facebook_page_matches` → "Facebook Page matches NAP"
6. Resolve `siteUrl` from `client_sites`: `custom_domain` if `dns_verified`, else `{subdomain}.mygeosite.com`. If neither, fall back to the portal URL only.
7. `weekOf` = formatted Monday at 00:00 UTC of the current week.
8. Invoke `send-transactional-email`:
   - `templateName: 'weekly-client-digest'`
   - `recipientEmail: profiles.email`
   - `idempotencyKey: weekly-digest-{client_id}-{YYYY-MM-DD of Monday}` — prevents double sends across retries.
   - `templateData: { firstName, weekOf, posts, siteUrl, visibilityScore, pendingNapItems, portalUrl }`
9. Continue on per-client failures. Return `{ sent, skipped, failed, results }`.

### Cron
`pg_cron` + `pg_net`, `0 9 * * 1` (Mondays 9:00 AM UTC), POST to `/functions/v1/send-weekly-digests` with service-role headers.

### Verification
1. Template + registry deployed → preview renders in `/admin/emails` after picker upgrade.
2. Manual invoke of `send-weekly-digests` → test client receives mail.
3. `email_send_log WHERE template_name='weekly-client-digest'` row with `status='sent'`.
4. `cron.job` row exists.

---

## Sequencing flag (acknowledged)
The digest doubles as a passive uptime monitor — "No posts published this week." surfaces autopilot stalls to clients before Blake/Tyler see them. Net positive, but the engine should be clean first.

**Hard sequence:**
1. Ship + verify Unit 1.1 (stale areas).
2. Ship Phase 2's `scheduled_for` fix in autopilot-tick **before** Unit 1.2's cron is enabled.
3. Insert the `send-weekly-digests` cron row only after Phase 2 ships — until then, the function exists and can be manually invoked, but no automatic Monday send goes out.

I'll flag this again at the end of Unit 1.2 to confirm before turning the Monday cron on.

---

Ready to implement. Approve to start with Unit 1.1.
