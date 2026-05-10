# GEO Sites: Hosting Architecture (v3, build-ready)

One app. Thousands of blog sites. Each one served by hostname from Supabase. No per-client builds, no per-site deploys, no per-site bills.

v3 locks the four open decisions and folds in the last round of review notes: defense-in-depth RLS, purge failure handling, `/areas/[city]` generation strategy, and the Cloudflare for SaaS fallback-origin setup step.

## Locked decisions

1. **Repo:** separate (`geo-sites`), not a second Lovable project. Different deploy cadence, different surface, different runtime.
2. **Subdomain root:** `sites.geoemployee.com`. Wildcard `*.sites.geoemployee.com` → Pages.
3. **Apex strategy:** Option A — www-first. Apex is "advanced" and documented, not blocking onboarding.
4. **Cloudflare account:** dedicated GEO account. Clean billing isolation from Inner Cirql proper.

## The model

```text
                    Client DNS (CNAME to ours)
                                 |
              ┌──────────────────┴──────────────────┐
        agent1.com           agent2.com         agentN.com
              └──────────────────┬──────────────────┘
                                 |
              Cloudflare for SaaS (Custom Hostnames API)
                                 |
                  Pages project: geo-sites (fallback origin)
                                 |
                  Worker middleware: hostname → client_id (KV)
                                 |
              ┌──────────────────┴──────────────────┐
              |                                     |
        Supabase (posts, clients,             Cloudflare KV
        client_sites, client_topics)          (host map + ISR)
```

One shared theme. Customization = content tokens already in the schema. Publishing a post = `UPDATE posts SET status='published'` + targeted cache purge. No build, no redeploy.

## The four systems

### 1. Build — the site app

New repo `geo-sites`. Next.js on Cloudflare Pages via `@cloudflare/next-on-pages`, edge runtime everywhere. Hostname middleware smoke-tested in actual Cloudflare runtime as the last gate of Phase 1; Worker-in-front-of-Pages fallback is the contingency.

Routes:
- `/` — agent landing. Crawler-first: agent name (h1), market line, specialties list, 3 latest posts, JSON-LD `RealEstateAgent` + `LocalBusiness`. No hero image, no headshot. `headshot_url` stays optional, used only on `/about` if at all.
- `/blog` — paginated list
- `/blog/[slug]` — post, JSON-LD `BlogPosting` + `BreadcrumbList`
- `/areas/[city]` — hyperlocal hub (see generation strategy below)
- `/sitemap.xml`, `/robots.txt`, `/feed.xml` — per hostname

**`/areas/[city]` generation strategy (explicit):**
- **SSR on demand at edge**, cached via ISR with 24h revalidate
- First request for `/areas/tampa` on `agent1.com` runs the SSR handler, queries `client_markets.cities` to confirm Tampa is in scope (404 if not), pulls posts tagged for that city, renders, caches
- Cache key: `host + path` (so `agent1.com/areas/tampa` and `agent2.com/areas/tampa` are independent)
- **Purge triggers for area pages:**
  1. `client_markets` row updated → purge `/areas/*` for that hostname
  2. New post published with city tag → purge `/areas/{city}` for that hostname
- Both handled by the same `publish-post` / `markets-updated` edge function family pointing at the purge worker

Hostname resolution (middleware, edge):
1. `host = req.headers.host`
2. KV lookup `host:{host}` → `client_id` (TTL 5 min)
3. Miss → Supabase `client_sites` lookup, write back to KV
4. Pass `client_id` into the page; every query scopes by it

### 2. Publish — content to live (with retry)

1. Admin clicks Publish in `/admin/posts/:id`
2. Edge function `publish-post`:
   - Flips `status`, sets `published_at`
   - Inserts a `site_cache_purges` row (`status = 'pending'`)
   - Calls Cloudflare Cache Purge API for the affected paths (`/`, `/blog`, `/blog/[slug]`, `/sitemap.xml`, `/feed.xml`, plus `/areas/{city}` for any city tags on the post)
   - **Retry: 3 attempts, exponential backoff (1s, 4s, 16s)**
   - On success → `site_cache_purges.status = 'success'`
   - On final failure → `status = 'failed'`, error message stored, post still goes live in DB
