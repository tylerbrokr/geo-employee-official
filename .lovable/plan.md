## Goal
Use the GEO circle logo (the 10 gold dots from `BrandMark`) as the site favicon.

## Background
The logo isn't a stored image — it's generated in code at `src/components/BrandMark.tsx` as 10 evenly-spaced gold (`hsl(36 43% 61%)` / `#c9a96e`) dots arranged in a circle. So there's nothing in `public/` or `src/assets/` to point at today. We'll generate a matching standalone SVG and ship it as the favicon.

## Changes

1. **Create `public/favicon.svg`** — hand-written SVG using the same geometry as `BrandMark.tsx`:
   - 32×32 viewBox, transparent background
   - 10 circles, gold fill `#c9a96e`
   - Same radius/dot-size ratios (`radius = size * 0.42`, `dotSize = size * 0.085`) so it visually matches the sidebar mark
2. **Update `index.html`** — replace the current favicon link with:
   ```html
   <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
   ```
3. **Delete `public/favicon.ico`** — browsers auto-request `/favicon.ico` and will prefer it over the SVG if left in place.

## Out of scope
- PNG/ICO fallbacks (chose SVG-only)
- Apple touch icon
- Per-client favicons on rendered blog sites (this is just the GEO admin/portal favicon)
