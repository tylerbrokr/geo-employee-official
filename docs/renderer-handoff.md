# geo-sites renderer — hand-off diff (Phase 2)

The dashboard side of Phase 2 is shipped. This document is the complete spec for what to change in the **separate `geo-sites` repo** (the public renderer at `*.mygeosite.com` + custom domains). Paste in, redeploy, then hit the **Purge cache** button on each client's Domain tab.

All renderer queries use the **anon key** against the public Supabase project. RLS is already configured to expose only data for sites where `client_sites.dns_verified = true`.

---

## 1. Public data contract (recap)

The renderer queries these views/tables:

| View / table              | Use                                                                                                  |
|---------------------------|------------------------------------------------------------------------------------------------------|
| `public_client_site`      | `agent_display_name`, `subdomain`, `custom_domain`                                                   |
| `public_client_profile`   | `brokerage`, `headshot_url`, `logo_url`, `primary_color`, `accent_color`, `phone_e164`, `street_address`, `city`, `state`, `postal_code`, `years_experience` |
| `public_client_market`    | `primary_city`, `primary_state`, `cities`, `neighborhoods`, `counties`                              |
| `public_site_copy`        | `tagline`, `bio_short`, `bio_long`, `ideal_client_blurb`, `area_blurb`, `meta_title`, `meta_description`, `og_image_url` |
| `public_client_areas` *(new)* | `slug`, `area_type`, `name`, `state`, `intro`, `market_blurb`, `faqs` (jsonb), `meta_title`, `meta_description`, `updated_at` |
| `posts` (RLS allows anon for `status = 'published'`) | blog posts                                                                |

> If `public_client_profile` doesn't yet expose the new NAP columns (`phone_e164`, `street_address`, `city`, `state`, `postal_code`), recreate it to include them — same pattern as the other `public_*` views.

---

## 2. Brand colors

In the root layout (or wherever the per-site theme is set), inject the agent's brand colors as CSS variables on `<html>` (or the page root):

```tsx
<html
  style={{
    "--brand-primary": profile.primary_color ?? "#1a1a1a",
    "--brand-accent": profile.accent_color ?? "#c9a96e",
    "--brand-on-primary": readableForeground(profile.primary_color),
  } as React.CSSProperties}
>
```

```ts
// Pick black or white text for legibility on a colored background.
function readableForeground(hex: string | null | undefined): string {
  if (!hex) return "#fff";
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // sRGB relative luminance
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? "#000" : "#fff";
}
```

Then use `var(--brand-primary)` everywhere a CTA, button, link, eyebrow underline, divider, or active state currently uses a hard-coded color.

---

## 2a. Where brand accent appears

The page stays editorial and quiet. Brand color shows up as a thin signal, never as a flood fill. Rules:

- Only the **accent color** is used decoratively. Primary color stays reserved for one CTA-style spot (the phone link in the header).
- Accent is used as **lines, dots, and small marks** — never large filled areas, never text larger than a label-sized eyebrow.
- One accent moment per major region (header, hero, post card, post body, footer). More than that becomes loud.
- Accent is only ever drawn on white. Never used as a background behind body text.
- All accent uses fall back to brand gold (`#c9a96e`) when the client hasn't set a color (already handled by the CSS variable default).

Subtle placements:

