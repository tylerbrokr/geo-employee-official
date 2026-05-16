## What is still broken

The dashboard/scorer is now doing its job. It is telling us the public site renderer still has two route bugs:

- `/` is missing `<meta name="description">` and `<meta property="og:description">`.
- `/about` is missing `<meta name="description">` and `<meta property="og:description">`.
- `og:image` is missing on all sampled pages, but that is informational right now.

This is not fixed inside this dashboard app. It must be fixed in the separate public-site renderer (`geo-sites`). I checked from here and that project is not accessible in this workspace, so I cannot patch it directly from this project.

## Plan

1. **Open the `geo-sites` renderer project.**
   - Find the homepage route (`/`) and about route (`/about`).
   - Look for existing head/meta code used by `/blog`, `/blog/[slug]`, or `/areas/[slug]`, because those routes already pass.

2. **Centralize the head builder.**
   - Create or update one helper that emits the full required page head:
     - `title`
     - `description`
     - `canonical`
     - `og:title`
     - `og:description`
     - `og:url`
     - `og:type`
     - `og:image` when a valid image exists
     - `twitter:card`
   - This prevents the same issue from coming back route by route.

3. **Patch the homepage metadata.**
   - Source title from `site_copy.meta_title`.
   - Source description and `og:description` from `site_copy.meta_description`.
   - Set canonical and `og:url` to `https://{hostname}/`.
   - Set `og:type` to `website`.

4. **Patch the about page metadata.**
   - Source title from `About {agent_display_name} · {agent_display_name}` or the renderer’s existing about title pattern.
   - Source description and `og:description` from `site_copy.bio_short`, falling back to `site_copy.meta_description`.
   - Set canonical and `og:url` to `https://{hostname}/about`.
   - Set `og:type` to `website`.

5. **Add the shared `og:image` fallback.**
   - Use this order:
     - `site_copy.og_image_url`
     - `clients.headshot_url`
     - `clients.logo_url`
     - omit the tag if none exists
   - Do not emit a placeholder or broken image URL.

6. **Verify before deploying.**
   - Run this against the preview renderer domain for each sampled path:

```bash
curl -s https://{hostname}/{path} | grep -oiE '<title[^>]*>[^<]*</title>|<meta[^>]+(name|property)=["'"'"'](description|og:title|og:description|og:url|og:type|og:image)["'"'"'][^>]*>|<link[^>]+rel=["'"'"']canonical["'"'"'][^>]*>'
```

   - Confirm `/`, `/about`, `/blog`, `/blog/{slug}`, and `/areas/{slug}` each return the six required tags.

7. **Deploy `geo-sites`, then re-run the visibility check.**
   - Once the renderer deploys, click **Re-run** on the Visibility card for the test client.
   - Expected result: `5/5 pages fully tagged — titles unique`.
   - `og:image` will improve only if the client has one of the fallback image fields populated.

## Going forward

Once `geo-sites` uses the shared head builder for every route, every new client gets the fix automatically. The copy generator already creates `site_copy.meta_title`, `site_copy.meta_description`, and `site_copy.bio_short`, so this does not require new intake fields or manual per-client work.

## Exact code shape to give the renderer developer

```ts
function buildPageHead({
  title,
  description,
  canonicalUrl,
  type = "website",
  siteCopy,
  client,
}: {
  title: string;
  description: string;
  canonicalUrl: string;
  type?: "website" | "article";
  siteCopy?: { og_image_url?: string | null };
  client?: { headshot_url?: string | null; logo_url?: string | null };
}) {
  const ogImage =
    siteCopy?.og_image_url ||
    client?.headshot_url ||
    client?.logo_url ||
    null;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}
```

Homepage:

```ts
return buildPageHead({
  title: siteCopy.meta_title,
  description: siteCopy.meta_description,
  canonicalUrl: `https://${hostname}/`,
  siteCopy,
  client,
});
```

About page:

```ts
return buildPageHead({
  title: `About ${agentDisplayName} · ${agentDisplayName}`,
  description: siteCopy.bio_short || siteCopy.meta_description,
  canonicalUrl: `https://${hostname}/about`,
  siteCopy,
  client,
});
```

That is the actual fix needed. The dashboard has already been updated so future reports explain exactly which route and tag failed.