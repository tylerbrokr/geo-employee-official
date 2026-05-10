## Goal

Rebrand the entire GEO platform to match The Inner Cirql brand bible (white canvas, ink text, gold accent, Cormorant + Helvetica Neue, zero border-radius, hairline borders). Then ship a fully on-brand intake email sent from `geo@geoemployee.com`.

## Why this is a big change

The current platform is built on the opposite design system: emerald primary, deep navy sidebar, Inter everywhere, 8px rounded corners, soft shadows, gradient borders. Every visual token has to flip. This is a 1–2 hour rebrand, not a tweak.

---

## Phase 1 — Platform rebrand (ship first, no email work yet)

### 1A. Design tokens — rewrite `src/index.css`

Swap the entire token set:

- `--background`: `#ffffff` (was cool gray)
- `--foreground` / `--ink`: `#1a1a1a`
- `--card`: `#ffffff` (no gradient, no blur)
- `--accent` / `--gold`: `#c9a96e`
- `--off-white`: `#faf8f4` (callout blocks only)
- `--ink-08`: `rgba(26,26,26,0.08)` (hairline borders)
- `--ink-28`: `rgba(26,26,26,0.28)` (ghost button border)
- `--ink-35`: `rgba(26,26,26,0.35)` (labels)
- `--deep-ink`: `#0c0c0c` (rare full-bleed only)
- `--radius`: `0` (zero, everywhere)
- Sidebar: `#ffffff` with ink text (replaces deep navy)
- `--ring`: ink, not emerald
- `--destructive`: keep functional red

Remove all emerald references. Remove gradient borders. Remove `findr-card` glassmorphism. Replace `emerald-pulse` keyframe with a `gold-pulse` (5px gold dot, 1.4s pulse, used once per page).

### 1B. Typography — load brand fonts

- Replace Inter import with: **Cormorant Garamond** (300, 400, 400-italic) + **Helvetica Neue** stack (`-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif`).
- Body default: Helvetica Neue 400, 15px, line-height 1.75.
- New utility classes: `.font-display` (Cormorant), `.font-ui` (Helvetica Neue).
- Update `tailwind.config.ts` to add `display` and `ui` font families.

### 1C. Component overhaul

- **Buttons** (`src/components/ui/button.tsx`):
  - `default`: ink bg (`#1a1a1a`), parchment/off-white text, Helvetica 500 13px, padding 16px 36px, **square corners**.
  - `outline` (ghost): transparent bg, 1px `--ink-28` border, ink text.
  - New `gold` variant: gold bg, ink text — for form submits / high-emphasis CTAs in modals.
  - Hover: opacity-only shift (no color flip, no scale, no shadow).
- **Cards** (`src/components/ui/card.tsx`): white bg, hairline `--ink-08` border, no shadow, square corners. Delete `.findr-card` and `.findr-card-elevated` from `index.css`.
- **Inputs / Select / Textarea**: square corners, hairline border, ink text on white.
- **Badges**: square, ink-on-white or gold-on-ink.
- **Dialog / Sheet**: square, hairline border, white bg.
- Global: search-and-replace `rounded-*` Tailwind classes → remove or set to `rounded-none` where appropriate.

### 1D. Layout & navigation

- **Sidebar** (`src/components/AppSidebar.tsx` + `AdminLayout.tsx`):
  - Background: white (was deep navy).
  - 1px `--ink-08` right border to separate from content.
  - Active nav item: gold left-rail (2px) + ink text bold.
  - Inactive: `--ink-35` Helvetica 500 10px uppercase letter-spaced 2.5px (label style).
  - Logo lockup at top: ten gold dots mark + "GEO" wordmark in Cormorant 400.
- **Top bars / page titles**: `.page-title` becomes Cormorant Garamond 400, 26–32px, ink color, letter-spacing normal (no -0.02em).
- **Stat numbers**: Cormorant 300, 48px, ink.
- **Section labels**: Helvetica 500 10px uppercase, letter-spacing 2.5px, `--ink-35`.

