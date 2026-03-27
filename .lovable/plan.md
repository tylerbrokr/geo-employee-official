

# Build the FindR Onboarding Wizard

The onboarding wizard doesn't exist yet — no file, no route. This is a full build from scratch.

## What we're building

A standalone 5-step full-screen wizard at `/onboarding` with no sidebar or nav. Centered 600px card, signature gradient border, smooth step transitions, and a launch loading sequence that transitions into the dashboard.

## Architecture

One main file `src/pages/Onboarding.tsx` containing all step components inline (keeps it self-contained), plus a route in `App.tsx`.

## Implementation

### 1. Create `src/pages/Onboarding.tsx`

**Layout shell**: Full-screen `#F8FAFC` background, centered card (600px, white, 40px padding, 16px radius, `findr-card` class for gradient border). FindR wordmark above the card.

**Step progress bar**: 5 nodes connected by lines. Active = emerald, completed = navy, upcoming = gray. Labels: "You", "Market", "Specialties", "Brand", "Launch".

**Step transitions**: `framer-motion` `AnimatePresence` with horizontal slide (enter from right, exit to left). Direction reverses when going back.

**Steps**:
- **Step 1 — About You**: Name, brokerage, years (select dropdown), photo upload (dashed border area with circular preview on upload)
- **Step 2 — Your Market**: Primary city, state (all 50 US states select), then 3 tag-input sections (Surrounding Cities, Neighborhoods, Counties) with pre-filled chips and Enter/comma to add
- **Step 3 — Specialties**: 10 toggle chips in a wrapping grid. 4 pre-selected. Active = emerald fill, inactive = bordered gray
- **Step 4 — Your Brand**: Two color pickers (primary/accent) with hex input, preview strip, logo upload area
- **Step 5 — Review & Launch**: Summary card showing all entered data, full-width "Launch My FindR Site →" CTA button

**Launch loading**: Replaces card content with spinner + 3 sequential status lines appearing at 0s, 1.5s, 3s. After 4s, navigates to `/dashboard`.

**Navigation**: Back/Next buttons at card bottom. No Back on step 1. Next validates nothing (mock mode). Step 5 replaces Next with the Launch CTA.

### 2. Update `src/App.tsx`

Add `/onboarding` route pointing to the new page.

### 3. Add sidebar link for testing

Add a small "Setup Guide" link at the bottom of `AppSidebar.tsx` that navigates to `/onboarding`.

## Files

| File | Action |
|------|--------|
| `src/pages/Onboarding.tsx` | Create — entire wizard |
| `src/App.tsx` | Add route |
| `src/components/AppSidebar.tsx` | Add testing link |

