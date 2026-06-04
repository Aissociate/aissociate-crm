/*
  # Fix profiles RLS infinite recursion

  1. Helpers (SECURITY DEFINER, bypasses RLS)
     - is_admin(): true si le user courant a role = 'admin'
     - is_manager(): true si role in ('admin', 'directeur_commercial')

  2. Policies profiles
     - Supprime TOUTES les policies existantes sur profiles (dont la récursive)
     - Recrée un jeu sain :
       - profiles_select      : tout utilisateur authentifié peut lire tous les profils
       - profiles_update_self : chacun peut modifier son propre profil
       - profiles_admin_all   : les admins peuvent tout faire

  3. Promotion admin
     - contact@aissociate.re et benjamin@aissociate.re -> role 'admin'

  4. Reload PostgREST schema cache
*/

-- 1) Helpers non récursifs
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT coalesce(
    (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT coalesce(
    (SELECT role IN ('admin', 'directeur_commercial') FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- 2) Purge toutes les policies de profiles + jeu sain
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY profiles_update_self
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_admin_all
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3) Promotion admin
UPDATE public.profiles
SET role = 'admin'
WHERE lower(email) IN ('contact@aissociate.re', 'benjamin@aissociate.re');

-- 4) Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
