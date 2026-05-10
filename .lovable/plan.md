## Turn the intake into an iMessage-style chat with GEO

Replace the multi-step wizard at `/onboarding` with a single-thread chat. GEO (left, with the brand mark avatar) asks one question at a time. The user (right, in a filled bubble) answers via either typed text or a tappable input bubble that matches the question type. When the conversation finishes, GEO confirms and routes them to the portal.

### Look & feel (iMessage)

- Full-height white canvas, fixed 600px max-width column, centered.
- Sticky top bar: small GEO avatar (BrandMark on ink square), name "GEO", caption "Your AI employee" + subtle online dot. Hairline ink/08 border below. No gradients.
- Scrollable transcript fills the middle.
  - GEO bubbles: left-aligned, off-white (#faf8f4) fill, ink text, no radius (per brand bible — iMessage shape can be approximated with subtle squared bubbles to stay on-brand).
  - User bubbles: right-aligned, ink fill, white text. Same squared shape.
  - Each bubble shows a small timestamp on hover.
  - Day separator at the top: "Today" in ink/40 caps.
- Typing indicator: small GEO bubble with three animated dots before each new question.
- Sticky bottom composer: text input + send button (ink background, white arrow). Disabled when the active question expects a non-text input.

### Conversation flow (scripted order, hybrid AI reactions)

The script keeps the existing intake fields. Each step is one or more chat turns. GEO question → user answer bubble → optional GEO reaction (AI-written) → next question.

1. Intro (no answer): "Hey, it's GEO. I'm the AI on your team. Going to ask you a few quick things so I can build your content engine. Should take about ten minutes."
2. Name → text input.
3. Brokerage → text input.
4. Phone → text input (tel keyboard on mobile).
5. Years in real estate → chip-bubble (single select: the existing 5 options).
6. Primary city → text input.
7. State → searchable chip list bubble (50 states).
8. Surrounding cities → tag-bubble (add chips, "Done" button to send).
9. Neighborhoods → tag-bubble.
10. Counties → tag-bubble.
11. Specialties → multi-select chip bubble (existing 10 options).
12. Voice → multi-line text input.
13. Values → multi-line text.
14. Ideal client → multi-line text.
15. Brokerage story → multi-line text.
16. Differentiators → multi-line text.
17. Property types → multi-select chip bubble.
18. Primary color → color swatch bubble (preset palette + custom hex).
19. Accent color → same.
20. Outro: GEO summarizes ("Got it. Pemberton Real Estate, Edina, MN. Luxury, new construction, seller rep."), then "Sending this to the team. Your site will be ready within 7 days." → button bubble "Take me to my portal" → navigate to `/portal`.

After most user answers, GEO posts a short AI-generated reaction (1 short sentence, brand voice) before the next question. Step 1 (intro), tag-input steps mid-add, and the outro use scripted lines instead.

### Inline interactive bubbles

Each question type renders the same bubble shell with the right control inside:
- `text` / `textarea` → composer accepts free text. Composer placeholder shows GEO's hint ("Type your full name").
- `single-chip` → composer hides; chips render in a bubble below the question. Tap = answer.
- `multi-chip` → chips render with a "Done" button at the bottom of the bubble. Tap toggles, "Done" sends.
- `tag-input` → small input + add button inside a bubble; chips accumulate; "Done" sends the array.
- `color` → preset swatches + a "Custom" tile that opens the native color input; "Done" sends.
- `state-select` → searchable chip list (typeahead filter inside the bubble).
- `cta` → a single tappable button bubble (used for the final "Take me to my portal").

### Editing answers (tap to edit)

- Every user bubble has a small pencil icon on hover. Tap → bubble flips into edit mode (same control as the original question). Saving replaces the bubble in place and updates persistence.
- GEO does not re-ask. We only add a one-time small ink/40 line under the edited bubble: "Updated."
- Edits never rewind the conversation. The user keeps their place at whatever question they were on.

### Persistence

Reuse the existing tables (`profiles`, `clients`, `client_markets`, `client_specialties`, `intake_status`). No schema changes.

- On every answer, write that field (same mapping the wizard already uses).
- Resume on reload: load all existing values, replay them as completed user bubbles in the transcript, set the active question to the first unanswered field. `intake_status.current_step` is repurposed to store the active question index (1..N). Existing rows are backward-compatible because the mapping starts at the same fields.
- Submit: set `intake_status.completed_at` and `clients.pipeline_stage = 'intake_complete'`, then navigate.

### Hybrid AI: GEO's reactions

New edge function `geo-react`:
- Input: `{ field: string, answer: string|string[], context: { name?, primaryCity?, state?, brokerage? } }`.
- Calls Lovable AI Gateway, model `google/gemini-3-flash-preview`, with a tight system prompt enforcing: 1 sentence, max 14 words, brand voice (no em dashes, no emojis, no hype, no forbidden words). Returns `{ reaction: string }`.
- Client calls it after each answer; while waiting it shows the typing indicator. If the function fails or times out (>2.5s), fall back to a small scripted reaction per field so the chat never stalls.
- Auth: requires the user JWT (verify_jwt true). LOVABLE_API_KEY already provisioned.

### File plan

New:
- `src/components/geo-chat/GeoChat.tsx` — main controller (state, persistence, scrolling, sending).
- `src/components/geo-chat/script.ts` — ordered question list with type, label, hint, persist mapping, fallback reaction.
- `src/components/geo-chat/Bubble.tsx` — GEO + user bubble shells, timestamps, edit affordance.
- `src/components/geo-chat/TypingDots.tsx`.
- `src/components/geo-chat/inputs/` — `TextInput`, `SingleChip`, `MultiChip`, `TagInput`, `ColorPicker`, `StateSelect`, `CtaButton`.
- `src/components/geo-chat/useChatPersistence.ts` — load existing data, write per-field, advance `current_step`.
- `supabase/functions/geo-react/index.ts` — AI reaction endpoint.

Updated:
- `src/pages/Onboarding.tsx` — strip the wizard, render `<GeoChat />` full-screen. Keep the existing GEO submit modal at the very end (or replace it with a final in-chat sequence — the chat already covers it, so we'll drop the modal).
- `src/components/GeoTalkingModal.tsx` — kept (still useful for other flows like change requests).

### Mobile

- Same column at full width. Composer locks to the bottom (sticky, with safe-area padding). Bubbles stack tightly with 8px gaps. Tappable chips minimum 36px tall. Input scrolls into view above the keyboard.

### Out of scope (call out, don't build now)

- Voice input / dictation.
- File uploads (headshot, logo) — current intake doesn't ask for them; if added later, will become an attachment bubble.
- Branching conversations based on AI judgment of answers.
- Server-side moderation of free-text answers.