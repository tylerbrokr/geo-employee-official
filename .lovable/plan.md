## Three fixes + GEO personality pass on the intake

### 1. Email copy from the Emails tab is ignored on real sends

**Cause:** `send-transactional-email` renders the template using only the `templateData` passed in by the caller (just `name` + `magicLink`). It never reads the `email_template_copy` row, so edits in Admin → Emails only show up in the live preview and the test send (both pass row contents in directly), not in the actual `create-client` invite.

**Fix:** In `supabase/functions/send-transactional-email/index.ts`, before rendering:
- Look up `email_template_copy` by `template_name` using the existing service-role client.
- Merge its fields (`eyebrow`, `headline`, `body_paragraphs`, `cta_label`, `signature_line_1`, `signature_line_2`) into `templateData`, letting any explicit `templateData` field win.
- If the row has a non-empty `subject`, use it as the subject (overriding the template default).
- Redeploy the function.

### 2. After "Submit Intake", the page appears stuck

Replace the silent spinner + 2.2s redirect with a GEO chat-style modal that owns the whole submit experience. This solves the "did it submit?" confusion AND delivers the AI-employee feel the user wants.

**New component: `src/components/GeoTalkingModal.tsx`**
- Centered card on a dim backdrop. White surface, ink text, hairline ink/08 border, zero radius, no shadow (per brand bible).
- Left: small GEO avatar (the existing `BrandMark` / "G" mark, ~40px square, ink background, white "G").
- Right: chat-bubble-style text area with a typing indicator (three small ink dots animating) that resolves into the message.
- Props: `open`, `messages: string[]` (sequence to type out), `onComplete?: () => void`.
- Behavior: shows "GEO" label + "thinking" state for ~1.2s, then types/reveals each message in sequence with a short pause between, then calls `onComplete`.
- Reusable so we can drop GEO in elsewhere later (post generation, change requests, etc.).

**Wire into `src/pages/Onboarding.tsx`:**
- Replace the `launching` spinner block with `GeoTalkingModal`.
- On Submit Intake click:
  1. Open the modal immediately with thinking state.
  2. In parallel, run the existing DB writes (intake_status complete, pipeline_stage = `intake_complete`) wrapped in try/catch with a toast on failure.
  3. Modal sequence (rough copy, finalized in build):
     - "Thank you. Let me read through everything you sent."
     - "Looks great. I'm sending this over to the team now."
     - "They'll have your site built within 7 days. Taking you to your portal."
  4. After the sequence completes AND the DB writes resolve, navigate to `/portal`. Drop the 2.2s `setTimeout` — sequencing is driven by the modal, not an arbitrary timer.
- Close-safety: if the user is on an admin account and `/portal` bounces, the modal still leaves them with a clear "Go to your portal" link as a fallback.

### 3. GEO personality pass on the intake itself

Make the wizard read like GEO is interviewing the agent, not a faceless form.

**Header (above the step bar in `Onboarding.tsx`):**
- Replace the standalone "GEO" wordmark with a small GEO avatar + intro line on step 0 only:
  - Avatar (same `BrandMark` "G")
  - "Hey, it's GEO."
  - Subline: "I've got a few quick questions so we can get your content engine up and running. Should take about ten minutes."
- On steps 1–4, keep a slimmer persistent header: GEO avatar + the current step's question framed as GEO speaking (see below). This keeps the AI-employee presence without crowding the form.

**Per-step question rewrites (from form-style to GEO-style first person):**
- Step 0 "Let's start with you." → "First, tell me about you."
- Step 1 "Where do you work?" → "Where are you working? Give me every area you cover — the more I have, the more content I can generate."
- Step 2 "What do you specialize in?" → "What do you specialize in? Pick everything that fits. These become the angles I write from."
- Step 3 "Your voice & story." → "Now help me sound like you. I'll use every word here when I write your posts."
- Step 4 "Make it yours." → "Last thing — what colors should I use on your site?"
- Step 5 "You're ready." → "That's everything I need."
- All copy stays within brand voice: short sentences, periods, no em dashes, no emojis, no hype words.

**Submit button label:** keep "Submit Intake" (button works as-is, modal handles the rest).

### Files touched
- `supabase/functions/send-transactional-email/index.ts` — fetch + merge `email_template_copy`, then redeploy.
- `src/components/GeoTalkingModal.tsx` — new reusable GEO-speaking modal.
- `src/pages/Onboarding.tsx` — wire the modal into submit, swap the launch screen, apply GEO-voice header + per-step copy.

No DB migrations, no new env vars, no new dependencies.