# Phase 2: Brand colors, subdomain fix, area pages, full GEO stack

These are GEO content sites built for LLM crawlability — not the agent's primary site. Goal: get the agent cited when someone asks ChatGPT/Perplexity/Google AI "who's the best real estate agent in Edina, MN." No contact forms. NAP (Name, Address, Phone) data displayed as plain text for citation authority.

Four workstreams. Each ends with a clear renderer-side diff you can paste into the geo-sites repo.

---

## 1. Subdomain fix + rename Tyler

**Bug:** `provision-site` slugs from `clients.business_name`, which is empty for most clients, so it ships the literal fallback `"site"`. Tyler is currently `site.mygeosite.com`.

**Fix in `provision-site`:**

- Resolve the slug from, in order: `profiles.full_name` (joined via `clients.owner_user_id`), `clients.business_name`, `clients.brokerage`, then `"site"`.
- Slug = lowercase, hyphenated, alphanumeric only, max 40 chars.
- Collision: append `-2`, `-3`, ... up to 200.

**New `rename-subdomain` edge function (admin-only):**

- Takes `client_id` + new slug. Validates slug format and uniqueness.
- Updates `client_sites.subdomain`, enqueues a cache purge for both old and new hostnames.
- Plain subdomain swaps don't touch Cloudflare (served from the wildcard). Custom-hostname rename is out of scope.

**Admin UI:** Small "Rename subdomain" action on the Domain tab. Inline validation.

**Run once for Tyler** → `tyler-lewis.mygeosite.com`. Old `site.mygeosite.com` stops resolving.

---

## 2. Brand colors on the renderer

Data is already exposed (`public_client_profile.primary_color`, `accent_color`). No DB changes.

**Renderer diff:**

- In the site root layout, read both colors from the profile query and inject as CSS variables on `<html>`:
  ```
  style={{ '--brand-primary': profile.primary_color, '--brand-accent': profile.accent_color }}
  ```
- Wire those into Tailwind config (`brand.primary`, `brand.accent`) or use directly on buttons, links, eyebrow underlines, dividers, CTAs.
- Compute readable foreground (`#fff` vs `#000`) from luminance for text-on-primary.

---

## 3. Per-area landing pages

**New table `client_areas`** — one row per area page:

- `client_id`, `slug` (e.g. `edina-mn`), `area_type` (`city` | `neighborhood` | `county`), `name`, `state`, `parent_area_id`, `intro` (AI), `market_blurb` (AI), `faqs` (jsonb array of `{q, a}`), `meta_title`, `meta_description`, `stale`, `ai_generated_at`.
- Unique on (`client_id`, `slug`).
- RLS: admin manage; client view own; **anon read where the client's site is `dns_verified`** (same pattern as `site_copy`).
- View `public_client_areas` joining to verified sites, granted to anon/authenticated.

**Generation:**

- New edge function `generate-area-pages` walks `client_markets.cities` + `neighborhoods` + `counties`, creates one row per entry, calls Lovable AI Gateway to fill copy fields and 5 FAQs per area.
- Auto-runs at end of `provision-site` and whenever `client_markets` changes (mark stale + extend `regenerate-stale-site-copy` to also regen stale areas).
- Admin UI: "Areas" tab on the client detail page — list, edit, regenerate single, regenerate all.

**Renderer:**

- New routes `/areas/[slug]` (no index page — each area is its own crawlable URL, linked from home + about + blog).
- Render H1, intro, market_blurb, FAQs (with `FAQPage` JSON-LD — see #4).

---

## 4. Full GEO/LLM optimization

Mostly renderer work. DB additions are minimal.

**DB additions:**

- Add `og_image_url` to `site_copy` (nullable, fallback to headshot).
- Add `phone_e164`, `street_address`, `postal_code`, `city`, `state` to `clients` (all nullable). These power NAP citations and `LocalBusiness` schema.
- Surface in onboarding step 1 as optional fields (clearly marked "displayed publicly for LLM citation authority").

**Page set (renderer):**

- `/` — agent identity, eyebrow city/state, headline = agent name, subhead = brokerage, tagline, recent posts grid, NAP block in footer.
- `/about` — `bio_long`, `headshot_url`, `years_experience`, `specialties`, `differentiators`, `values_text`, `brokerage_story`, list of areas served (linking to `/areas/[slug]`), and a plain-text NAP block (name, address, phone, email). No form.
- `/blog/[slug]` — existing.
- `/areas/[slug]` — see #3.

**Renderer diff:**

- **JSON-LD per page**, injected in `<head>`:
  - Home + About: `RealEstateAgent` + `LocalBusiness` (with `address`, `telephone`, `areaServed` from `client_areas`, `sameAs` from social links if present).
  - Blog post: `Article` + `BreadcrumbList`.
  - Area page: `Place` + `FAQPage` + `BreadcrumbList`.
- **Open Graph + Twitter card meta** on every page (`meta_title`, `meta_description`, `og_image_url` with headshot fallback).
- **Dynamic `sitemap.xml`** route generated from published `posts` + `client_areas` + static routes (`/`, `/about`). `<lastmod>` from `updated_at`.
- **`robots.txt`** allowing all (including AI crawlers: GPTBot, ClaudeBot, PerplexityBot, Google-Extended), pointing to sitemap.
- **`llms.txt`** at root — markdown describing the agent, NAP, areas served, specialties, top blog posts, canonical URLs. Generated dynamically.
- **Canonical tag** on every page.
- **Internal linking**: blog post template auto-links any city/neighborhood mention to its area page; area page lists 3 most-recent posts tagged with that area.

---

## Order of work

1. Subdomain bug fix + `rename-subdomain` function + admin UI button. Rename Tyler.
2. `client_areas` table + view + RLS + `generate-area-pages` function + admin Areas tab.
3. `og_image_url` on `site_copy` + NAP fields on `clients`. Onboarding tweak.
4. Hand-off doc at `docs/renderer-handoff.md` with every renderer diff (colors, area routes, About page, JSON-LD, sitemap, robots, llms.txt, OG tags, canonicals, internal linking, AI-crawler allow-list).

After step 4 you paste the diffs into geo-sites, redeploy, hit Purge cache.

---

## Out of scope

- Contact forms / `contact_submissions` table.
- Auto-generating OG images (just the field + headshot fallback).
- Renderer hosting/framework changes.
- Touching the existing blog-generation pipeline.