3. **pg_cron sweep every 10 min:** retries any `site_cache_purges` row stuck in `failed` for >5 min, max 5 retries before going to `dead`
4. **Admin UI:** posts list shows a small red dot on any post whose latest purge is `failed` or `dead`. Detail page has a "Force re-purge" button.
5. ISR fallback: 60s revalidate (so even if every purge mechanism fails, the page self-heals within a minute)

Click-to-live: <5s normal path. Worst case (all retries + cron + ISR): ~60s.

### 3. Host — Cloudflare Pages

- One Pages project, one deploy
- Free SSL via Cloudflare Custom Hostnames (handled in §4)
- KV for host map + ISR cache state
- R2 for cover images (Phase 3)

### 4. Custom domains — Cloudflare for SaaS

Use **Cloudflare for SaaS Custom Hostnames** (~$0.10/hostname/mo, no cap). API: `POST /zones/{zone_id}/custom_hostnames`. Cloudflare auto-provisions SSL via SNI.

**Critical setup gate (do this first or nothing works):**
Cloudflare for SaaS requires a designated **fallback origin** on the SaaS zone before any custom hostname can be provisioned. Phase 2 day 1 task:
1. In CF dashboard for `geoemployee.com` zone → SSL/TLS → Custom Hostnames → Set fallback origin to the Pages project's `*.pages.dev` URL (or a `sites.geoemployee.com` CNAME pointing to it)
2. Verify with a `curl` against a test hostname before writing any verification code
3. If skipped: every `POST /custom_hostnames` returns success but TLS provisioning silently fails. Hard to debug.

**Apex strategy (Option A, locked):**
- Onboarding instructs client: add `CNAME www → sites.geoemployee.com`
- Apex (`theirdomain.com`) is offered later via help doc: ALIAS/ANAME at registrar if supported, or move nameservers to CF
- We auto-redirect apex→www at the edge once apex is verified

Verification flow (BYO domain):
1. Portal `/portal/my-site/domain`: client enters `www.theirdomain.com`
2. Insert `client_sites` row, generate `verification_token`, show ONE record:
   `CNAME  www  sites.geoemployee.com`
   Plus a TXT for ownership: `TXT _geo-verify <token>`
3. `verify-domain` edge function (pg_cron, every 5 min) — **batched**: process up to 25 pending hostnames per run, oldest-first, 200ms spacing between CF API calls, 429 backoff
4. On success: call `POST /zones/{zone}/custom_hostnames`, store `cloudflare_hostname_id`, set `dns_verified = true`, `ssl_status = 'pending'`
5. Second pass polls `ssl.status` until `active`, then sets `provisioned_at`
6. Portal shows live status via existing `<SiteBuildStatus />`

**Path B (we sell the domain):** CF Registrar API. Phase 3.

## Schema additions

`client_sites` already has `custom_domain`, `subdomain`, `dns_verified`, `dns_records`, `provisioned_at`. Add:

- `verification_token text`
- `cloudflare_hostname_id text`
- `ssl_status text` ('pending' | 'active' | 'failed')
- `last_verified_at timestamptz`
- `verify_attempts integer default 0`
- Drop or repurpose `vercel_domain_id`

New table `site_cache_purges`:
- `id`, `client_id`, `hostname`, `paths text[]`, `trigger text` (post_publish | markets_updated | manual), `requested_by uuid`, `status text` (pending | success | failed | dead), `attempt_count int`, `last_error text`, `created_at`, `updated_at`

## RLS — defense in depth

Public site traffic hits Supabase with the **anon key**. Two layers:

**Layer 1 (database):** narrow anon policies + views. The published-posts policy includes `client_id IS NOT NULL` as a sanity guard. Note: we do not (and cannot easily) constrain *which* client_id the anon key reads at the policy level without per-request session vars — that work is in Layer 2. Acknowledged tradeoff: posts are public anyway, but a query bug could surface Client B's posts under Client A's hostname. We accept this for v1 and mitigate with Layer 2 + tests.

