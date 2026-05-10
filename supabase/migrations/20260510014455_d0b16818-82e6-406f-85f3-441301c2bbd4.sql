GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.owns_client(uuid, uuid) TO authenticated, anon;