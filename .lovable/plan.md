## Two fixes for the GEO chat intake

### 1. Make GEO react less often (so it stops feeling fake)

Right now GEO posts an AI-written reaction after every single answer. Twenty in a row makes it feel performative. Cut it down so reactions land only on moments where a real teammate would actually say something.

**React on (6 out of 17 answers):**
- `years` — anchors experience ("Eight years. You know the cycles.")
- `primaryCity` — local color ("Edina. Solid market.")
- `specialties` — confirms angles for content
- `idealClient` — confirms the audience
- `brokerageStory` — natural place for a warm beat
- `accentColor` — last answer before outro, nice closing acknowledgment

**No reaction on:** name, brokerage, phone, state, cities, neighborhoods, counties, voice, values, differentiators, property types, primary color. After these, GEO just goes straight to the next question (short typing pause, then the next bubble). Feels like a focused interview, not a chatbot trying to be friendly.

Implementation: add a `reactAfter?: boolean` flag on `ScriptStep` in `script.ts`, set it true on the six steps above, and gate the `fetchReaction` call in `submitAnswer` on that flag. No other behavior change.

### 2. Fix "Take me to my portal" doing nothing

Symptom: clicking the final CTA appears to refresh and dump the user back into the chat. Cause is in the handoff between `finalize()` and `RoleGate`:

- `finalize()` upserts `intake_status.completed_at` and updates `clients.pipeline_stage`, but errors are swallowed (only `pipeline_stage` failures are caught, the `intake_status` upsert isn't checked at all). If either write silently fails, `RoleGate` re-checks `completed_at`, sees it's still null, and bounces them back to `/onboarding` — exactly what the user is seeing.
- `intake_status.upsert` uses `onConflict: "client_id"`. If the row was never created (e.g. account created outside the wizard), the upsert payload is missing required fields and the write may fail without surfacing.
- Even on success, `navigate("/portal")` is a soft client-side navigation. `RoleGate`'s effect re-runs, but if the Supabase client returns a stale value from cache the redirect logic flips back.

**Fix plan:**

1. In `finalize()`:
   - Wrap both writes in a single try/catch and surface real errors via toast. If either fails, do NOT show the CTA — show GEO saying "Something didn't save. Try again." with a retry button.
   - Await both writes before pushing the CTA bubble.
   - Re-read `intake_status` immediately after the write and verify `completed_at` is set; only then expose the CTA.
2. CTA button: replace `navigate("/portal")` with `window.location.assign("/portal")`. A full reload guarantees `RoleGate` runs against fresh data and avoids any in-memory race.
3. Add a defensive guard in `RoleGate` so that when arriving at `/portal` immediately after intake, it briefly re-fetches before redirecting back to `/onboarding` (already does this, but confirm `maybeSingle()` isn't returning a cached null).

### Files to change

- `src/components/geo-chat/script.ts` — add `reactAfter` flag on the six steps listed above.
- `src/components/geo-chat/GeoChat.tsx` — gate `fetchReaction` on `step.reactAfter`; harden `finalize()` (error surfacing, verification read); change CTA to `window.location.assign("/portal")`.

### Out of scope

- No DB schema changes.
- No changes to question copy or order.
- No change to the edit-answer flow or the AI reaction prompt itself.
