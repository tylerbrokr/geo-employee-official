-- client_sites: drop unused column, add CF hostname tracking
ALTER TABLE public.client_sites DROP COLUMN IF EXISTS vercel_domain_id;

ALTER TABLE public.client_sites
  ADD COLUMN IF NOT EXISTS verification_token text,
  ADD COLUMN IF NOT EXISTS cloudflare_hostname_id text,
  ADD COLUMN IF NOT EXISTS ssl_status text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verify_attempts integer NOT NULL DEFAULT 0;

-- Validation trigger for ssl_status (avoids CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_client_sites_ssl_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ssl_status IS NOT NULL
     AND NEW.ssl_status NOT IN ('pending', 'active', 'failed') THEN
    RAISE EXCEPTION 'invalid ssl_status: %', NEW.ssl_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_client_sites_ssl_status ON public.client_sites;
CREATE TRIGGER validate_client_sites_ssl_status
  BEFORE INSERT OR UPDATE ON public.client_sites
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_sites_ssl_status();

-- Hot-path indexes
CREATE INDEX IF NOT EXISTS idx_client_sites_custom_domain
  ON public.client_sites (custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_sites_subdomain
  ON public.client_sites (subdomain) WHERE subdomain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_sites_cf_hostname_id
  ON public.client_sites (cloudflare_hostname_id) WHERE cloudflare_hostname_id IS NOT NULL;

-- site_cache_purges audit table
CREATE TABLE IF NOT EXISTS public.site_cache_purges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  hostname text NOT NULL,
  paths text[] NOT NULL DEFAULT '{}',
  purge_trigger text NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_cache_purges_client
  ON public.site_cache_purges (client_id);
CREATE INDEX IF NOT EXISTS idx_site_cache_purges_status
  ON public.site_cache_purges (status, updated_at);

-- Validation trigger for status + purge_trigger
CREATE OR REPLACE FUNCTION public.validate_site_cache_purges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'success', 'failed', 'dead') THEN
    RAISE EXCEPTION 'invalid status: %', NEW.status;
  END IF;
  IF NEW.purge_trigger NOT IN ('post_publish', 'markets_updated', 'manual') THEN
    RAISE EXCEPTION 'invalid purge_trigger: %', NEW.purge_trigger;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_site_cache_purges ON public.site_cache_purges;
CREATE TRIGGER validate_site_cache_purges
  BEFORE INSERT OR UPDATE ON public.site_cache_purges
  FOR EACH ROW EXECUTE FUNCTION public.validate_site_cache_purges();

DROP TRIGGER IF EXISTS site_cache_purges_updated_at ON public.site_cache_purges;
CREATE TRIGGER site_cache_purges_updated_at
  BEFORE UPDATE ON public.site_cache_purges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.site_cache_purges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cache purges"
  ON public.site_cache_purges
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients view own cache purges"
  ON public.site_cache_purges
  FOR SELECT
  USING (owns_client(auth.uid(), client_id) OR has_role(auth.uid(), 'admin'::app_role));