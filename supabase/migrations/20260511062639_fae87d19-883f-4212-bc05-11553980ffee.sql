-- One-off rename of the test client Tyler Lewis
DO $$
DECLARE
  _client_id uuid := '11c267fa-b3ac-4b4c-9415-f0882d8a14bd';
  _old_sub text;
BEGIN
  SELECT subdomain INTO _old_sub FROM public.client_sites WHERE client_id = _client_id;

  UPDATE public.client_sites
     SET subdomain = 'tyler-lewis'
   WHERE client_id = _client_id;

  IF _old_sub IS NOT NULL AND _old_sub <> 'tyler-lewis' THEN
    INSERT INTO public.site_cache_purges (client_id, hostname, paths, purge_trigger)
    VALUES (_client_id, _old_sub || '.mygeosite.com', ARRAY['/'], 'manual');
  END IF;

  INSERT INTO public.site_cache_purges (client_id, hostname, paths, purge_trigger)
  VALUES (_client_id, 'tyler-lewis.mygeosite.com', ARRAY['/'], 'manual');
END $$;