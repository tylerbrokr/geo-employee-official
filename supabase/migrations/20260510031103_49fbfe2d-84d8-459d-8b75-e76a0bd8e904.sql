-- Update handle_new_user trigger: only create clients row if user is not an admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Default role: client (admins are granted manually afterward)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT DO NOTHING;

  -- Only auto-create a clients row when this user is actually a client
  IF NOT public.has_role(NEW.id, 'admin'::app_role) THEN
    INSERT INTO public.clients (owner_user_id)
    VALUES (NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Cleanup: delete stray client rows belonging to admin users
DELETE FROM public.clients
WHERE owner_user_id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
);

-- Enable extensions for scheduled autopilot
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;