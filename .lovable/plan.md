
# Site copy: agent-first header + AI-curated strings

Two problems on the live site (`site.mygeosite.com`):
1. Header shows the brokerage. It should show the agent's name, with the brokerage demoted to a subhead.
2. Raw intake answers (e.g. "My ideal client is are middle class families...") are being pasted directly under the header. Intake answers are *prompts for the AI*, not site copy.

Fix both, and set up the pattern we'll reuse for area pages, post intros, and meta descriptions later.

---

## 1. Header contract (data side only)

The Pages renderer already pulls from our DB. We just need to give it the right fields and the right order. No new agent-name field — we'll use `profiles.full_name` (your call).

What the Pages site should render:

```text
EYEBROW   →  client_markets.primary_city, primary_state
H1        →  profiles.full_name        (agent)
SUBHEAD   →  clients.brokerage         (brokerage)
TAGLINE   →  site_copy.tagline         (AI-curated, see §2)
```

Action on our side: expose `profiles.full_name` to the Pages site. Two clean options — we'll go with **(a)** because it keeps the Pages query simple and lets admins override later without touching auth.

(a) Add a denormalized read column on `client_sites`:
- `agent_display_name TEXT` — populated on provision from `profiles.full_name`, refreshed whenever copy regenerates. Pages reads `client_sites` already, so no new join.

## 2. AI-curated site copy

New table `site_copy` (one row per client, per-field editable):

```text
site_copy
├── client_id (PK, FK clients)
├── tagline           text   ← short line under the H1 (replaces the raw "ideal client" dump)
├── bio_short         text   ← 1–2 sentence intro for hero / cards
├── bio_long          text   ← about-page paragraph
├── ideal_client_blurb text  ← cleaned version of the intake answer
├── area_blurb        text   ← intro for /areas page (uses markets + specialties)
├── meta_title        text
├── meta_description  text
├── ai_generated_at   timestamptz
├── ai_model          text
├── manually_edited   jsonb  ← { tagline: true, bio_short: false, ... } — protects hand edits from being overwritten on auto-regen
└── stale             boolean ← set true when intake/markets change, cleared after regen
```

RLS: clients can SELECT their own row, admins manage all. Pages renderer reads via service-role on the geo-sites side (already how `client_sites` is read).

## 3. Edge function: `generate-site-copy`

Inputs: `client_id`.
Reads: `clients` (voice, values_text, ideal_client, brokerage_story, differentiators, property_types), `client_markets`, `client_specialties`, `profiles.full_name`.
Calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with structured output (Zod) that produces the seven copy fields above.

Rules in the system prompt:
- Voice: warm, professional, story-first, no hype, no emojis, no em dashes, periods over commas. (Same Inner Cirql voice rules already in memory.)
- Never quote intake answers verbatim.
- Address the agent in third person on the public site ("Sarah works with…"), not first person.
- Keep `tagline` under ~80 chars; `bio_short` under ~240; `meta_description` under 160.

Behavior:
- Skips any field where `manually_edited[field] = true`.
- Writes `ai_generated_at`, `ai_model`, sets `stale=false`.
- Also refreshes `client_sites.agent_display_name` from current `profiles.full_name`.
- Enqueues a `site_cache_purges` row (`purge_trigger='manual'`, paths `['/']`) so the Pages site re-renders.

## 4. Auto-regeneration on intake/market change

Triggers (DB):
- `clients` UPDATE of relevant fields (`business_name`, `voice`, `values_text`, `ideal_client`, `brokerage_story`, `differentiators`, `property_types`) → set `site_copy.stale = true`.
- `client_markets` INSERT/UPDATE → set stale.
- `client_specialties` INSERT/DELETE → set stale.
- `profiles` UPDATE of `full_name` → set stale.

The triggers don't call AI directly (DB triggers can't reliably call edge functions across all envs). Instead, a **cron job every 2 minutes** scans for `site_copy.stale = true` rows and invokes `generate-site-copy` for each. Same pattern as `verify-domains` and `purge-site-cache`. Cheap (one row per stale client, debounced naturally by the cron tick).

On first site provision, `provision-site` also creates the `site_copy` row with `stale=true` so the next cron tick generates initial copy.

## 5. Admin UI: per-field copy editor

New tab on `/admin/clients/:id` → **"Site copy"** (sits next to the existing Domain tab).

Per-field rows, each with:
- Label + character count
- Textarea with current value
- "AI" badge if not manually edited, "Edited" badge if it is
- "Regenerate this field" button (calls function with `only_field` param)
- Save (writes value, sets `manually_edited[field]=true`)
- "Reset to AI" (clears `manually_edited[field]`, regenerates)

Header of the tab:
- "Last generated: 2 min ago · gemini-3-flash"
- "Regenerate all" button (ignores `manually_edited`, asks for confirmation)
- Stale indicator: "Intake updated. New copy generating…" when `stale=true`

Saving any field enqueues a cache purge for `/`.

## 6. What the Pages renderer needs to change (separate repo, your side)

For coordination — not done in this plan, but documenting the contract:
- Replace `business_name` H1 with `agent_display_name` from `client_sites`.
- Render `clients.brokerage` as subhead.
- Replace the raw `ideal_client` block with `site_copy.tagline` (under header) and `site_copy.bio_short` (in any intro section).
- Use `site_copy.meta_title` / `meta_description` for `<head>`.

---

## Out of scope (next phase)

- Per-area pages (`/areas/[city]`) — `area_blurb` is generated now so it's ready when we build them.
- Per-post intros / SEO meta on blog posts.
- Editable hero image / agent headshot crop.

## Technical notes

- Migration: new `site_copy` table + RLS + validation trigger for required-string fields; new `agent_display_name` column on `client_sites`; four staleness triggers.
- New edge function `generate-site-copy` (structured output via AI SDK `Output.object`, supports optional `only_field` param).
- New cron job `regenerate-site-copy-every-2min` (insert via DB tools, not migration, since it embeds the anon key).
- `provision-site` updated to seed `site_copy` row + `agent_display_name`.
- Admin UI: new `SiteCopyTab.tsx` mounted in `ClientDetail.tsx`.
- No changes to client portal beyond what already exists; the portal stays read-only.