| Region | Element | Treatment |
|--------|---------|-----------|
| Header | Sticky header bottom border (1px) | `var(--brand-accent)` at 20% opacity |
| Header | Phone `tel:` link | `var(--brand-accent)` (already spec'd in §3a, keep) |
| Home / About hero | Eyebrow label above agent name | uppercase 10px, `var(--brand-accent)`, letter-spacing 0.25em |
| Home / About hero | Decorative rule under the name | 2px solid `var(--brand-accent)`, 24px wide |
| Post index cards (`/blog`, home recent) | Tag chip text | `var(--brand-accent)`, no background, no border |
| Post index cards | "Read →" arrow on hover | `var(--brand-accent)` |
| Post page (`/blog/[slug]`) | Tag eyebrow above H1 | `var(--brand-accent)` |
| Post page | Decorative rule under H1 | 2px solid `var(--brand-accent)`, 32px wide, 12px below title |
| Post page | In-body links | `var(--brand-accent)` (already spec'd in §15, keep) |
| Post page | Blockquote left border | 2px `var(--brand-accent)` (already spec'd in §15, keep) |
| Post page | "About {Agent}" section eyebrow | `var(--brand-accent)` |
| Areas (`/areas/[slug]`) | Section eyebrows ("Neighborhoods", "FAQ") | `var(--brand-accent)` |
| Areas | FAQ item left border (2px) when open | `var(--brand-accent)` |
| Footer | Top hairline rule (1px) | `var(--brand-accent)` at 20% opacity |
| Footer | Brand mark dots (if rendered) | `var(--brand-accent)` |

That's it. ~10 lightweight CSS swaps, no layout changes, no new components. The agent's color choice becomes visible as a thin thread through the page without breaking the editorial feel.

---

## 3. Page set

| Route              | Purpose                                                                                       |
|--------------------|-----------------------------------------------------------------------------------------------|
| `/`                | Agent identity + recent posts + footer NAP block                                              |
| `/about`           | Bio, credentials, areas served, NAP block (plain text — no contact form)                     |
| `/blog`            | **NEW** — paginated index of all published posts                                              |
| `/blog/[slug]`     | Existing — add JSON-LD, OG tags, breadcrumbs                                                  |
| `/areas/[slug]`    | **NEW** — per-city/neighborhood/county landing page                                           |
| `/sitemap.xml`     | **NEW** — dynamic                                                                             |
| `/robots.txt`      | **REPLACE** — allow AI crawlers, point to sitemap                                             |
| `/llms.txt`        | **NEW** — markdown summary for LLM crawlers                                                   |

Every page renders the **persistent header (§3a)** at the top and **persistent footer (§3b)** at the bottom. Internal linking is one of the strongest GEO signals; without persistent nav, crawlers can only discover pages via the sitemap.

No `/contact` page. No contact forms. These sites exist to be cited by LLMs and indexed by search engines, not to capture leads.

---

## 3a. Persistent header

Sticky, hairline border on the bottom (`border-b border-[color:var(--brand-primary)]/10`), white background, ink text. No shadows, no rounded corners.

Layout:

```text
[Agent Name]                        About   Areas   Blog   [Phone]
[brokerage in muted text]
```

- Left: `site.agent_display_name` (link to `/`), brokerage one-liner below in `text-xs text-muted-foreground`
- Right: `<nav>` with links to `/about`, `/areas` (anchor on home or future index), `/blog`, then the phone number as a `tel:` link styled with `var(--brand-accent)` color
- **Phone slot is conditional** — render the `tel:` link only when `profile.phone_e164` is non-null. Never render an empty placeholder. Same rule applies to every NAP line in the footer.
- Mobile: collapse nav into a simple stacked menu under a hairline divider; no hamburger animation, no overlay

## 3b. Persistent footer

Three columns on desktop (stack on mobile), separated by `var(--brand-primary)/10` hairline rules. White background, no shadows.

Column 1 — **Identity + NAP** (see §6 for the address element):
- Agent name (semibold)
- Brokerage
- Address lines (omit any line where the underlying field is null)
- Phone (omit when `phone_e164` is null)

Column 2 — **Areas served**:
- `<h3>` "Areas served" (small, uppercase, tracking-wider, muted)
- Up to 12 most-relevant areas as `<a href="/areas/{slug}">{area.name}</a>`, one per line. If more than 12 areas exist, link "View all" to `/` or wherever the areas index lives.

Column 3 — **Recent writing**:
- `<h3>` "Recent writing"
- 5 most-recent published posts, each linked to `/blog/{slug}`
- Below: "All posts →" link to `/blog`

Bottom strip (full width, hairline above): `© {year} {agent_display_name}` left, "Built with care" or empty right. No social icons unless data is added later.

---

## 4. `/areas/[slug]` route

Query:

```ts
const { data: area } = await supabase
  .from("public_client_areas")
  .select("*")
  .eq("client_id", clientId)
  .eq("slug", params.slug)
  .maybeSingle();
if (!area) return notFound();
```

Render:

- **H1**: `${area.name} Real Estate` (or similar — keep the place name in the H1)
- **Eyebrow** above H1: agent name
- `area.intro` as the lede paragraph
- `area.market_blurb` as the body (split on `\n\n` into paragraphs)
- **FAQ section**: render `area.faqs` as `<details>` or styled accordions. Each FAQ `q` becomes the visible question; `a` the answer.
- **Recent posts in this area** (optional): query `posts` filtered by tag or by `area.name` substring match in title; show 3 cards.
- **Footer NAP block** (same as everywhere — see §6).

Meta tags: use `area.meta_title` / `area.meta_description`. Canonical: `https://${hostname}/areas/${area.slug}`.

JSON-LD on this page:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Place",
      "name": "{area.name}, {area.state}",
      "containedInPlace": { "@type": "AdministrativeArea", "name": "{area.state}" }
    },
    {
      "@type": "FAQPage",
      "mainEntity": area.faqs.map(f => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a }
      }))
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://{hostname}/" },
        { "@type": "ListItem", "position": 2, "name": "Areas", "item": "https://{hostname}/" },
        { "@type": "ListItem", "position": 3, "name": area.name, "item": "https://{hostname}/areas/{area.slug}" }
      ]
    }
  ]
}
```

---

## 4a. `/blog` index route (NEW — currently 404s, must be fixed)

The sitemap will list `/blog`, and crawlers/LLMs will hit it. Returning 404 wastes a top-level URL.

Query:

```ts
const PAGE_SIZE = 20;
const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
const from = (page - 1) * PAGE_SIZE;
const to = from + PAGE_SIZE - 1;

