# Add subtle brand-color accents to the client blog site

## Context

The public blog sites (`*.mygeosite.com` and custom domains) are rendered by the **separate `geo-sites` repo**, not by this admin platform. Each client picks a `primary_color` and `accent_color` during onboarding, and the renderer already injects them as CSS variables (`--brand-primary`, `--brand-accent`) on `<html>`. Today only three things actually consume them: post-body link color, blockquote left border, and the header phone link. Everything else uses ink/off-white/gold from the brand palette, so the agent's color choice is invisible on the rendered page.

This plan extends `docs/renderer-handoff.md` (the spec the geo-sites repo follows) with a tight list of additional **subtle** placements. The renderer team then applies the diff and redeploys. No changes to the admin/portal code, no changes to AI generation, no changes to the brand palette inside this app.

## Design principle

Keep the page editorial and quiet. Brand color appears as a thin signal, never as a flood fill. Rules:

- Only the **accent color** is used decoratively. Primary color stays reserved for one CTA-style spot (the phone link).
- Accent is used as **lines, dots, and small marks** — never large filled areas, never text larger than a label.
- One accent moment per major region (header, hero, post card, post body, footer). Anything more becomes loud.
- All accent uses fall back to brand gold (`#c9a96e`) when the client hasn't set a color.

## Subtle accent placements (renderer changes)

```text
Header
  └─ 1px bottom border on the sticky header  →  var(--brand-accent) at 20% opacity
  └─ Phone tel: link                          →  var(--brand-accent) (already spec'd, keep)

Home / About hero
  └─ Eyebrow label above agent name           →  uppercase 10px, var(--brand-accent), letter-spacing 0.25em
  └─ 24px hairline rule under the name        →  2px solid var(--brand-accent)

Post index cards (/blog and home recent posts)
  └─ Tag chip text                            →  var(--brand-accent), no background, no border
  └─ "Read →" arrow on hover                  →  var(--brand-accent)

Post page (/blog/[slug])
  └─ Tag eyebrow above H1                     →  var(--brand-accent)
  └─ H1 underline (decorative, 32px wide)     →  2px solid var(--brand-accent), 12px below title
  └─ In-body links                            →  var(--brand-accent) (already spec'd, keep)
  └─ Blockquote left border                   →  var(--brand-accent) (already spec'd, keep)
  └─ "About {Agent}" section eyebrow          →  var(--brand-accent)

Areas pages (/areas/[slug])
  └─ Section eyebrows ("Neighborhoods", "FAQ") →  var(--brand-accent)
  └─ FAQ item left border (2px) when open      →  var(--brand-accent)

Footer
  └─ Top hairline rule (1px)                  →  var(--brand-accent) at 20% opacity
  └─ Brand mark dots (if used)                 →  var(--brand-accent)
```

That's it. ~10 lightweight CSS swaps. No layout changes, no new components.

## Legibility guard

Accent color is only ever used on white. Never as a background behind text. The renderer already has `readableForeground()` for the rare case primary color is used as a fill (e.g. a button) — keep that, but no new fills are introduced here.

## Deliverables in this repo

1. **Edit `docs/renderer-handoff.md`** — add a new section §2a "Where brand accent appears" with the table above and the legibility rule. Update the existing checklist at the bottom with the new accent placements so the renderer team can tick them off.

2. **No code changes in this app.** The portal already lets the client pick the colors; the renderer is what needs to apply them.

## Out of scope

- Changing the admin/portal UI (the brand bible says the platform itself stays ink/white/gold — client colors only show on their own public site).
- Adding a "live color preview" inside the portal. Can do later if useful.
- Changing how `primary_color` / `accent_color` are stored or onboarded.
- Touching AI generation, posting cadence, or any backend logic.

## Files

- `docs/renderer-handoff.md` — append §2a, update final checklist.
