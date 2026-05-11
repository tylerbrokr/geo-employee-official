CREATE OR REPLACE VIEW public.public_client_site
WITH (security_invoker=on) AS
SELECT
  client_id,
  subdomain,
  custom_domain,
  ssl_status,
  provisioned_at,
  agent_display_name
FROM public.client_sites
WHERE dns_verified = true;

CREATE OR REPLACE VIEW public.public_site_copy
WITH (security_invoker=on) AS
SELECT
  sc.client_id,
  sc.tagline,
  sc.bio_short,
  sc.bio_long,
  sc.ideal_client_blurb,
  sc.area_blurb,
  sc.meta_title,
  sc.meta_description
FROM public.site_copy sc
JOIN public.client_sites s ON s.client_id = sc.client_id
WHERE s.dns_verified = true;

GRANT SELECT ON public.public_client_site TO anon, authenticated;
GRANT SELECT ON public.public_site_copy TO anon, authenticated;

CREATE POLICY "Anon read site_copy for live sites"
ON public.site_copy
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_sites s
    WHERE s.client_id = site_copy.client_id
      AND s.dns_verified = true
  )
);

CREATE POLICY "Anon read client_sites for live sites"
ON public.client_sites
FOR SELECT
TO anon
USING (dns_verified = true);