-- =========================================================
-- Phase 1, Half A: public read surface for geo-sites repo
-- =========================================================

-- ---------- public_client_profile ----------
-- Safe agent/brand fields only. No email, phone, owner_user_id,
-- pipeline_stage, autopilot_*, last_autopublish_at.
CREATE OR REPLACE VIEW public.public_client_profile
WITH (security_invoker = false) AS
SELECT
  c.id            AS client_id,
  c.business_name,
  c.brokerage,
  c.years_experience,
  c.headshot_url,
  c.logo_url,
  c.primary_color,
  c.accent_color,
  c.voice,
  c.values_text,
  c.ideal_client,
  c.brokerage_story,
  c.differentiators,
  c.property_types
FROM public.clients c
JOIN public.client_sites s ON s.client_id = c.id
WHERE s.dns_verified = true;

-- ---------- public_client_site ----------
-- Hostname routing data. No verification_token, no cf hostname id,
-- no verify_attempts, no dns_records.
CREATE OR REPLACE VIEW public.public_client_site
WITH (security_invoker = false) AS
SELECT
  s.client_id,
  s.subdomain,
  s.custom_domain,
  s.ssl_status,
  s.provisioned_at
FROM public.client_sites s
WHERE s.dns_verified = true;

-- ---------- public_client_market ----------
CREATE OR REPLACE VIEW public.public_client_market
WITH (security_invoker = false) AS
SELECT
  m.client_id,
  m.primary_city,
  m.primary_state,
  m.cities,
  m.counties,
  m.neighborhoods
FROM public.client_markets m
JOIN public.client_sites s ON s.client_id = m.client_id
WHERE s.dns_verified = true;

-- Grants for anon + authenticated
GRANT SELECT ON public.public_client_profile TO anon, authenticated;
GRANT SELECT ON public.public_client_site    TO anon, authenticated;
GRANT SELECT ON public.public_client_market  TO anon, authenticated;

-- ---------- anon SELECT on posts (published only) ----------
-- client_id scoping is enforced at the application layer in geo-sites.
CREATE POLICY "Anyone can read published posts"
ON public.posts
FOR SELECT
TO anon
USING (status = 'published');
