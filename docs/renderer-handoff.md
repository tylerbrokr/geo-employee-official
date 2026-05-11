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

## 8. Open Graph + Twitter card

In every page's `<head>`:

```html
<meta property="og:title" content="{meta_title}" />
<meta property="og:description" content="{meta_description}" />
<meta property="og:type" content="website" /> <!-- "article" on blog posts -->
<meta property="og:url" content="https://{hostname}{path}" />
<meta property="og:image" content="{og_image_url ?? headshot_url ?? logo_url}" />
<meta name="twitter:card" content="summary_large_image" />
```

Fallback chain for the image: `site_copy.og_image_url` → `clients.headshot_url` → `clients.logo_url` → omit.

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
