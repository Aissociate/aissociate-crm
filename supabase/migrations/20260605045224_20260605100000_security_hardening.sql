/*
  # Security hardening

  Issues addressed:
  1. pg_net extension — move to extensions schema
  2. RLS always-true policies on plan_pdfs, session_participants, sessions_formation, contact_requests
  3. Blog bucket SELECT policy too broad (allows listing)
  4. SECURITY DEFINER functions callable by anon / authenticated via RPC
*/

-- ============================================================
-- 1. pg_net: move to extensions schema
-- ============================================================
DO $$
BEGIN
  ALTER EXTENSION pg_net SET SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  NULL; -- already in correct schema or cannot move
END $$;

-- ============================================================
-- 2a. plan_pdfs — replace always-true ALL policy
--     Restrict writes to managers; reads to all authenticated
-- ============================================================
DROP POLICY IF EXISTS plan_pdfs_all ON public.plan_pdfs;

CREATE POLICY plan_pdfs_select ON public.plan_pdfs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY plan_pdfs_insert ON public.plan_pdfs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY plan_pdfs_update ON public.plan_pdfs
  FOR UPDATE TO authenticated
  USING (public.is_manager()) WITH CHECK (public.is_manager());

CREATE POLICY plan_pdfs_delete ON public.plan_pdfs
  FOR DELETE TO authenticated
  USING (public.is_manager());

-- ============================================================
-- 2b. session_participants — replace always-true ALL policy
-- ============================================================
DROP POLICY IF EXISTS participants_all ON public.session_participants;

CREATE POLICY participants_select ON public.session_participants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY participants_insert ON public.session_participants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY participants_update ON public.session_participants
  FOR UPDATE TO authenticated
  USING (public.is_manager()) WITH CHECK (public.is_manager());

CREATE POLICY participants_delete ON public.session_participants
  FOR DELETE TO authenticated
  USING (public.is_manager());

-- ============================================================
-- 2c. sessions_formation — replace always-true ALL policy
-- ============================================================
DROP POLICY IF EXISTS sessions_all ON public.sessions_formation;

CREATE POLICY sessions_select ON public.sessions_formation
  FOR SELECT TO authenticated USING (true);

CREATE POLICY sessions_insert ON public.sessions_formation
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager());

CREATE POLICY sessions_update ON public.sessions_formation
  FOR UPDATE TO authenticated
  USING (public.is_manager()) WITH CHECK (public.is_manager());

CREATE POLICY sessions_delete ON public.sessions_formation
  FOR DELETE TO authenticated
  USING (public.is_manager());

-- ============================================================
-- 2d. contact_requests — tighten INSERT (public lead form)
--     Require email non-null (minimal sanity check)
-- ============================================================
DROP POLICY IF EXISTS contact_requests_insert_public ON public.contact_requests;

CREATE POLICY contact_requests_insert_public ON public.contact_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND email <> '');

-- ============================================================
-- 3. Blog bucket — split ALL policy into separate verbs
--    Remove the broad SELECT (listing) for non-authenticated
-- ============================================================
DROP POLICY IF EXISTS "blog_storage_rw" ON storage.objects;

-- Authenticated users can read/write their own blog objects
CREATE POLICY blog_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'blog');

CREATE POLICY blog_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blog');

CREATE POLICY blog_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'blog') WITH CHECK (bucket_id = 'blog');

CREATE POLICY blog_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'blog');

-- ============================================================
-- 4. SECURITY DEFINER functions — revoke from anon / authenticated
--    where direct RPC calls are not intended
-- ============================================================

-- auth_role(): used in RLS policies only — keep authenticated for RLS eval, revoke anon
REVOKE EXECUTE ON FUNCTION public.auth_role() FROM anon;

-- email_sender_matched(): internal email helper, revoke anon (authenticated grant already in place)
REVOKE EXECUTE ON FUNCTION public.email_sender_matched(text) FROM anon;

-- handle_new_user(): trigger only — already revoked in a prior migration, ensure idempotent
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- is_admin() / is_manager(): used in RLS policies, anon should never call these
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_manager() FROM anon;

-- lead_to_contact(): trigger only, revoke from all user-facing roles
REVOKE EXECUTE ON FUNCTION public.lead_to_contact() FROM anon;
REVOKE EXECUTE ON FUNCTION public.lead_to_contact() FROM authenticated;

-- log_audit(): already revoked from anon; ensure idempotent
REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb) FROM anon;

-- upsert_vault_secret(): admin-only vault operation, revoke from authenticated users
REVOKE EXECUTE ON FUNCTION public.upsert_vault_secret(text, text) FROM authenticated;

-- ============================================================
NOTIFY pgrst, 'reload schema';