const { data: posts, count } = await supabase
  .from("posts")
  .select("slug, title, excerpt, cover_image_url, published_at", { count: "exact" })
  .eq("client_id", clientId)
  .eq("status", "published")
  .order("published_at", { ascending: false })
  .range(from, to);
```

Render:

- **H1**: "Writing" (or "Blog" — keep it short)
- One card per post: title (link to `/blog/{slug}`), excerpt, formatted date, optional cover image
- Pagination: prev/next links using `?page=N`. Hide prev on page 1, next when `from + posts.length >= count`.
- Empty state: "No posts yet." plain text. No CTA, no faux-content.

Meta:
- Title: `Writing | ${agent_display_name}`
- Description: `Recent writing from ${agent_display_name} on ${primary_city} real estate.`
- Canonical: `https://${hostname}/blog` (page 1) or `https://${hostname}/blog?page=${n}`

JSON-LD: `CollectionPage` with `ItemList` of post URLs + a `BreadcrumbList` (`Home → Writing`).

---

## 5. `/about` route

Pull from `public_client_profile` + `public_client_site` + `public_client_market` + `public_site_copy` + `public_client_areas`.

Sections (top to bottom):

1. **Hero**: headshot + agent name (H1) + brokerage subhead
2. **Bio**: `bio_long` (split on `\n\n`)
3. **Credentials line**: `years_experience` years in real estate · brokerage
4. **Areas served**: list of all `public_client_areas` for this client, each linking to `/areas/[slug]`
5. **NAP block** (plain text — see §6)

JSON-LD on this page (same as homepage — see §7).

---

## 6. NAP block (footer + about page)

Plain HTML so crawlers and LLMs read it directly. No `tel:` confusion, no obfuscation:

```tsx
<address className="not-italic text-sm leading-relaxed">
  <div className="font-semibold">{site.agent_display_name}</div>
  <div>{profile.brokerage}</div>
  {profile.street_address && <div>{profile.street_address}</div>}
  {(profile.city || profile.state || profile.postal_code) && (
    <div>
      {profile.city}{profile.city && profile.state ? ", " : ""}{profile.state} {profile.postal_code}
    </div>
  )}
  {profile.phone_e164 && (
    <div>
      <a href={`tel:${profile.phone_e164}`}>{formatPhoneUs(profile.phone_e164)}</a>
    </div>
  )}
</address>
```