### 1E. Iconography & micro-details

- List bullets → gold en-dashes (–), per brand bible.
- Live-state dot → gold (`#c9a96e`), 5px, 1.4s pulse, used once per page.
- No emojis anywhere (audit and remove if any exist).
- Em dashes → replace with periods, commas, parens, or en-dashes.

### 1F. Forbidden audit

Search and remove from the codebase:
- All emerald/`160 84%` color values.
- All `rounded-lg`, `rounded-xl`, `rounded-md` (replace with square or `rounded-none`).
- All `bg-gradient-*` and `linear-gradient(` decorative usage.
- Words from the never-do list in copy: "free" (use "included"), "unlock", "supercharge", "game-changer", etc.

### 1G. Update memory

Rewrite `mem://index.md` Core + replace design memory files to reflect the Inner Cirql brand. Delete the old emerald/navy memory entries.

---

## Phase 2 — Email infrastructure & branded intake email

(Only start after Phase 1 ships and you've eyeballed the rebranded UI.)

### 2A. Provision email domain
Set up `geoemployee.com` in Lovable Email. You'll add 2 NS records at your registrar for `notify.geoemployee.com`. Display-from-root enabled so recipients see `geo@geoemployee.com`, not the `notify.` subdomain.

### 2B. Provision email infrastructure
Stand up the email queue, suppression, unsubscribe handler, and the generic `send-transactional-email` function.

### 2C. Build the intake invite template — `client-intake-invite`

On-brand, plain, operator voice. Plaintext-feeling but properly styled.

```text
[ten gold dots mark]    GEO

Hello {first_name},

Your GEO workspace is live. The intake is the
fastest way to get your six posts written
and shipped this week.

It takes about ten minutes.

[ Open intake → ]   ← gold bg, ink text, square

If the button doesn't work:
{magic_link}

— The Inner Cirql

A sub-brand of BlakeSuddath.com
```

- Body bg: `#ffffff` (mandatory).
- Outer container: 560px, no border-radius.
- Headline: Cormorant Garamond 300, 28px, ink. (Use Google Fonts CSS in email head with web-safe Georgia fallback for clients that block webfonts.)
- Body: Helvetica Neue / Arial fallback, 15px, line-height 1.75, ink.
- CTA button: gold (`#c9a96e`) bg, ink text, Helvetica 500 13px, padding 16px 36px, square.
- Footer: gold ten-dot mark + "The Inner Cirql · A sub-brand of BlakeSuddath.com" in Helvetica 10px uppercase letter-spaced 2.5px, `--ink-35`.

Subject: `Your GEO workspace is live. Open the intake.`
From: `GEO <geo@geoemployee.com>`
Reply-to: no-reply (replies discouraged).

### 2D. Wire into `create-client`
After generating the magic link, call `send-transactional-email` with `templateName: 'client-intake-invite'`, recipient email, and `templateData: { first_name, magic_link }`. Return `{ magic_link, email_sent: true }`.

### 2E. Update `NewClientModal`
Success state shows "Intake email sent to {email}" with the gold CTA style. Magic link displayed below as a copyable fallback.

### 2F. Resend control
Add "Resend intake email" button on `ClientDetail` (visible while `pipeline_stage` is `draft` or `intake_sent`). Generates a fresh magic link and re-sends the same template.

---

## Out of scope (this round)

- Auth email customization (Lovable defaults are fine — we'll brand them later).
- Reminder emails, change-request notifications, post-published notifications.
- Logo SVG asset — for now, the ten gold dots will be CSS/HTML circles. A real SVG mark can come later.
- Cormorant rendering inside email is best-effort (Gmail/Apple Mail render webfonts; Outlook will fall back to Georgia). Acceptable per brand reality.

## What I need from you

1. Approve this plan to start Phase 1 (the rebrand). I'll batch the token rewrite, font swap, button/card overhaul, sidebar flip, and copy audit in one pass.
2. After Phase 1 lands, I'll surface the email setup dialog so you can paste the NS records at your registrar — then I'll ship Phase 2.
