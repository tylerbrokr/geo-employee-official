CREATE OR REPLACE VIEW public.public_client_site AS
SELECT
  client_id,
  subdomain,
  custom_domain,
  ssl_status,
  provisioned_at,
  agent_display_name,
  indexnow_key
FROM public.client_sites
WHERE dns_verified = true;