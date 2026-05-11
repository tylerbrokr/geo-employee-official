# Phase 2 — shipped (dashboard side)

GEO content sites for LLM citation. No contact forms. NAP as plain text.

## ✅ Dashboard (this repo)

1. **Subdomain bug fixed** — `provision-site` now resolves the slug from `profiles.full_name` → `clients.business_name` → `clients.brokerage` → email local part → `"site"`, with collision handling. New `rename-subdomain` edge function (admin-only) plus a "Rename" button on the Domain tab.
2. **Tyler renamed** — `site.mygeosite.com` → `tyler-lewis.mygeosite.com`. Cache purges queued for both hosts.
3. **`client_areas` table** — one row per /areas/[slug] page. RLS: admins manage, clients view own, anon reads only when site is `dns_verified`. Public view `public_client_areas`.
4. **`generate-area-pages` edge function** — walks `client_markets`, creates one row per city/neighborhood/county, fills intro / market_blurb / 5 FAQs / meta_title / meta_description via Lovable AI Gateway. Auto-fires from `provision-site`. Trigger marks all areas stale whenever markets change.
5. **Areas tab** on the admin client page — list, edit copy + FAQs inline, regenerate one or all, sync from markets.
6. **NAP fields** added to `clients`: `phone_e164`, `street_address`, `city`, `state`, `postal_code`. `og_image_url` added to `site_copy`. Editable NAP card on the Overview tab. (Skipped onboarding wizard — admin-curated for now.)
7. **Renderer hand-off doc** at `docs/renderer-handoff.md` — every diff for the geo-sites repo: brand colors as CSS vars, `/about` + `/areas/[slug]` routes, JSON-LD (`RealEstateAgent` + `LocalBusiness` + `FAQPage` + `Article` + `BreadcrumbList`), OG/Twitter meta, `/sitemap.xml`, `/robots.txt` with AI-crawler allow-list (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.), `/llms.txt`, internal linking strategy, NAP block.

## Next steps for you

1. Open Tyler's Areas tab → click **Sync from markets** to generate his per-area pages.
2. Fill in Tyler's NAP fields on the Overview tab (phone, address, etc.).
3. Paste the diffs from `docs/renderer-handoff.md` into the geo-sites repo, redeploy.
4. Hit **Purge cache** on the Domain tab. Visit `tyler-lewis.mygeosite.com`, `/about`, `/areas/[slug]`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`.

## Out of scope (intentionally)

- Contact forms / lead capture — these are LLM citation sites, not lead-gen sites.
- Auto-generating OG images.
- Renderer framework / hosting changes.