`formatPhoneUs("+16125551234") => "(612) 555-1234"`.

**Conditional rendering — strict rule:** If a NAP field is `null`, omit the entire line (and the wrapping element if that's the only content). Never render `"—"`, "N/A", "Phone:", or any placeholder text on a public site. The same rule applies to the header phone slot (§3a) and the footer column (§3b): hide the slot entirely until the underlying field is populated. LLMs will cite whatever they see; a blank "Phone:" line ends up as part of the citation.

---

## 7. JSON-LD per page

**Home + About** — `RealEstateAgent` + `LocalBusiness`:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["RealEstateAgent", "LocalBusiness"],
      "@id": "https://{hostname}/#agent",
      "name": "{site.agent_display_name}",
      "image": "{profile.headshot_url}",
      "logo": "{profile.logo_url}",
      "telephone": "{profile.phone_e164}",
      "url": "https://{hostname}/",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "{profile.street_address}",
        "addressLocality": "{profile.city}",
        "addressRegion": "{profile.state}",
        "postalCode": "{profile.postal_code}",
        "addressCountry": "US"
      },
      "areaServed": areas.map(a => ({
        "@type": "Place",
        "name": `${a.name}${a.state ? `, ${a.state}` : ""}`
      })),
      "memberOf": { "@type": "Organization", "name": "{profile.brokerage}" }
    }
  ]
}
```

**Blog post** (`/blog/[slug]`) — `Article` + `BreadcrumbList`:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{post.title}",
  "image": "{post.cover_image_url}",
  "datePublished": "{post.published_at}",
  "dateModified": "{post.updated_at}",
  "author": { "@type": "Person", "name": "{site.agent_display_name}" },
  "publisher": { "@type": "Organization", "name": "{profile.brokerage}", "logo": "{profile.logo_url}" }
}
```

Always emit JSON-LD inside `<script type="application/ld+json">` in the document `<head>`.

---

## 8. Per-page `<head>` (title, description, canonical, OG) — NORMATIVE

**Every public route MUST emit all six of these fields in its `<head>`.** Missing any one of them fails the AI Visibility scorer's `page_meta` check and degrades LLM citations.

Required on every page:

1. `<title>`
2. `<meta name="description">`
3. `<link rel="canonical">`
4. `<meta property="og:title">`
5. `<meta property="og:description">`
6. `<meta property="og:url">`

Also required (not scored yet, but part of the contract):

- `<meta property="og:type">` — `"article"` on `/blog/{slug}`, `"website"` everywhere else
- `<meta property="og:image">` — fallback chain: `site_copy.og_image_url` → `clients.headshot_url` → `clients.logo_url` → omit the tag entirely (never emit a broken/placeholder image)
- `<meta name="twitter:card" content="summary_large_image">`

### Source of truth per route

| Route | `title` | `description` / `og:description` | `canonical` / `og:url` | `og:type` |
|---|---|---|---|---|
| `/` | `site_copy.meta_title` | `site_copy.meta_description` | `https://{hostname}/` | `website` |
| `/about` | `"About {agent_display_name} · {agent_display_name}"` | `site_copy.bio_short` (fallback: `site_copy.meta_description`) | `https://{hostname}/about` | `website` |
| `/blog` | `"Writing · {agent_display_name}"` | `site_copy.meta_description` | `https://{hostname}/blog` | `website` |
| `/blog/{slug}` | `post.meta_title ?? post.title` | `post.meta_description ?? post.excerpt` | `https://{hostname}/blog/{slug}` | `article` |
| `/areas/{slug}` | `area.meta_title` | `area.meta_description` | `https://{hostname}/areas/{slug}` | `website` |

`og:title` mirrors `title` (strip the `· {brand}` suffix if present).

### Currently failing in production (2026-05-16, test client `tyler-lewis.mygeosite.com`)

