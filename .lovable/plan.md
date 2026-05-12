# Automate custom domain provisioning

## Important reuse decision

The schema already has equivalents for almost everything in your spec:

| Spec name | Existing column | Action |
|---|---|---|
| `cf_custom_hostname_id` | `cloudflare_hostname_id` | **Reuse existing** — no migration needed. I'll keep the current name (it's already wired into `verify-domains`, `provision-site`, and the types file) so we don't have to rename in 4 places. |
| `dns_records` | `dns_records` jsonb | Reuse, but change the shape to match spec (see below). |
| `dns_verified`, `ssl_status` | exist | Reuse. |

`provision-site` already creates a Cloudflare custom hostname today, but it's bundled with subdomain allocation and uses `ssl.method = "http"` with `geo-sites.pages.dev` as the CNAME target. We'll split the custom-domain path into its own function per your spec, switch SSL to TXT-DV, and point CNAME at the SaaS fallback host.

## What gets built

### 1. Edge function: `provision-custom-domain` (new)

POST `{ client_id, custom_domain }`. Admin-only (same JWT + role check pattern as `provision-site`).

- Normalize + validate domain (reuse the regex from `provision-site`).
- If `client_sites` row already has a `cloudflare_hostname_id` for a *different* domain, refuse with a clear error and tell the caller to disconnect first.
- POST to Cloudflare custom_hostnames with `ssl: { method: "txt", type: "dv", settings: { min_tls_version: "1.2" } }`.
- On success, update `client_sites`:
  - `custom_domain`
  - `cloudflare_hostname_id` = `result.id`
  - `dns_records` = `{ cname: { name: <www or @>, value: "customers.mygeosite.com" }, ownership_txt: { name, value } }` (we'll derive `name` = `www` if the input starts with `www.`, else `@`)
  - `dns_verified = false`, `ssl_status = "pending"`, `verify_attempts = 0`
- Surface Cloudflare errors verbatim (already-claimed hostname, invalid hostname, etc.) with 4xx.

### 2. Edge function: `verify-custom-domains` (rename/replace existing `verify-domains`)

`verify-domains` already does almost exactly what the spec asks. I'll:

- Rename the function file path to `verify-custom-domains` to match the spec (and update the one caller in `DomainTab` "Re-check now").
- Tighten the status mapping per spec:
  - `result.status === "active"` → `dns_verified = true, ssl_status = "active"`.
  - `pending_validation` / `pending_blocked` / `pending_*` → leave; bump `verify_attempts`.
  - `deleted` or HTTP 404 → clear `cloudflare_hostname_id`, set `ssl_status = "failed"` (UI then offers retry).
- Keep the existing transition side-effects (bump `pipeline_stage` to `site_live`, enqueue a `/` cache purge).

### 3. Edge function: `remove-custom-hostname` (new)

POST `{ client_id }`, admin-only. Looks up `cloudflare_hostname_id`, calls `DELETE …/custom_hostnames/{id}` (404 is treated as success), then clears `custom_domain`, `cloudflare_hostname_id`, `dns_records`, sets `dns_verified = false`, `ssl_status = null`, `verify_attempts = 0`.

### 4. Scheduled trigger (pg_cron)

Run `verify-custom-domains` every 15 min. We'll insert this via the data tool (uses anon key + function URL), not migrations, per the cron-jobs convention.

### 5. `supabase/config.toml`

Add `[functions.provision-custom-domain] verify_jwt = true`, `[functions.remove-custom-hostname] verify_jwt = true`, `[functions.verify-custom-domains] verify_jwt = false` (cron-driven).

### 6. DomainTab rebuild (`src/components/admin/DomainTab.tsx`)

The "Custom domain" card becomes a 3-state wizard. Subdomain card and cache-purge card stay as-is.

**State A — no `cloudflare_hostname_id`:**
- Input "Your custom domain (e.g. www.yourdomain.com)" + "Connect Domain" button → `provision-custom-domain`. Loading spinner during call.

**State B — `cloudflare_hostname_id` set, `dns_verified = false`:**
- Heading "Add these DNS records at your domain registrar".
- Two-row DNS table (Type / Name / Value) with copy buttons:
  - `CNAME` · `www` (or `@`) · `customers.mygeosite.com`
  - `TXT` · `dns_records.ownership_txt.name` · `dns_records.ownership_txt.value`
- Yellow "Waiting for DNS propagation" badge.
- Note: "DNS changes can take up to 48 hours. We check every 15 minutes."
- "Re-check now" button → `verify-custom-domains` with `{ client_id }`.
- "Remove domain" link → `remove-custom-hostname`.

**State C — `dns_verified = true`:**
- Green "Active" badge + "Your site is live at: https://{domain}" clickable.
- "Disconnect domain" link → `remove-custom-hostname` (then back to State A).

Mirror the State B DNS instructions on the client-facing `MySite.tsx` (it already reads `dns_records`; just adjust to the new shape).

## Technical notes

- **No migration required.** The existing `cloudflare_hostname_id` column is a 1:1 substitute for the spec's `cf_custom_hostname_id`. If you want the rename anyway, say so and I'll add it (it touches 5 files).
- **SSL method change to `txt`** is a behavior change for any in-flight pending hostnames. Existing rows continue to work — Cloudflare keeps their original SSL config — but new connects will need the TXT record instead of an HTTP-01 path. This matches your spec and avoids needing the agent's site to be reachable before issuance.
- **CNAME target `customers.mygeosite.com`** assumes that hostname exists as a CNAME → `geo-sites.pages.dev` in the `mygeosite.com` zone, AND that Cloudflare for SaaS Fallback Origin is set to `geo-sites.pages.dev`. Both are setup steps you do once in the Cloudflare dashboard for the SaaS zone. The `dns_records` jsonb will document exactly what agents paste.
- **Worker host header** (from prior thread): unrelated to this PR but still required for routing custom domains in the renderer Worker — we'll handle that separately.
- **Secrets:** uses existing `CF_API_TOKEN` (already in secrets) and `CLOUDFLARE_ZONE_ID`. The current `provision-site` reads `CLOUDFLARE_API_TOKEN`; new functions will read `CF_API_TOKEN` per spec. Both are already configured.
- **RLS:** no policy changes — `client_sites` already lets admins manage and clients read their own row.

## Files touched

- New: `supabase/functions/provision-custom-domain/index.ts`
- New: `supabase/functions/remove-custom-hostname/index.ts`
- New (renamed from `verify-domains`): `supabase/functions/verify-custom-domains/index.ts`; delete old
- Edited: `supabase/config.toml`
- Edited: `src/components/admin/DomainTab.tsx`
- Edited: `src/pages/MySite.tsx` (DNS-record shape only)
- Data op (cron): `cron.schedule('verify-custom-domains-15m', '*/15 * * * *', …)` via insert tool
