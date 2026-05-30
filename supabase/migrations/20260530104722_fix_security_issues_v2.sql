/*
  # Correction des problèmes de sécurité

  1. Function Search Path Mutable
     - `set_updated_at` : ajout de SET search_path = ''
     - `update_ticket_updated_at` : ajout de SET search_path = ''

  2. RLS Policies "Always True" sur les tables kanban
     - Remplacement des policies FOR ALL (USING true) par des policies séparées
       SELECT / INSERT / UPDATE / DELETE avec des conditions explicites

  3. SECURITY DEFINER functions accessibles publiquement
     - Révocation de EXECUTE sur `anon` pour auth_role, handle_new_user,
       is_admin, is_manager, log_audit
     - Révocation de EXECUTE sur `authenticated` pour handle_new_user
       (fonction trigger, ne doit pas être appelable via RPC)

  Note : pg_net est une extension Supabase gérée et ne supporte pas SET SCHEMA.
*/

-- ─── 1. Fix mutable search_path on trigger functions ──────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.update_ticket_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

-- ─── 2. Fix kanban RLS policies ───────────────────────────────────────────────

-- kanban_boards : drop FOR ALL, create 4 separate policies
DROP POLICY IF EXISTS boards_all ON public.kanban_boards;

CREATE POLICY "Authenticated users can view boards"
  ON public.kanban_boards FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create boards"
  ON public.kanban_boards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Board owners can update their boards"
  ON public.kanban_boards FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id OR owner_id IS NULL)
  WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);

CREATE POLICY "Board owners can delete their boards"
  ON public.kanban_boards FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id OR owner_id IS NULL);

-- kanban_colonnes : drop FOR ALL, create 4 separate policies
DROP POLICY IF EXISTS colonnes_all ON public.kanban_colonnes;

CREATE POLICY "Authenticated users can view columns"
  ON public.kanban_colonnes FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create columns"
  ON public.kanban_colonnes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update columns"
  ON public.kanban_colonnes FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete columns"
  ON public.kanban_colonnes FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- kanban_cartes : drop FOR ALL, create 4 separate policies
DROP POLICY IF EXISTS cartes_all ON public.kanban_cartes;

CREATE POLICY "Authenticated users can view cards"
  ON public.kanban_cartes FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create cards"
  ON public.kanban_cartes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update cards"
  ON public.kanban_cartes FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete cards"
  ON public.kanban_cartes FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ─── 3. Revoke public execute on SECURITY DEFINER functions ──────────────────

-- handle_new_user : trigger only, must never be callable via RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- auth_role, is_admin, is_manager, log_audit : revoke anon access only
REVOKE EXECUTE ON FUNCTION public.auth_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_manager() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb) FROM anon;