The renderer ships `/blog`, `/blog/{slug}`, and `/areas/{slug}` correctly. Two routes are incomplete and must be fixed in the next renderer PR:

- **`/`** — missing `description`, `canonical`, `og:description`, `og:url`. Currently emits only `<title>` and `og:title`. Read from `site_copy.meta_title` / `site_copy.meta_description` (both already populated by `generate-site-copy`).
- **`/about`** — missing `description` and `og:description`. Has title, canonical, `og:title`, `og:url`. Use `site_copy.bio_short` as the description source.

No data work is required — `site_copy` rows already contain `meta_title`, `meta_description`, and `bio_short` for every onboarded client.

### Verify a route in one line

```bash
curl -s https://{hostname}/{path} | grep -oiE '<title[^>]*>[^<]*</title>|<meta[^>]+(name|property)=["'"'"'](description|og:title|og:description|og:url|og:type|og:image)["'"'"'][^>]*>|<link[^>]+rel=["'"'"']canonical["'"'"'][^>]*>'
```

All six required tags must appear. This is the exact extraction the AI Visibility scorer runs.



---

## 9. `/sitemap.xml`

Server-rendered XML (set `Content-Type: application/xml`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://{hostname}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://{hostname}/about</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <!-- one <url> per area -->
  <url>
    <loc>https://{hostname}/areas/{slug}</loc>
    <lastmod>{area.updated_at}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- one <url> per published post -->
  <url>
    <loc>https://{hostname}/blog/{post.slug}</loc>
    <lastmod>{post.updated_at}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
```

---

## 10. `/robots.txt`

Replace whatever exists with this. The explicit AI-crawler allow-list is the whole point of these sites.

```
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: Bytespider
Allow: /

Sitemap: https://{hostname}/sitemap.xml
```

---

## 11. `/llms.txt`

Server-rendered markdown (Content-Type: `text/markdown`). The emerging convention LLMs actually crawl.

```markdown
# {site.agent_display_name}

{tagline}

{bio_short}

## Brokerage
{profile.brokerage}

## Contact
- Phone: {formatted phone}
- Address: {street_address}, {city}, {state} {postal_code}

## Areas served
{for each area} - [{area.name}{state ? `, ${state}` : ""}](https://{hostname}/areas/{area.slug})

## Recent posts
{for each of 10 most-recent published posts}
- [{post.title}](https://{hostname}/blog/{post.slug}) — {post.excerpt}

## Site map
- [Home](https://{hostname}/)
- [About](https://{hostname}/about)
- [Sitemap](https://{hostname}/sitemap.xml)
```

---

## 12. Internal linking

- On every blog post body, scan for any `area.name` (case-insensitive whole-word) and convert the first occurrence to a link to `/areas/[slug]`.
- On every `/areas/[slug]` page, query the 3 most-recent published posts whose title or body contains `area.name` and render them as cards.
- On the homepage, list 4 most-recent published posts and 3 random areas linked from a "Where I work" strip.

---

## 13. Cache invalidation

Already handled. Every dashboard mutation (post publish, area regen, copy regen, market update) inserts a row into `site_cache_purges` which the existing `purge-site-cache` cron drains. Manual purges are also queued via the Domain tab "Purge cache" button.

If the renderer adds any new paths (e.g. `/about`, `/areas/...`, `/sitemap.xml`, `/llms.txt`), make sure those paths are in the cached set. Path `/` purges should not be assumed to invalidate sub-paths.

---

## Verification checklist (after deploy)

- [ ] Homepage shows agent name, brokerage, tagline, brand colors applied
- [ ] `/about` renders bio_long and NAP block with phone/address
- [ ] `/areas/edina-mn` (or any client area slug) renders intro, market_blurb, FAQs
- [ ] View source on `/`: contains `<script type="application/ld+json">` with `RealEstateAgent`
- [ ] View source on `/areas/[slug]`: contains `FAQPage` JSON-LD
- [ ] `/sitemap.xml` returns valid XML with all routes
- [ ] `/robots.txt` includes GPTBot, ClaudeBot, PerplexityBot, Google-Extended
- [ ] `/llms.txt` renders agent summary + areas + posts
- [ ] OG image preview works in Slack/Twitter card validator
- [ ] Persistent header renders on every page; phone slot is hidden when `phone_e164` is null
- [ ] Persistent footer renders on every page with NAP, areas list, recent posts; missing fields collapse silently
- [ ] `/blog` returns a paginated list (not 404) and is in the sitemap

---

## 14. Canonical area names (data-side note, not renderer work)

The dashboard now canonicalizes geographic names via the `generate-area-pages` edge function. When a client types `"hennipan, MN"` during intake, the AI rewrites the value in `client_markets.cities` (etc.) to `"Hennepin"` and stashes the original in `client_markets.raw_input.original` for audit. The `client_areas.slug` is regenerated from the corrected name; the previous orphaned row is deleted and its public path is queued for cache purge.

**Renderer impact:** none — `public_client_areas` and `public_client_market` will simply start returning correctly spelled names. No code changes required, but be aware that an existing area slug like `/areas/hennipan-county-mn` may disappear and be replaced by `/areas/hennepin-mn` on the next sync. The cache purge queue already handles both old and new paths.

---

## 15. Blog post body — render `posts.body` as markdown (CRITICAL BUG)

**Current behavior:** `/blog/[slug]` renders `post.body` as plain text. Markdown headers, paragraph breaks, and lists all collapse into one wall of text. Example seen in production: `"...Hennepin County. ## Why work with a local agent in Edina Choosing..."` — the `##` is rendered literally instead of as a heading. This destroys GEO citation quality because LLMs cannot identify the answer capsule, the question H2s, or the About section.

**Fix:** Add a markdown parser to the blog post route. The dashboard-side prompt was rewritten to follow the GEO Answer Page contract (H1 = question, H2s = follow-up questions, mandatory `## About {Agent}` section, blank lines around every header). All new generated posts will be valid markdown. The renderer just needs to parse it.

### Install

```bash
npm install react-markdown remark-gfm rehype-slug rehype-autolink-headings
```

- `react-markdown` — parser
- `remark-gfm` — GitHub-flavored markdown (tables, autolinks, strikethrough)
- `rehype-slug` — auto-generates `id` on every heading so anchor links work
- `rehype-autolink-headings` — wraps each heading in an anchor link (good for AI extraction and deep-linking)

### Component

Create `components/PostBody.tsx` (or wherever the blog post body is rendered):

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

export function PostBody({ markdown }: { markdown: string }) {
  return (
    <div className="post-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: "wrap" }],
        ]}
        components={{
          // Strip the markdown H1 — the page already renders the title as <h1>.
          // Promote the first H2 down only if you also want to enforce single-H1; otherwise leave defaults.
          h1: () => null,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
```

Use it in the blog post route:

```tsx
// before:
<div>{post.body}</div>

// after:
<PostBody markdown={post.body ?? ""} />
```

The page-level `<h1>{post.title}</h1>` stays as it is. The `h1: () => null` override prevents a duplicate H1 if the model also includes one in `body` (the new prompt does — see §15a).

### Stylesheet

Add to the global stylesheet (or scope under `.post-body`). Match the brand bible: Cormorant Garamond display headings, Helvetica Neue body, ink text, hairline rules, ZERO border-radius.

```css
.post-body {
  color: #1a1a1a;
  font-family: "Helvetica Neue", system-ui, sans-serif;
  font-size: 17px;
  line-height: 1.7;
  max-width: 720px;
}
.post-body h2 {
  font-family: "Cormorant Garamond", Georgia, serif;
  font-size: 1.875rem;
  font-weight: 500;
  line-height: 1.2;
  margin: 2.5rem 0 1rem;
  letter-spacing: -0.01em;
}
.post-body h3 {
  font-family: "Cormorant Garamond", Georgia, serif;
  font-size: 1.375rem;
  font-weight: 500;
  margin: 2rem 0 0.75rem;
}
.post-body p { margin: 0 0 1.25rem; }
.post-body a {
  color: var(--brand-accent, #c9a96e);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.post-body ul, .post-body ol { margin: 0 0 1.25rem 1.5rem; }
.post-body li { margin: 0 0 0.5rem; }
.post-body hr {
  border: 0;
  border-top: 1px solid rgba(26, 26, 26, 0.08);
  margin: 2.5rem 0;
}
.post-body blockquote {
  border-left: 2px solid var(--brand-accent, #c9a96e);
  padding-left: 1rem;
  margin: 1.5rem 0;
  color: #555;
}
/* Anchor link wrapper from rehype-autolink-headings — hide the underline on hover-only */
.post-body h2 a, .post-body h3 a { color: inherit; text-decoration: none; }
```

No border-radius anywhere. No drop shadows. No gradient text. This matches the dashboard side.

### 15a. What the body now contains

The dashboard-side generator (`supabase/functions/_shared/generate-post.ts`) now returns `body` in this exact shape:

```markdown
# {Title as a question}

{Answer capsule — 2-3 sentences naming the agent, city, years experience, specific recommendation}

## {Follow-up question 1}

{2-3 self-contained paragraphs}

## {Follow-up question 2}

{2-3 self-contained paragraphs}

## {Follow-up question 3}

{2-3 self-contained paragraphs}

## About {Agent Name}

{2-3 sentences with E-E-A-T signals}

{Agent Name}
{Brokerage}
{Street address}
{City, State Zip}
{Phone}
```

Every header has a blank line before and after it. Paragraphs are separated by `\n\n`. There are no em dashes, no emojis, no `---` dividers inside the body. The H1 in `body` duplicates `posts.title`; the `h1: () => null` override above strips it so the page chrome owns the title.

### 15b. JSON-LD update for blog posts

Now that body is real markdown, add `articleBody` to the existing `Article` JSON-LD (§7) using a plain-text version of the body (strip markdown). This gives LLMs a clean extraction target:

```ts
function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")        // headers
    .replace(/\*\*(.+?)\*\*/g, "$1")    // bold
    .replace(/\*(.+?)\*/g, "$1")        // italic
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links
    .replace(/`(.+?)`/g, "$1")          // inline code
    .replace(/^>\s+/gm, "")             // blockquotes
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
```

Add `"articleBody": stripMarkdown(post.body)` and `"wordCount": stripMarkdown(post.body).split(/\s+/).length` to the Article object.

### 15c. Backfill

Existing `posts` rows generated before this fix will still render as plain text inside the markdown component (no `##`, no structure), but they will at least have correct paragraph breaks if the original text had `\n\n`. The Inner Cirql team will manually delete and regenerate any pre-fix posts from the admin queue. No renderer-side migration needed.

### 15d. Cache purge

After deploying this change, hit "Purge cache" on each active client's Domain tab so the old plain-text HTML is evicted. The path set already includes `/blog/{slug}` for any post-publish purge, so future posts are fine — this is a one-time backfill.

### Verification

- [ ] View source on any `/blog/[slug]`: body contains real `<h2>`, `<p>`, `<ul>` elements (not literal `##` text)
- [ ] No duplicate H1 (page H1 = post title; body H1 is suppressed)
- [ ] H2s have `id` attributes (e.g., `id="why-work-with-a-local-agent-in-edina"`) and are wrapped in `<a>` so they're deep-linkable
- [ ] Brand accent color applied to links (uses `var(--brand-accent)`)
- [ ] Brand accent applied to: header bottom border (20% opacity), hero eyebrow + 24px rule under name, post card tag text, post page tag eyebrow + 32px rule under H1, About section eyebrow, areas section eyebrows + open FAQ left border, footer top hairline (20% opacity)
- [ ] Accent never used as a background behind text; only on white
- [ ] No em dashes, no emojis, no `---` dividers visible in the rendered output
- [ ] JSON-LD `Article` includes `articleBody` and `wordCount`
