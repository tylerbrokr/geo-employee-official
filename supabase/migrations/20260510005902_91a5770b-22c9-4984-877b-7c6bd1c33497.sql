
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'client');

-- Site status enum
CREATE TYPE public.site_status AS ENUM ('pending', 'building', 'live');

-- Post status enum
CREATE TYPE public.post_status AS ENUM ('draft', 'pending_review', 'scheduled', 'published');

-- Change request status enum
CREATE TYPE public.change_request_status AS ENUM ('open', 'in_progress', 'resolved');

-- Change request category enum
CREATE TYPE public.change_request_category AS ENUM ('market', 'specialty', 'brand', 'profile', 'other');

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  brokerage TEXT,
  years_experience TEXT,
  phone TEXT,
  headshot_url TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#059669',
  accent_color TEXT DEFAULT '#0F172A',
  site_url TEXT,
  site_status public.site_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Client markets
CREATE TABLE public.client_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  primary_city TEXT,
  primary_state TEXT,
  cities TEXT[] NOT NULL DEFAULT '{}',
  neighborhoods TEXT[] NOT NULL DEFAULT '{}',
  counties TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_markets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_client_markets_updated_at BEFORE UPDATE ON public.client_markets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Client specialties
CREATE TABLE public.client_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  specialty TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, specialty)
);
ALTER TABLE public.client_specialties ENABLE ROW LEVEL SECURITY;

-- Intake status
CREATE TABLE public.intake_status (
  client_id UUID PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  current_step INT NOT NULL DEFAULT 1,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.intake_status ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_intake_status_updated_at BEFORE UPDATE ON public.intake_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  tag TEXT,
  target_keyword TEXT,
  status public.post_status NOT NULL DEFAULT 'draft',
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_client_status ON public.posts(client_id, status);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Change requests
CREATE TABLE public.change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category public.change_request_category NOT NULL,
  message TEXT NOT NULL,
  status public.change_request_status NOT NULL DEFAULT 'open',
  admin_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_change_requests_client_status ON public.change_requests(client_id, status);
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;

-- Helper to check client ownership without recursion
CREATE OR REPLACE FUNCTION public.owns_client(_user_id UUID, _client_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = _client_id AND owner_user_id = _user_id
  )
$$;

-- ===== RLS POLICIES =====

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- clients
CREATE POLICY "Clients view own row" ON public.clients
  FOR SELECT USING (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Clients update own row" ON public.clients
  FOR UPDATE USING (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert clients" ON public.clients
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = owner_user_id);
CREATE POLICY "Admins delete clients" ON public.clients
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- client_markets
CREATE POLICY "View own market" ON public.client_markets
  FOR SELECT USING (public.owns_client(auth.uid(), client_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own market" ON public.client_markets
  FOR INSERT WITH CHECK (public.owns_client(auth.uid(), client_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Update own market" ON public.client_markets
  FOR UPDATE USING (public.owns_client(auth.uid(), client_id) OR public.has_role(auth.uid(), 'admin'));

-- client_specialties
CREATE POLICY "View own specialties" ON public.client_specialties
  FOR SELECT USING (public.owns_client(auth.uid(), client_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own specialties" ON public.client_specialties
  FOR INSERT WITH CHECK (public.owns_client(auth.uid(), client_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Delete own specialties" ON public.client_specialties
  FOR DELETE USING (public.owns_client(auth.uid(), client_id) OR public.has_role(auth.uid(), 'admin'));

-- intake_status
CREATE POLICY "View own intake" ON public.intake_status
  FOR SELECT USING (public.owns_client(auth.uid(), client_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own intake" ON public.intake_status
  FOR INSERT WITH CHECK (public.owns_client(auth.uid(), client_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Update own intake" ON public.intake_status
  FOR UPDATE USING (public.owns_client(auth.uid(), client_id) OR public.has_role(auth.uid(), 'admin'));

-- posts: client sees only scheduled/published; admins see all
CREATE POLICY "Clients view their published/scheduled posts" ON public.posts
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.owns_client(auth.uid(), client_id) AND status IN ('scheduled','published'))
  );
CREATE POLICY "Admins manage posts" ON public.posts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- change_requests
CREATE POLICY "View own change requests" ON public.change_requests
  FOR SELECT USING (public.owns_client(auth.uid(), client_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own change requests" ON public.change_requests
  FOR INSERT WITH CHECK (public.owns_client(auth.uid(), client_id));
CREATE POLICY "Admins update change requests" ON public.change_requests
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- ===== AUTO-CREATE PROFILE + ROLE ON SIGNUP =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT DO NOTHING;

  -- Auto-create client row so onboarding can write immediately
  INSERT INTO public.clients (owner_user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
