
# AI Visibility Score — admin-side health check per client

## Goal

Give Blake/Tyler a single number per client (0–100) plus a checklist showing exactly what's helping or hurting that client's chance of being cited by ChatGPT, Claude, Perplexity, and Google's AI Overviews. Score lives on the admin client detail page. No client-facing exposure in v1.

## What "AI visibility" actually means here

LLM crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) and AI-overview retrievers reward the same things classic SEO does, plus a few specifics:

1. **Crawlability** — `robots.txt` explicitly allows the AI bots, `sitemap.xml` lists every page, `llms.txt` summarizes the site.
2. **Structured data** — JSON-LD on every page (`RealEstateAgent` / `Person` + `LocalBusiness` sitewide, `Article` + `articleBody` + `wordCount` on posts, `FAQPage` on areas, `BreadcrumbList` everywhere).
3. **Identity / NAP authority** — Name, Address, Phone consistent across pages and present in schema.
4. **Per-page meta** — unique `<title>`, `<meta description>`, canonical, OG tags.
5. **Content depth** — published posts with real body length, FAQ coverage on area pages, internal linking.
6. **Freshness** — recent `published_at`, autopilot active, no stale flags.

The renderer spec in `docs/renderer-handoff.md` already defines almost all of this. The score's job is to **verify it's actually happening**, not just that we intended it.

## Score model

Total = 100, split into 4 categories. Each check is pass/fail/partial with a weight.

```text
┌─ Profile completeness         (25 pts) — what we own in the DB
│   • NAP filled (phone_e164, street, city, state, postal)     5
│   • Headshot + logo uploaded                                  3
│   • bio_short + bio_long + tagline filled                     5
│   • meta_title + meta_description set                         3
│   • Primary + accent color set (not defaults)                 2
│   • ≥3 specialties, ≥1 property_type                          3
│   • voice + values + ideal_client + story filled              4
│
├─ Site infrastructure          (25 pts) — live fetch
│   • Custom domain verified OR subdomain live                  5
│   • robots.txt allows GPTBot/ClaudeBot/PerplexityBot/         5
│     Google-Extended
│   • sitemap.xml returns 200, lists /, /about, /blog,          5
│     /areas/*, all published posts
│   • llms.txt present and well-formed                          5
│   • All key routes return 200 (sample 5)                      5
│
├─ Structured data + meta       (25 pts) — live fetch + parse
│   • Homepage JSON-LD: RealEstateAgent/Person + LocalBusiness  6
│   • Each sampled post: Article JSON-LD with articleBody +     6
│     wordCount + author + datePublished
│   • Area pages: FAQPage JSON-LD                               4
│   • BreadcrumbList present on inner pages                     3
│   • Every sampled page has unique <title>, meta desc,         4
│     canonical, og:* tags
│   • NAP in schema matches DB                                  2
│
└─ Content + freshness          (25 pts)
    • ≥4 published posts                                        5
    • ≥1 published post in last 14 days                         5
    • Autopilot enabled + ≥4 drafts buffered                    5
    • All client_areas generated (no stale=true)                5
    • site_copy not stale                                       3
    • Average published-post word count ≥800                    2
```

Score bands: 90+ Excellent · 75–89 Good · 50–74 Needs work · <50 At risk.

## Surface in admin UI

On `/admin/clients/:id`, above the tabs, add an "AI Visibility" card:

```text
┌────────────────────────────────────────────────────┐
│  AI VISIBILITY                              82/100 │
│  Good · last checked 4 min ago     [Re-run check]  │
│                                                    │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  Good              │
│                                                    │
│  Profile           23/25  ✓                        │
│  Infrastructure    20/25  ⚠ llms.txt missing       │
│  Schema + meta     22/25  ⚠ Article schema missing │
│                          articleBody on 2 posts    │
│  Content + fresh   17/25  ⚠ no post in 18 days     │
│                                                    │
│  [View full checklist]                             │
└────────────────────────────────────────────────────┘
```

Expanding the checklist shows every check, pass/fail, and a one-line "how to fix" pointing to the right tab (Domain, Copy, Areas, Posts).

Optional v1.1: aggregate score column on the admin `Clients` list so Blake can sort by it.

## How it runs

- **On demand** via "Re-run check" button on the client detail page.
- **Automatically** after these events: site goes live, post publishes, area pages regenerated, site_copy regenerated, custom domain verified. (Triggered by a small edge function call from the existing flows — non-blocking.)
- Results cached in a new `client_visibility_reports` table; admin UI reads the latest row.

## Technical details

### New edge function: `score-ai-visibility`
- Input: `{ client_id }`
- Auth: admin-only (checks `has_role(auth.uid(), 'admin')`).
- Steps:
  1. Load client + market + site + site_copy + areas + posts + topics from DB.
  2. Run profile + content checks (pure DB, fast).
  3. Resolve the live hostname (`custom_domain` if verified, else `{subdomain}.mygeosite.com`).
  4. Fetch `robots.txt`, `sitemap.xml`, `llms.txt`, `/`, `/about`, `/blog`, one sampled `/blog/[slug]`, one sampled `/areas/[slug]`.
  5. Parse HTML for `<title>`, meta description, canonical, og:*, and all `<script type="application/ld+json">` blocks. Validate the JSON-LD shape against expected types.
  6. Compute category scores → total.
  7. Insert one row into `client_visibility_reports`.
- 10s timeout per fetch, all fetches parallel, ignore-fail on individual sub-pages (counts as fail, not as crash).

### New table: `client_visibility_reports`
- Columns: `id`, `client_id`, `total_score smallint`, `profile_score`, `infra_score`, `schema_score`, `content_score`, `checks jsonb` (full per-check breakdown: `[{id, label, category, points, max, status, detail, fix_hint}]`), `created_at`.
- RLS: admins only.
- Indexed on `(client_id, created_at desc)`.

### New admin component
- `src/components/admin/VisibilityCard.tsx` — score header + category bars.
- `src/components/admin/VisibilityChecklist.tsx` — expandable full breakdown.
- Hook into `ClientDetail.tsx` above the existing Tabs.

### Auto-rescore triggers
- Call the edge function (fire-and-forget) at the end of: `provision-site` after `dns_verified`, `generate-area-pages` success, `generate-site-copy` success, `autopilot-tick` after publish. No blocking; failures swallowed.

## Out of scope for v1

- Showing the score to clients in the portal.
- Backlink/authority signals (would need Semrush; can add later as a separate category).
- Real LLM "do you know this agent?" probes (interesting but expensive and slow; revisit later).
- Historical trend charts (just store reports, render trend in v1.1).
- Auto-fix actions — v1 only diagnoses.

## Deliverables

1. Migration: `client_visibility_reports` table + RLS.
2. Edge function: `supabase/functions/score-ai-visibility/index.ts` with the check engine.
3. Wire fire-and-forget calls from `provision-site`, `generate-area-pages`, `generate-site-copy`, `autopilot-tick`.
4. `VisibilityCard` + `VisibilityChecklist` components.
5. Mount on `ClientDetail.tsx` above tabs.
6. Brief admin-side doc section in `docs/renderer-handoff.md` (or new `docs/ai-visibility.md`) listing each check and weight, so future scoring tweaks are intentional.