```sql
create policy "Public read published posts"
on public.posts for select to anon
using (status = 'published' and client_id is not null);
```

Plus public-safe views (anon SELECT on view, never the table):
- `public.public_client_profile` → `id, business_name, brokerage, primary_color, accent_color, logo_url, headshot_url`
- `public.public_client_site` → `client_id, custom_domain, subdomain`
- `public.public_client_market` → `client_id, primary_city, primary_state, cities, neighborhoods, counties`

Anon CANNOT read `posts.body` for any non-`published` row, `clients.phone`, `change_requests`, or other clients' private fields.

**Layer 2 (application):** every Supabase query in the `geo-sites` app **must** include `.eq('client_id', clientId)` where `clientId` came from the hostname middleware. This is load-bearing — explicitly documented in the repo's CONTRIBUTING and enforced by:
- A shared `siteSupabase(clientId)` helper that wraps the client and injects the filter on every `from('posts' | 'public_client_*')` call. Direct `supabase.from(...)` is a lint error.
- An automated test suite that, using the anon key:
  - attempts to read drafts → asserts 0 rows
  - attempts to read private fields (`clients.phone`, `change_requests`) → asserts 0 rows
  - attempts to query posts WITHOUT client_id filter → asserts the helper threw
  - attempts to query Client B's posts using Client A's resolved id → asserts 0 rows for the wrong scope

**Future hardening (Phase 3+):** explore Postgres session variables (`set_config('app.client_id', ...)`) called per request from the middleware so the policy can enforce `client_id = current_setting('app.client_id')`. Worth doing once the volume justifies the complexity.

## Phased build

**Phase 1 — Foundation (week 1–2)**
- New repo `geo-sites`
- Shared theme: `/`, `/blog`, `/blog/[slug]`, `/areas/[city]`, `/sitemap.xml`, `/feed.xml`, `/robots.txt`. JSON-LD baked in. No headshot/hero on `/`.
- Hostname middleware + KV cache (verified in CF runtime)
- `siteSupabase(clientId)` helper + lint rule against bare `supabase.from`
- Anon-key Supabase reads via the views above
- RLS leak test suite (4 tests above) green before Phase 1 closes
- Deploy to Pages on wildcard `*.sites.geoemployee.com`. Every client auto-gets `{slug}.sites.geoemployee.com` on signup.

**Phase 2 — Custom domains (week 3)**
- **Day 1: set fallback origin on `geoemployee.com` SaaS zone, verify with curl**
- Cloudflare for SaaS enabled on the zone
- `verify-domain` edge function with batching (25/run, 200ms spacing, 429 backoff) + pg_cron
- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`
- Portal UI `/portal/my-site/domain`: single CNAME instruction (www-first), TXT verify, live status, retry button
- Admin UI `/admin/clients/:id`: domain status, force re-verify, manual remove
- Apex flow as a "Need apex too?" help link, documented but not blocking

**Phase 3 — Publish pipeline + polish (week 4)**
- `publish-post` edge function with 3-retry exponential backoff
- `markets-updated` trigger for `/areas/*` purge
- `site_cache_purges` audit table + pg_cron sweep + admin "Force re-purge" UI
- R2 image pipeline + Cloudflare Images for cover photos
- (Optional) CF Registrar integration for Path B
- (Optional) `/about` route if headshots actually start landing

## Cost at scale

- Cloudflare Pages: $0 (or $20/mo on Pro)
- Cloudflare for SaaS: $0.10 × hostnames/mo
- KV + Cache: cents per M
- Supabase: scales with rows
- **1000 sites: ~$150/mo. 10,000 sites: ~$1,200/mo.**

Per-site Vercel/Netlify equivalent at 1000: $19,000/mo.

## Ready to build

All four open decisions are locked. All six v1 issues addressed. All four v2 review notes folded in. Phase 1 starts on approval.
