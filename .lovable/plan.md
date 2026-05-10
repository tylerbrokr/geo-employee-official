## Three polish passes for the GEO chat + portal

### 1. Lose the black-box GEO avatar

GEO's avatar is currently the ten-dot mark on a solid `bg-ink` square (header at 36px, every GEO bubble at 28px). Reads like a placeholder favicon.

- Drop the `bg-ink` wrapper. Render `<BrandMark>` directly on the white canvas.
- Per-bubble avatar: `<BrandMark size={22} />`, flush with the bubble's top-left, no chip behind it.
- Header: swap to `<BrandLockup>` (mark + "GEO" wordmark in Cormorant) instead of the boxed mark.
- Optional motion: slow rotation (~6s/turn, ease-in-out) on GEO's mark only while the typing indicator is active. Implemented as a `@keyframes` rule in `index.css` toggled by `data-thinking` on the avatar wrapper. Stops the moment the bubble appears. No new assets, no GIF, no Lottie.

### 2. Add examples to the open-ended questions

Five questions need free-form writing and currently land cold: `voice`, `valuesText`, `idealClient`, `brokerageStory`, `differentiators`.

Add an optional `hint` field to `ScriptStep`. Render as a small italic line under the question bubble (off-white background, ink-50, 12px, "e.g." prefix). Persistent, not just placeholder text.

Proposed hints (written like a real person would answer, not marketing copy):

- **voice** — *e.g. "Warm but direct. No jargon. Sound like a friend who happens to know the market."*
- **valuesText** — *e.g. "Honesty over hype. Local first. Clients before commissions."*
- **idealClient** — *e.g. "Young families relocating from out of state, first-time buyers in their early 30s, downsizers who've owned for 20+ years."*
- **brokerageStory** — *e.g. "Spent 10 years in hospitality, switched to real estate in 2019 after helping my parents sell. Joined Compass last year."*
- **differentiators** — *e.g. "Lifelong local. 60+ closings a year. Only agent in town who handles the inspection walkthrough personally."*

### 3. Real "GEO is building your site" empty states in the portal

Today, before a client's site is live, the portal just says "Not yet provisioned" and the status dot reads "pending." Cold. Doesn't tell them anything is happening.

Drive the empty state off `clients.pipeline_stage` (already exists: `draft → intake_complete → in_production → live`) plus `site_status`. If `site_status !== 'live'`, show a build-status panel instead of the normal page content.

**Build-status panel (shared component, e.g. `<SiteBuildStatus />`):**

- Off-white callout block, ink text, gold dot pulsing on the active step.
- Headline (Cormorant, 32px): *"GEO is building your site."*
- Subhead: *"Live within 7 days. We'll email you the moment it's ready."*
- Step tracker (4 hairline rows, each with a small ten-dot mark on the left):
  1. Intake received — checkmark when `pipeline_stage >= intake_complete`
  2. Topic research — active when `pipeline_stage = in_production` and no master topics yet, complete when `client_topics` has rows
  3. First posts drafted — active when topics exist, complete when `posts.count > 0`
  4. Site provisioned — active when `client_sites` row exists with `dns_verified = false`, complete when `site_status = 'live'`
- Active step shows the gold pulse dot, completed steps show a static gold dot, future steps show ink-15.
- ETA line at the bottom: *"Started [date]. Estimated live: [date + 7]."* Pulled from `clients.created_at` (or `intake_status.completed_at` if available).
- Single secondary CTA: *"Have something to add?"* → opens the existing `<ChangeRequestModal>` so they can send notes while they wait.

**Where it shows:**

- `Dashboard.tsx` — replaces the "Site URL / Status" hero card when `site_status !== 'live'`. Keep the rest of the page (recent posts, etc.) below it, but if those are also empty, show their own small empty states (see below).
- `MySite.tsx` — replaces the entire page body when `site_status !== 'live'`. Once live, current view shows.
- `Posts.tsx` — when there are no posts yet AND `site_status !== 'live'`, show a slim version: *"Your first posts are being written. They'll appear here as drafts roll in."* with the gold pulse dot. Once live with no posts, fall back to current empty state.
- `Market.tsx` — when `client_topics` is empty, show: *"GEO is researching your market. Topics will appear here once research is complete."* Same visual language.

**Visual notes (brand-bible compliant):**

- No spinners, no progress bars with percentages (would be fake). The gold pulse dot on the active step does the work.
- Square corners, hairline borders, no shadows.
- One gold accent per panel.
- All copy direct, period-stopped, no hype, no emojis.

### Files to change

- `src/components/geo-chat/GeoChat.tsx` — header → `<BrandLockup>`; bubble avatar drops `bg-ink` wrapper; optional `data-thinking` hook; renders `step.hint` under the question.
- `src/components/geo-chat/script.ts` — add `hint?: string` to `ScriptStep`; add the five hints.
- `src/index.css` — `geo-thinking` keyframe (only if motion is in).
- `src/components/SiteBuildStatus.tsx` — new shared component, takes `client` + queries `client_topics` / `posts` / `client_sites` for step state.
- `src/pages/Dashboard.tsx` — gate hero card on `site_status === 'live'`; otherwise render `<SiteBuildStatus />`.
- `src/pages/MySite.tsx` — same gate, full-page swap.
- `src/pages/Posts.tsx` — slim build-status empty state when no posts and not live.
- `src/pages/Market.tsx` — slim build-status empty state when no topics.

### Out of scope

- No DB schema changes (everything driven off existing columns).
- No changes to the actual provisioning pipeline or autopilot logic.
- No question reorder or removal in the chat.

### Decisions to confirm

1. **Avatar motion** — keep static (cleaner) or add the slow rotation while GEO is typing?
2. **ETA line** — show "Estimated live: [date]"  with a real 7-day target, or keep it qualitative ("Live within 7 days") to avoid setting a hard date the team has to hit?
3. **Step 2 (Topic research) signal** — is `client_topics` having rows the right "research complete" signal, or is there a better admin-side flag I should look for?