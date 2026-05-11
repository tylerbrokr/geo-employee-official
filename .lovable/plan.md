
# GEO-only topic and post generation

Strip out every "SEO blog post" assumption. Topics are no longer AI-invented — they are deterministically enumerated from the client's areas crossed with a fixed GEO question bank. Each post body is still AI-written, but with a new system prompt that produces the answer a knowledgeable local agent would give to a direct LLM query, not a keyword-stuffed SEO post.

## 1. The GEO question bank (built-in, fixed)

These ten templates ship in code. `{area}` is filled with a city, neighborhood, or county name. No "SEO" patterns, no comparison queries, no listicles.

```
1.  Best real estate agent in {area}
2.  What is the housing market like in {area}
3.  Is {area} a good place to buy a home
4.  What to know about buying a home in {area}
5.  Most desirable neighborhoods in {area}
6.  What homes cost in {area}
7.  First-time homebuyer guide to {area}
8.  Selling a home in {area} — what to expect
9.  Investment properties in {area}
10. Relocating to {area} — real estate guide
```

Seasonal layer (used only after the base set is exhausted, see §4):
```
- {area} spring real estate market
- {area} summer housing trends
- {area} fall buyer's guide
- {area} winter market outlook
```

## 2. Rewrite `generate-master-topics`

Replace the AI call entirely with code that enumerates `client_markets.cities ∪ neighborhoods ∪ counties ∪ [primary_city]` × the 10 templates above.

For each combination, write a `client_topics` row with:
- `kind: 'geo'` (always — the `seo` value is no longer used by code, but stays in the enum so old rows don't break)
- `title:` rendered template
- `primary_keyword:` `"{template root} {area}"` (e.g. `"best real estate agent edina mn"`)
- `geo_scope:` the area name
- `niche: null`
- `talking_points:` a fixed 5-bullet checklist for that template (e.g. for "Best real estate agent in {area}" → "Why hire a local agent", "What sets {agent name} apart", "{agent name}'s {area} experience", "Recent {area} transactions / specialties", "How to start working together")
- `h2s:` 4 question-style H2s derived from the template
- `word_count: 800`
- `status: 'queued'`
- `position:` sequential

Auto-delete behavior: when called from the admin button, first `DELETE FROM client_topics WHERE client_id = $1 AND status = 'queued'`. Used/skipped rows are preserved.

The function still flips `clients.pipeline_stage` to `topics_ready` on first generation. The admin-vs-service-role check stays.

The body now accepts `{ client_id, replenish? }`. The `count` parameter is ignored — the count is fully determined by `areas × templates`.

## 3. Rewrite `generate-post` and `autopilot-tick` system prompts

Both functions today share an "SEO/GEO content writer" framing with H2/H3 outline structure and "~700-900 words." Replace with a single shared GEO prompt:

> You are a real estate agent writing a direct, first-person answer to a question someone asked an AI assistant. Your job is to be the source the AI cites.
> Rules:
> - First 2 sentences must directly answer the question. No throat-clearing.
> - Write as the agent (first person). Name yourself, your brokerage, and the place repeatedly and naturally.
> - Cover every talking point with a short H2 section.
> - Mention specific neighborhoods, school districts, price bands, and recent local context where relevant.
> - End with a short "How to reach me" section that lists the agent's NAP plain-text (no contact form language).
> - 700-900 words. No fluff, no hedging, no emojis, no em dashes.
> - Do not mention "SEO," "keywords," "search engines," or "AI." Just answer the question.

The user prompt for both functions adds: agent NAP fields (`street_address`, `city`, `state`, `phone_e164`), so they can be cited verbatim in the answer.

Drop the "Why work with [agent name]" canned section — the system prompt's "How to reach me" replaces it.

Drop the random `kind: seo` branch in `generate-post`. All posts are GEO.

## 4. Replenish + seasonal cycling (`autopilot-tick`)

Today's replenish path re-invokes `generate-master-topics` when queued < 4. With deterministic enumeration, the first replenish will produce zero new topics (already exhausted). Two-step fallback inside the topic generator:

1. Re-enumerate the base 10 templates × all areas. Skip any title that already exists in `client_topics` (any status). If anything new lands, insert it.
2. If still zero, enumerate the seasonal layer × all areas, scoped to the current season (Northern Hemisphere mapping by month). Skip duplicates. Insert.
3. If still zero (full saturation), do nothing — the autopilot run logs `replenished: false` and the queue stays at zero until next season rolls over.

This means a client with 3 cities and 2 counties produces 50 base topics, then up to 20 seasonal topics per year — roughly a year of weekly posts before any repetition. Plenty of runway for v1.

## 5. Admin UI (small change to `ClientDetail.tsx` Topics tab)

- The "Generate Master Topics" / "Generate more" button copy stays.
- Add a confirm dialog: "This will delete all queued topics and rebuild the list from your areas. Used and skipped topics are kept. Continue?"
- Remove the `kind` column from the topics table since everything is now `geo`. Replace with a simple `geo_scope` cell so the admin can see which area the topic targets.

Nothing else changes — edit-in-place, status dropdown, delete, position ordering all stay.

## Out of scope (intentionally)

- Per-client custom qualifier list. We're shipping the built-in 10 + 4 seasonal. Custom lists can be a v2 if any agent's market doesn't fit.
- Auto-regenerating post titles when an area name changes (the canonicalization migration already handles `client_areas` slug changes; topics with a stale area name are minor and will be replaced on next regenerate).
- A "Generate first post immediately on Go Live" button — separate question, can be addressed after this lands.

## Files touched

- `supabase/functions/generate-master-topics/index.ts` — full rewrite, no AI call
- `supabase/functions/generate-post/index.ts` — system prompt + drop seo branch + add NAP context
- `supabase/functions/autopilot-tick/index.ts` — system prompt + add NAP context
- `src/pages/admin/ClientDetail.tsx` — confirm dialog on regenerate, drop kind column

No DB migration required — schema already supports everything.
