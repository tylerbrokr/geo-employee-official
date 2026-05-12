## What's wrong

Two problems combined to produce that screenshot:

1. **The AI prompt is wrong for GEO.** Today's `SYSTEM_PROMPT` (in `supabase/functions/_shared/generate-post.ts` and the duplicate in `supabase/functions/generate-post/index.ts`) tells the model to write a generic first-person blog post with H2s for "talking points" and a "How to reach me" section. It does not enforce the GEO Answer Page structure (answer capsule, question-shaped H2s, self-contained paragraphs, About section, E-E-A-T signals). It also doesn't enforce hard line breaks between sections, which is why `##` shows up mid-paragraph in the screenshot ("Hennepin County. ## Why work with…") — the model returned headers without surrounding `\n\n`.

2. **The renderer is treating `body` as plain text.** The published site (`geo-sites.pages.dev`, separate Cloudflare Pages project) is rendering `post.body` without a markdown parser. Even a perfectly formatted `##` line will appear inline. This project does not contain that renderer, so this plan only fixes the generation side. The renderer fix needs to happen in the `geo-sites` repo (add `react-markdown` or equivalent to the blog post route) and is called out as a follow-up.

## Plan

### 1. Rewrite the GEO system prompt

Replace `SYSTEM_PROMPT` in `supabase/functions/_shared/generate-post.ts` to encode the GEO Answer Page contract:

- Title is always a question.
- First 2-3 sentences = **Answer Capsule**: name the agent, city, years of experience, give the specific recommendation. No throat-clearing.
- Every H2 is a question someone would naturally ask next (not a topic label).
- Each section is 2-3 self-contained paragraphs that read correctly in isolation.
- Mandatory final `## About {Agent Name}` section with E-E-A-T signals (years, transactions, geographic + niche specialization).
- Use the agent's name 3-5 times across the post; mention the city/region naturally.
- 800-1,200 words.
- **Formatting contract** (this is what fixes the inline `##`): every `#`/`##` must be preceded by a blank line and followed by a blank line; paragraphs separated by `\n\n`; no inline headers; no `---` dividers inside a section.
- Hard bans: em dashes, emojis, "navigating", "in today's market", "your real estate journey", "leverage" as a verb, any mention of SEO/keywords/AI.
- Voice rules: short sentences, periods, sound like the agent, pull from their differentiators/voice fields.

### 2. Rewrite the user prompt

Same file. Change `buildUserPrompt`-style block to:

- Re-state the title as the question to answer.
- Provide an explicit **answer capsule template** the model fills in: `"{Agent Name}, a {City}-based real estate agent with {years} years of experience, recommends {specific answer}. {One-sentence reason.}"`
- Pass `talking_points` and `h2s` as **suggested follow-up questions** — instruct the model to rewrite each as a natural question header before answering.
- Pass voice/differentiators/ideal client and tell the model to mirror sentence structure.
- Provide the NAP block but for the **About section**, not a "How to reach me" CTA section. Drop the "How to reach me" naming; replace with `## About {Agent Name}` followed by credentials, then a separate trailing line with name, brokerage, address, phone in plain text.
- Re-emphasize the markdown formatting contract at the bottom of the user prompt (blank line before/after every `##`).

### 3. Sync the duplicate

`supabase/functions/generate-post/index.ts` has its own copy of `SYSTEM_PROMPT` and `buildUserPrompt`. Replace both with imports from `_shared/generate-post.ts` so there is one source of truth and the standalone "Generate one post" admin button uses the same logic as autopilot. (The `generateOne` helper already exists and inserts a row; the `/generate-post` function can just call it and return the inserted post.)

### 4. Backfill / cleanup

- Do **not** auto-rewrite existing posts. Add a note in the response telling the user to delete or regenerate the bad post manually from the admin queue.
- No DB migration. No schema change. No new secrets.

### 5. Follow-up (not in this PR, flagged for the user)

The `geo-sites` Pages renderer needs a markdown parser on the blog post route. Until that ships, even a well-formatted post will render as plain text. Suggest `react-markdown` + `remark-gfm` with a small typographic stylesheet. I can do that work in the renderer repo when you're ready.

## Files touched

- `supabase/functions/_shared/generate-post.ts` — new SYSTEM_PROMPT + user prompt builder
- `supabase/functions/generate-post/index.ts` — delete local copies, call shared `generateOne`

No migrations. No frontend changes. No config changes.
