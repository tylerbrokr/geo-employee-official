## Goal

Move the intake-invite email copy out of the React Email file and into a database-backed editor at `/admin/emails`, so you can edit headline, body, CTA label, and signature without code changes.

## What changes

### 1. New database table: `email_template_copy`

Stores editable copy for each transactional template. One row per template name.

| Column | Type | Notes |
|---|---|---|
| `template_name` | text, PK | e.g. `client-intake-invite` |
| `subject` | text | Email subject line |
| `eyebrow` | text | Small label above headline (e.g. `THE INNER CIRQL · GEO`) |
| `headline` | text | Big Cormorant headline. Supports `{name}` token. |
| `body_paragraphs` | text[] | Array of paragraphs (each a body block) |
| `cta_label` | text | Button text (e.g. `Open the intake`) |
| `signature_line_1` | text | e.g. `The GEO team` |
| `signature_line_2` | text | e.g. `The Inner Cirql` |
| `updated_at` | timestamptz | |
| `updated_by` | uuid | references auth user |

Seed it with the current intake-invite copy so nothing changes for clients.

**RLS:** admins can SELECT and UPDATE. No one else can read or write.

### 2. Edge function reads from DB

Update `client-intake-invite.tsx` to accept all copy as props. Update `send-transactional-email` (or a small shim) to fetch the row from `email_template_copy` before rendering, fill in `{name}` token, and pass everything as props. If the row is missing, fall back to baked-in defaults so sends never break.

### 3. New admin page: `/admin/emails`

Sidebar entry under Admin nav: **Emails**. Page shows:

- **Left column** — form fields for the intake-invite template:
  - Subject (input)
  - Eyebrow (input)
  - Headline (input, with `{name}` token helper text)
  - Body paragraphs (list of textareas, add/remove rows)
  - CTA label (input)
  - Signature line 1 + line 2 (inputs)
  - Save button (saves to `email_template_copy`)
- **Right column** — live preview rendered by calling `preview-transactional-email` (already deployed) with the current form state. Refreshes on save or on a "Preview" button click.
- Header strip: template name, last updated timestamp + admin name.
- Send-test-email button: pops a small input for an address, fires `send-transactional-email` with `templateName: 'client-intake-invite'` and `templateData: { name: 'Test', magicLink: 'https://www.geoemployee.com/onboarding?token=preview' }`.

Branded per Inner Cirql: white canvas, hairline ink-08 borders, gold save button, Cormorant page title.

### 4. Sidebar nav

Add **Emails** entry to `AppSidebar.tsx` under the admin section, between Change Requests and any settings entry. Icon: `Mail`.

## Files touched

- New migration: create `email_template_copy` table, RLS, seed row
- New: `src/pages/admin/Emails.tsx`
- Edited: `src/App.tsx` (add `/admin/emails` route)
- Edited: `src/components/AppSidebar.tsx` (nav entry)
- Edited: `supabase/functions/send-transactional-email/index.ts` (fetch copy from DB before render)
- Edited: `supabase/functions/_shared/transactional-email-templates/client-intake-invite.tsx` (accept full copy as props, keep current values as fallbacks)
- Redeploy: `send-transactional-email`

## Out of scope (call out for later)

- Editing the visual layout (gold dots, button color, fonts) — those stay in code as brand
- Other templates (post-published, change-request ack) — easy to add later by inserting a new row + new template file
- Version history / drafts of copy — single live row only for now
- A/B testing
