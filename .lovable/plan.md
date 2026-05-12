## Problem

Your test client (Tyler Lewis) has a fully provisioned `client_sites` row (subdomain `tyler-lewis`, `dns_verified=true`, `pipeline_stage=autopilot`), but `clients.site_status` is still `pending` and `clients.site_url` is null. Nothing in the codebase ever flips `clients.site_status` to `live`, so the portal Dashboard keeps rendering the "GEO is building your site" panel.

## Fix

Stop relying on `clients.site_status` / `clients.site_url` in the client portal. Treat the site as live whenever a `client_sites` row exists with a usable URL.

### Liveness rule (single source of truth)

A client site is **live** when there is a `client_sites` row AND:
- `custom_domain` is set and `dns_verified = true` → live URL is `https://{custom_domain}`, OR
- a `subdomain` is set → live URL is `https://{subdomain}.mygeosite.com`

Add a tiny helper (e.g. `src/lib/siteStatus.ts`) that returns `{ isLive, liveUrl }` from a `client_sites` row.

### Files to change

1. **`src/hooks/useClient.tsx`** – also fetch the client's `client_sites` row in the same hook and return `{ client, site, isLive, liveUrl, loading, refetch }`. This avoids every page re-querying it.
2. **`src/pages/Dashboard.tsx`** – replace `client?.site_status === "live"` check with `isLive` from the hook. Show the live card (with `liveUrl`) when live; otherwise show `<SiteBuildStatus>`.
3. **`src/components/SiteBuildStatus.tsx`** – compute `siteDone` from the passed `client_sites` row instead of `client.site_status`. Accept `site` as a prop (or read from the hook) so the "Site provisioned" step lights up correctly.
4. **`src/pages/MySite.tsx`** – already reads `client_sites` directly; just align it with the new helper so the same liveness rule is used.

### Out of scope (intentionally)

- Not touching `provision-site` / `verify-custom-domains` to backfill `clients.site_status`. The column is unused by the rest of the app and keeping the portal driven by `client_sites` means the status can't drift again.
- Admin pages (`admin/Clients`, `admin/ClientDetail`) keep showing `site_status` as-is — they're admin-only and you can decide later if you want them switched too.

### Result for your test client

Tyler Lewis's portal will immediately show the live site card pointing at `https://tyler-lewis.mygeosite.com` instead of the build-in-progress panel.
