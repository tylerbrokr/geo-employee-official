## Why the site still shows "Pemberton Real Estate" twice

The dashboard data is correct (`agent_display_name = "Tyler Lewis"`, `site_copy.tagline` generated). The geo-sites renderer reads from public Supabase views/tables using the anon key, and two things block it:

1. **`public_client_site` view is missing `agent_display_name`.** It was created in Phase 1 before that column existed. The renderer gets `null` and falls back to `business_name` / `brokerage`.
2. **`site_copy` has no public read access.** RLS only grants admins and the owning client. The anon key reads nothing, so tagline / bio_short / meta tags never appear.

## Fix (one migration, no app code changes)

**1. Recreate `public_client_site` to include the new column**

```sql
CREATE OR REPLACE VIEW public.public_client_site AS
SELECT
  client_id,
  subdomain,
  custom_domain,
  ssl_status,
  provisioned_at,
  agent_display_name
FROM public.client_sites
WHERE dns_verified = true;
```

**2. Add a `public_site_copy` view (mirrors the pattern of the other `public_*` views, gated by `dns_verified`)**

```sql
CREATE OR REPLACE VIEW public.public_site_copy AS
SELECT
  sc.client_id,
  sc.tagline,
  sc.bio_short,
  sc.bio_long,
  sc.ideal_client_blurb,
  sc.area_blurb,
  sc.meta_title,
  sc.meta_description
FROM public.site_copy sc
JOIN public.client_sites s ON s.client_id = sc.client_id
WHERE s.dns_verified = true;

GRANT SELECT ON public.public_site_copy TO anon, authenticated;
GRANT SELECT ON public.public_client_site TO anon, authenticated;
```

Using a view instead of a blanket `USING (true)` policy on `site_copy` keeps the base table locked down (admins + owner only for editing), only published-site copy is exposed, and it matches the existing pattern (`public_client_profile`, `public_client_market`, `public_client_site`).

## Renderer contract (for reference, no changes needed on that side)

The renderer should query, with the anon key:
- `public_client_site` → `agent_display_name`, `subdomain`, `custom_domain`
- `public_client_profile` → `brokerage`, `headshot_url`, `logo_url`, brand colors
- `public_client_market` → `primary_city`, `primary_state`
- `public_site_copy` → `tagline`, `bio_short`, `bio_long`, `meta_title`, `meta_description`

Mapping on the homepage:
- H1 = `public_client_site.agent_display_name`
- Subhead = `public_client_profile.brokerage`
- Eyebrow = `primary_city, primary_state`
- Tagline under H1/subhead = `public_site_copy.tagline`

## Verification after migration

1. Hit the existing **Purge cache** button on the Domain tab (or it'll be queued automatically? — manual is faster).
2. Reload `https://site.mygeosite.com`. H1 should flip to "Tyler Lewis", subhead to "Pemberton Real Estate", and the tagline should render below.

If anything still falls back to old fields after the cache purge, the renderer's query needs updating — but per Claude's note that's not expected.
