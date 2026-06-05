/*
  # Security hardening v2 — remaining issues

  1. pg_net: force REVOKE EXECUTE from anon/public on all net.* functions
     (ALTER EXTENSION SET SCHEMA failed silently; belt-and-suspenders approach)
  2. Blog bucket SELECT: restrict listing to managers only
  3. SECURITY DEFINER functions:
     - REVOKE EXECUTE FROM PUBLIC (drops the implicit default grant)
     - Re-GRANT only to roles that legitimately need it
*/

-- ============================================================
-- 1. pg_net — block anon/public from calling net.* functions
--    (extension may be stuck in public schema; revoke the exposure)
-- ============================================================
DO $$
DECLARE fn record;
BEGIN
  -- Try to move it first (no-op if already in extensions schema)
  BEGIN
    ALTER EXTENSION pg_net SET SCHEMA extensions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Revoke direct execution by anon on any net-namespace functions in public
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname ILIKE 'http%'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon',
      fn.proname, fn.args
    );
  END LOOP;
END $$;

-- ============================================================
-- 2. Blog bucket — restrict listing to managers only
--    (public buckets serve file URLs without a SELECT policy;
--     only admins need to list objects for the blog admin UI)
-- ============================================================
DROP POLICY IF EXISTS blog_storage_select ON storage.objects;
DROP POLICY IF EXISTS "blog_storage_select" ON storage.objects;

CREATE POLICY blog_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'blog' AND public.is_manager());

-- ============================================================
-- 3. SECURITY DEFINER functions
--    Pattern: REVOKE FROM PUBLIC (removes implicit default grant),
--    then GRANT only to roles that actually need it.
-- ============================================================

-- auth_role() — used in RLS policies for authenticated users only
REVOKE EXECUTE ON FUNCTION public.auth_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_role() FROM anon;
GRANT  EXECUTE ON FUNCTION public.auth_role() TO authenticated;

-- is_admin() — RLS helper, authenticated only
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- is_manager() — RLS helper, authenticated only
REVOKE EXECUTE ON FUNCTION public.is_manager() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_manager() FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_manager() TO authenticated;

-- handle_new_user() — trigger only, never callable via RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- lead_to_contact() — trigger only, never callable via RPC
REVOKE EXECUTE ON FUNCTION public.lead_to_contact() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lead_to_contact() FROM anon;
REVOKE EXECUTE ON FUNCTION public.lead_to_contact() FROM authenticated;

-- log_audit() — called from authenticated context only
REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb) TO authenticated;

-- email_sender_matched() — internal email helper, authenticated only
REVOKE EXECUTE ON FUNCTION public.email_sender_matched(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_sender_matched(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.email_sender_matched(text) TO authenticated;

-- upsert_vault_secret() — admin vault helper, service_role only
REVOKE EXECUTE ON FUNCTION public.upsert_vault_secret(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_vault_secret(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_vault_secret(text, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.upsert_vault_secret(text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
