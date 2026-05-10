## Problem

When an admin creates a client, `create-client` enqueues an intake-invite email by invoking `send-transactional-email`. Edge logs show that call returning **401** from the Supabase gateway, so no email is ever enqueued or sent.

Root cause: `admin.functions.invoke(...)` from inside the edge function does not set an `Authorization: Bearer <jwt>` header — it only sends `apikey`. Since `send-transactional-email` has `verify_jwt = true`, the gateway rejects the request before our code runs.

## Fix

In `supabase/functions/create-client/index.ts`, replace the `admin.functions.invoke('send-transactional-email', ...)` call with a direct `fetch` to the function URL that explicitly sets:

- `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
- `apikey: ${SUPABASE_SERVICE_ROLE_KEY}`
- `Content-Type: application/json`

Capture non-2xx responses into `email_error` (with status + body text) so future failures are diagnosable from the JSON the admin UI already shows.

Then redeploy `create-client`.

## Verification

1. From the admin UI, create another test client.
2. Confirm the response payload shows `email_sent: true` and no `email_error`.
3. Check edge logs for `send-transactional-email` — should now show 200.
4. Check `email_send_log` for a row with `template_name = 'client-intake-invite'` for the recipient.

## Out of scope

- Email template copy (already editable at `/admin/emails`)
- Any UI changes
- Touching `send-transactional-email` itself or its `verify_jwt` setting
