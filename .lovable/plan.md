## What "3/5 pages fully tagged" actually means

I fetched the live test site (`tyler-lewis.mygeosite.com`) and inspected every page's `<head>`. The 6 fields the scorer requires per page are: `title`, `meta description`, `canonical`, `og:title`, `og:description`, `og:url`.

| Route | Title | Desc | Canonical | og:title | og:desc | og:url | Verdict |
|---|---|---|---|---|---|---|---|
| `/` | ✓ | **✗** | **✗** | ✓ | **✗** | **✗** | **fails** (4 fields missing) |
| `/about` | ✓ | **✗** | ✓ | ✓ | **✗** | ✓ | **fails** (2 fields missing) |
| `/blog` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | passes |
| `/blog/{slug}` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | passes |
| `/areas/{slug}` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | passes |

So the two failing pages are `/` and `/about`. The data exists — `site_copy.meta_title` and `site_copy.meta_description` are populated for the test client. This is a pure renderer bug: the homepage and about routes aren't reading from `site_copy`, and `/about` is missing its description + og:description.

Also worth noting: **no page emits `og:image`** even though §8 of the renderer spec already calls for it. The current scorer doesn't grade that, but the renderer team should close it in the same pass.

---

## Where the fix lives

The site renderer is the separate `geo-sites` project (Next.js), not this dashboard. This dashboard owns two things relevant to the issue:

1. `docs/renderer-handoff.md` — the spec the renderer team builds from.
2. `supabase/functions/score-ai-visibility/index.ts` — the visibility scorer that surfaced this finding.

Fixing both makes the issue surface clearly for every client going forward, and gives the renderer team a single normative source to implement against once.

---

## Changes in this project

### 1. Tighten `docs/renderer-handoff.md` §8 (the per-page head contract)

Replace the current §8 prose with a normative per-route table that makes the contract impossible to misread. Concretely:

- A "every page MUST emit these 6 fields" rule: `title`, `meta description`, `canonical`, `og:title`, `og:description`, `og:url`.
- A per-route source-of-truth table:

  ```text
  Route              title                     description                  canonical / og:url
  /                  site_copy.meta_title      site_copy.meta_description   https://{host}/
  /about             "About {agent} · {brand}" site_copy.bio_short          https://{host}/about
  /blog              "Writing · {brand}"       site_copy.meta_description   https://{host}/blog
  /blog/{slug}       post.meta_title ?? title  post.meta_description        https://{host}/blog/{slug}
  /areas/{slug}      area.meta_title           area.meta_description        https://{host}/areas/{slug}
  ```
- `og:image` fallback chain restated as required: `site_copy.og_image_url` → `clients.headshot_url` → `clients.logo_url` → omit.
- An explicit callout naming the two routes currently failing (`/` and `/about`) and the exact tags they're missing, so the renderer PR knows what "done" looks like.
- A small "verification" snippet (one-liner curl + grep) the renderer team can run before declaring a route fixed.

### 2. Make the scorer report which page is missing what

Right now the scorer collapses everything into `3/5 pages fully tagged, titles unique`. That's why this finding is hard to act on. Update `supabase/functions/score-ai-visibility/index.ts` so the `page_meta` check:

- Records, per sampled page, which of the 6 required fields are present/missing.
- Returns the failing rows in the `details` string, e.g.
  `"/: missing description, canonical, og:description, og:url; /about: missing description, og:description"`.
- Keeps the same scoring weight (4 pts) and the same partial-credit math, just with actionable text.
- Optional: also surface a separate sub-line for `og:image` coverage (informational, not scored) so the renderer team sees it while they're in there.

This means the next time a client's score drops on this check, the admin sees the exact tags and routes to fix instead of a vague ratio.

### 3. No DB or data changes

Data is fine — `site_copy.meta_title`/`meta_description` and `clients.bio_short` are populated by the existing `generate-site-copy` flow. The intake wizard and copy generator don't need changes.

---

## Out of scope

- The actual renderer PR in the `geo-sites` repo — that's a separate project. This plan makes the spec unambiguous and the scorer specific, so that PR is a tight, one-shot fix that lands for every client at once.
- Adding `og:image` to the scored checks (currently informational only).
- Per-route Helmet in this dashboard project — these tags belong to the public client sites, not the admin UI.

## Files touched

- `docs/renderer-handoff.md` (edit §8)
- `supabase/functions/score-ai-visibility/index.ts` (rewrite the `page_meta` check's details output)
