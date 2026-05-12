## Fix — generated posts must be third-person ABOUT the agent, not first-person AS the agent

The current `SYSTEM_PROMPT` and user prompt in `supabase/functions/_shared/generate-post.ts` instruct the model to "write in first person AS the agent" and to fill an answer capsule that uses "I". That's wrong for GEO citation: AI assistants cite third-party authority signals more readily than self-promotional first-person posts, and the format spec the user provided is explicit ("[Client Name], a [city]-based realtor with [X] years of experience, recommends [specific answer]").

### Changes to `supabase/functions/_shared/generate-post.ts`

1. **System prompt rewrite** — replace the voice rules:
   - Remove: "Write in first person AS the agent. Use I/me/my."
   - Add: "Write in third person ABOUT the agent. Refer to them by full name on first mention, then last name, first name, or 'they' on subsequent mentions. Never use I, me, my, we, our, or us. The narrator is a knowledgeable third party (think: a credible local guide or analyst) describing what this specific agent recommends and why."
   - Update the agent-name guidance: "Use the agent's name 4-6 times across the page (full name once at the top of the answer capsule and About section, then last name or first name elsewhere)."
   - Replace "Mirror the agent's voice from the brief" with: "When quoting the agent's perspective or recommendation, you may use a brief direct quote (one sentence in quotation marks). Otherwise stay in third-person narrator voice."

2. **Answer capsule template rewrite** in `buildUserPrompt`:
   - Old: implicit first-person via "Write in first person AS the agent"
   - New explicit third-person template:
     ```
     "{Agent Name}, a {city}-based real estate agent with {years} years of experience at {brokerage}, recommends {specific answer}. {One sentence on WHY in third person — concrete reason.} {Optional third sentence with a specific data point, named neighborhood, price band, or school district.}"
     ```

3. **About section rewrite**:
   - Currently positioned as the agent talking about themselves with a "How to reach me" CTA stripped out.
   - New: `## About {Agent Name}` is third-person bio (2-3 sentences). Same E-E-A-T signals (years, brokerage, geographic specialization, ideal client). Then the contact block on its own lines as before.

4. **Banned-language list update**:
   - Add to the hard-bans: "I", "me", "my", "we", "our", "us" (when referring to the agent or their business). Also ban "as your agent", "let me", "I'd love to", "reach out to me", "contact me directly", "I am here to help".
   - Keep all existing bans (em dashes, emojis, SEO/keywords/AI, "in today's market", etc.).

5. **Re-emphasize at the bottom of the user prompt**: "Third-person only. The narrator is NOT {Agent Name}. Never write 'I', 'me', 'my', 'we', or 'our'. Refer to {Agent Name} by name and 'they/them'."

### Files touched

- `supabase/functions/_shared/generate-post.ts` — system prompt + `buildUserPrompt`. One file. No DB migration. No frontend changes. No other edge functions need editing because `generate-post`, `autopilot-generate`, and `autopilot-tick` already share this single source.

### Backfill

The existing first-person posts in the DB will not be auto-rewritten. Delete them from the admin Post Editor (the new Delete button you have now) and regenerate from the topic queue.
