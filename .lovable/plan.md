# Schema migration v2 — backend prep for GEO Sites hosting

Single migration, scoped to the schema work needed before the `geo-sites` repo or any Phase 2/3 edge function exists. Folds in all four review fixes.

## Changes from v1

1. **`trigger` column renamed → `purge_trigger`.** Reserved word, would silently break unquoted queries.
2. **Indexes added on `client_sites`** for the hostname-lookup hot path and the SSL-polling loop.
3. **FK constraints added** on `site_cache_purges.client_id` (CASCADE) and `requested_by` (SET NULL).
4. **RLS scope clarified.** Clients SELECT their own purge rows (so the portal can show "your latest post is live"). Admins do everything else. Description and SQL match.

## Migration contents

### `client_sites`
- Drop unused `vercel_domain_id`
- Add `verification_token text`, `cloudflare_hostname_id text`, `ssl_status text`, `last_verified_at timestamptz`, `verify_attempts integer NOT NULL DEFAULT 0`
- Validation trigger: `ssl_status` must be `pending | active | failed` (or null)
- Indexes (partial, only non-null rows):
  - `idx_client_sites_custom_domain` on `(custom_domain) WHERE custom_domain IS NOT NULL`
  - `idx_client_sites_subdomain` on `(subdomain) WHERE subdomain IS NOT NULL`
  - `idx_client_sites_cf_hostname_id` on `(cloudflare_hostname_id) WHERE cloudflare_hostname_id IS NOT NULL`

### `site_cache_purges` (new)
- `id uuid pk default gen_random_uuid()`
- `client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE`
- `hostname text NOT NULL`
- `paths text[] NOT NULL DEFAULT '{}'`
- `purge_trigger text NOT NULL` — `post_publish | markets_updated | manual`
- `requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL`
- `status text NOT NULL DEFAULT 'pending'` — `pending | success | failed | dead`
- `attempt_count integer NOT NULL DEFAULT 0`
- `last_error text`
- `created_at`, `updated_at` timestamps
- Indexes: `(client_id)`, `(status, updated_at)` for the cron sweep
- Validation trigger on `status` and `purge_trigger`
- `update_updated_at_column` trigger
- RLS enabled

### RLS on `site_cache_purges`
- **Admins manage cache purges** — `ALL` for `has_role(auth.uid(), 'admin')`
- **Clients view own cache purges** — `SELECT` where `owns_client(auth.uid(), client_id) OR has_role(...)`
- Edge functions (`publish-post`, `verify-domain`, the cron sweep) use the **service role key** to write — they bypass RLS by design. Already in `SUPABASE_SERVICE_ROLE_KEY` secret.

## Out of scope for this migration

- The four public-read views (`public_client_profile`, `public_client_site`, `public_client_market`) — those land with Phase 1 of the `geo-sites` repo so the anon key has a target to read from. Adding them now without a consumer just creates leak surface.
- The anon `posts` SELECT policy — same reason. Lands with Phase 1.
- The `pg_cron` schedule for `verify-domain` and the purge sweep — lands with Phase 2 / Phase 3 when the edge functions exist.

## After approval

Run the migration. That's it for this turn. The next loop kicks off the `geo-sites` repo (separate from this Lovable project) with the hostname middleware and shared theme.
