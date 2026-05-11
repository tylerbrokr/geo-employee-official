
# Phase 2: Domain provisioning → verification → cache purge

This plan covers the full loop so a new client can go from "no site" to "site live and revalidating on publish" without leaving the dashboard.

## How it fits together

```text
Admin clicks "Provision site"
   └─► provision-site fn
         ├─ write subdomain (lives instantly via wildcard CNAME)
         └─ if custom_domain: create CF Custom Hostname, store id + token
                │
                ▼
Agent sees DNS records on /portal/site
                │
       cron (every 5 min)
                ▼
verify-domains fn  ──► flips dns_verified + ssl_status when CF reports active
                │
                ▼
Admin approves a post → status='published'
                │
       AFTER UPDATE trigger enqueues row in site_cache_purges
                ▼
purge-site-cache fn ──► POST geo-sites /api/revalidate
                │
       cron (every 1 min) sweeps any failed/pending purges
```

Three new edge functions, two cron jobs, two new admin UI sections, one client portal section. No schema changes — Phase 1 Half A migration covers every column.

---

## 1. Subdomain assignment (no Cloudflare call)

The wildcard CNAME `*.geoemployee.com → geo-sites.pages.dev` (one-time DNS, already in place per Phase 1) makes every subdomain live the instant the row exists. No API call, no hostname ID, no polling for subdomains.

- Slug rules: lowercase, hyphenated, strip non-alphanumerics, max 40 chars, append `-2`, `-3` on collision.
- Slug is generated inside `create-client` for new clients and via a one-shot backfill for existing clients.
- Stored as `client_sites.subdomain`. That's the entire subdomain flow.

## 2. Provision flow (`provision-site` edge function)

Admin-only. Body: `{ client_id, custom_domain? }`.

- Insert/update the `client_sites` row: ensure `subdomain` is set.
- **If `custom_domain` provided:**
  - Set `verification_token = crypto.randomUUID()`, `ssl_status = 'pending'`, `verify_attempts = 0`.
  - Call Cloudflare API for SaaS Custom Hostnames: `POST /zones/{zone}/custom_hostnames` with `hostname = custom_domain`, `ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } }`.
  - Store the returned `id` in `cloudflare_hostname_id`.
  - Return the DNS records the agent needs at their registrar (CNAME to `geo-sites.pages.dev`, plus the CF ownership TXT).
- **If no custom_domain:** site is already live at the subdomain — no Cloudflare call.

## 3. Verification + SSL polling (`verify-domains` edge function + cron)

Runs every 5 minutes via `pg_cron`. No JWT.

- Selects `client_sites` where `custom_domain IS NOT NULL AND cloudflare_hostname_id IS NOT NULL AND (dns_verified = false OR ssl_status <> 'active') AND verify_attempts < 60`.
- For each, `GET /zones/{zone}/custom_hostnames/{cloudflare_hostname_id}`.
- Maps CF response → our columns:
  - `ssl.status = 'active'` AND `status = 'active'` → `dns_verified = true, ssl_status = 'active', last_verified_at = now()`. If `clients.pipeline_stage = 'in_production'`, bump to `site_live`.
  - `ssl.status` in `pending_validation | pending_issuance` → `ssl_status = 'pending'`.
  - Anything else after 24h → `ssl_status = 'failed'`.
- `verify_attempts` increments every run.
- On the transition to `dns_verified = true`, enqueue a `site_cache_purges` row with `purge_trigger = 'manual'` and `paths = ['/']` so the public views become visible immediately.

## 4. Cache purge on publish (`purge-site-cache` edge function + triggers + cron)

**a. Trigger on `posts`** — AFTER UPDATE when `OLD.status <> 'published' AND NEW.status = 'published'`. Inserts:
- `hostname` = `client_sites.custom_domain` if `dns_verified` else `subdomain || '.geoemployee.com'`
- `paths` = `['/', '/blog', '/blog/' || NEW.slug]`
- `purge_trigger = 'post_publish'`

**b. Trigger on `client_markets`** — AFTER UPDATE. `paths = ['/', '/areas']`, `purge_trigger = 'markets_updated'`.

**c. The function itself** — cron every 1 minute. Selects `site_cache_purges` where `status IN ('pending','failed') AND attempt_count < 5`, ordered by `updated_at`. For each:
- POST `https://geo-sites.pages.dev/api/revalidate` with header `x-revalidate-secret: $GEO_SITES_REVALIDATE_SECRET` and body `{ hostname, paths }`.
- 2xx → `status = 'success'`. Non-2xx → bump `attempt_count`, store `last_error`, `status = 'failed'`. After 5 attempts → `status = 'dead'`.

## 5. Admin UI

In `src/pages/admin/ClientDetail.tsx`, add a **"Domain"** tab:

- Read-only: subdomain (always present, with live link), custom domain, `dns_verified` badge, `ssl_status` badge, `last_verified_at`.
- Input + button: "Set custom domain" → calls `provision-site`.
- Button: "Re-check now" → invokes `verify-domains` for an immediate single-row run.
- Section: "Recent cache purges" — last 10 rows from `site_cache_purges` with status pills.
- Button: "Purge cache" → manual `site_cache_purges` insert with `paths = ['/']`.

## 6. Client portal UI

Replace the placeholder in `MySite.tsx` with:

- Live URL (subdomain link) as soon as the row exists — agents are live the moment they're provisioned.
- If a custom domain is set and not verified: instruction card with the exact CNAME + TXT records, copy buttons. Voice: "Add these two records at your registrar. We'll detect them within 5 minutes."
- Once `dns_verified = true`: gold dot + "Live at yourdomain.com".

## 7. Secrets to add when we build

- `CLOUDFLARE_API_TOKEN` — Zone:Edit + SSL:Edit on `geoemployee.com`
- `CLOUDFLARE_ZONE_ID` — geoemployee.com zone
- `GEO_SITES_REVALIDATE_SECRET` — same value as the geo-sites Pages project

## What's NOT in this plan

- The four public views — already live in geo-sites per Phase 1.
- Any change to the geo-sites Next.js repo. The `/api/revalidate` contract is already what this targets.
- "Site is live" transactional email — follow-up using the existing email system.

## Migration needed

One small migration:
1. Two `AFTER UPDATE` triggers on `posts` and `client_markets` that insert into `site_cache_purges`.
2. `pg_cron` jobs: `verify-domains` every 5 min, `purge-site-cache` every 1 min.

That migration is step 1 of implementation.
