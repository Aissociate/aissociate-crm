#!/bin/bash
# Rôles équivalents à Supabase. L'API se connecte en "authenticator" puis fait
# SET LOCAL ROLE anon | authenticated | service_role pour chaque requête :
# les policies RLS existantes s'appliquent telles quelles.
set -euo pipefail
psql -v ON_ERROR_STOP=1 -U postgres -d aissociate \
  -v authpw="$AUTHENTICATOR_PASSWORD" <<'SQL'
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password :'authpw';
grant anon, authenticated, service_role to authenticator;

-- Rôles cités par les GRANT/REVOKE du dump Supabase : simples coquilles sans droit de connexion.
do $$
declare r text;
begin
  foreach r in array array['supabase_admin','supabase_auth_admin','supabase_storage_admin',
    'supabase_realtime_admin','supabase_replication_admin','supabase_read_only_user',
    'dashboard_user','pgbouncer','supabase_functions_admin','supabase_etl_admin']
  loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;

alter database aissociate set search_path to "$user", public, extensions;
SQL
