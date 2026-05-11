
CREATE OR REPLACE FUNCTION public.enqueue_post_publish_purge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _site RECORD;
  _hostname TEXT;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'published' THEN
    RETURN NEW;
  END IF;

  SELECT custom_domain, subdomain, dns_verified
    INTO _site
    FROM public.client_sites
   WHERE client_id = NEW.client_id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF _site.dns_verified AND _site.custom_domain IS NOT NULL THEN
    _hostname := _site.custom_domain;
  ELSIF _site.subdomain IS NOT NULL THEN
    _hostname := _site.subdomain || '.mygeosite.com';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.site_cache_purges (client_id, hostname, paths, purge_trigger)
  VALUES (
    NEW.client_id,
    _hostname,
    ARRAY['/', '/blog', '/blog/' || NEW.slug],
    'post_publish'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_enqueue_purge ON public.posts;
CREATE TRIGGER posts_enqueue_purge
AFTER INSERT OR UPDATE OF status ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_post_publish_purge();

CREATE OR REPLACE FUNCTION public.enqueue_markets_update_purge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _site RECORD;
  _hostname TEXT;
BEGIN
  SELECT custom_domain, subdomain, dns_verified
    INTO _site
    FROM public.client_sites
   WHERE client_id = NEW.client_id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF _site.dns_verified AND _site.custom_domain IS NOT NULL THEN
    _hostname := _site.custom_domain;
  ELSIF _site.subdomain IS NOT NULL THEN
    _hostname := _site.subdomain || '.mygeosite.com';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.site_cache_purges (client_id, hostname, paths, purge_trigger)
  VALUES (
    NEW.client_id,
    _hostname,
    ARRAY['/', '/areas'],
    'markets_updated'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_markets_enqueue_purge ON public.client_markets;
CREATE TRIGGER client_markets_enqueue_purge
AFTER INSERT OR UPDATE ON public.client_markets
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_markets_update_purge();
