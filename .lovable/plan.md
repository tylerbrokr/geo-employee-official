
# Phase 2 (revised): use `.mygeosite.com` for subdomain hostnames

Only change vs the previously approved plan: every place that builds a hostname from a subdomain now uses **`.mygeosite.com`** instead of `.geoemployee.com`. Custom domains are unchanged.

Verified: the existing `validate_site_cache_purges` trigger already allows `purge_trigger` values `post_publish`, `markets_updated`, and `manual`, so the trigger inserts will pass validation.

## Where the change applies

1. **Migration — `enqueue_post_publish_purge` trigger function**
   ```text
   _hostname := _site.subdomain || '.mygeosite.com';
   ```

2. **Migration — `enqueue_markets_update_purge` trigger function**
   ```text
   _hostname := _site.subdomain || '.mygeosite.com';
   ```

3. **`provision-site` edge function** — when returning the site URL for a brand-new client (no custom domain), build it as `https://{subdomain}.mygeosite.com`.

4. **Admin Domain tab (`ClientDetail.tsx`)** — the always-on subdomain link renders as `{subdomain}.mygeosite.com`.

5. **Client portal (`MySite.tsx`)** — the live URL shown to the agent (before they add a custom domain) is `https://{subdomain}.mygeosite.com`.

6. **DNS instructions copy** — when an agent sets a custom domain, the CNAME they're told to add still points at `geo-sites.pages.dev` (that's the Cloudflare Pages app, unchanged). Only the wildcard host the platform serves on changes to `mygeosite.com`.

## Prerequisite outside this codebase

The wildcard `*.mygeosite.com → geo-sites.pages.dev` CNAME must exist on `mygeosite.com` and the Pages project must list `*.mygeosite.com` (or `mygeosite.com` with wildcard) as an attached domain. If that's not done yet, the rows we write will be correct, but the URLs won't resolve until DNS is in place. Worth confirming before we ship the UI change.

## Order of operations

1. Apply the corrected migration (triggers + functions, both using `.mygeosite.com`).
2. Build `provision-site`, `verify-domains`, `purge-site-cache` edge functions.
3. Schedule pg_cron jobs (`verify-domains` every 5 min, `purge-site-cache` every 1 min).
4. Build admin Domain tab + client portal MySite page.

Everything else from the previously approved plan (Cloudflare API only for custom domains, retry/dead logic on purges, RLS reuse, secrets list) stays as-is.
