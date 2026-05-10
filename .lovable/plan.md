## Plan

1. Restore the app email infrastructure
   - Run the built-in Lovable email setup so the required email queue tables, queue helpers, and scheduled email processor exist again.
   - Confirm the verified sender domain remains `notify.geoemployee.com`.

2. Fix the internal send call
   - Update `create-client` so it calls the app email function with a gateway-valid token instead of the service-role token that is currently being rejected as an invalid JWT.
   - Keep admin validation inside `create-client`, so only admins can trigger this invite through client creation.
   - Keep `{name}` personalization mapped to the client's first name.

3. Deploy and verify
   - Redeploy the changed edge function.
   - Test creating or resending a client invite.
   - Verify the response returns `email_sent: true` and the email log shows the invite moved into the send pipeline.

## Technical notes

- The domain is verified, so DNS is not the blocker.
- The latest create-client response shows the app email function returned `401 Invalid JWT`.
- The database is also missing the required app email queue/log tables, so both the authentication path and email infrastructure need to be corrected.