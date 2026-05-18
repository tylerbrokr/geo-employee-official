## Goal

Make the renderer's `/{indexnow_key}.txt` route work by exposing `indexnow_key` through the `public_client_site` view.

## What's already in place

- `client_sites.indexnow_key text` column exists (added in the earlier migration).
- All existing rows are backfilled with a unique 32-char key.
- `provision-site` generates a new key on every new site row.
- Renderer already reads `indexnow_key` from `public_client_site` via the anon key.

The only gap is the view — it currently selects 6 columns and does not include `indexnow_key`, so the renderer gets `null` and returns 404.

## Change

One migration that recreates `public_client_site` with `indexnow_key` added to the select list. No other schema changes, no backend changes, no frontend changes.

```sql
CREATE OR REPLACE VIEW public.public_client_site AS
SELECT
  client_id,
  subdomain,
  custom_domain,
  ssl_status,
  provisioned_at,
  agent_display_name,
  indexnow_key
FROM public.client_sites
WHERE dns_verified = true;
```

## Verification

After the migration:
1. `SELECT indexnow_key FROM public_client_site LIMIT 3` returns non-null values.
2. Hit `https://{any-live-site}/{indexnow_key}.txt` on the renderer — should return the key as plain text instead of 404.

## Out of scope

The column add, default, and backfill are already done in the prior migration — no need to re-run them.
