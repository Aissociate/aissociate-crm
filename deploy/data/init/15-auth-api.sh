#!/bin/bash
# Rôle de connexion du module d'authentification de l'API (schéma auth uniquement,
# plus la lecture de la configuration SMTP). Idempotent : sert aussi à mettre à
# niveau une base existante :
#   docker exec -e AUTH_ADMIN_PASSWORD=… aissociate-db bash /docker-entrypoint-initdb.d/15-auth-api.sh
set -euo pipefail
psql -v ON_ERROR_STOP=1 -U postgres -d aissociate -v pw="$AUTH_ADMIN_PASSWORD" <<'SQL'
select format('create role auth_admin login noinherit bypassrls password %L', :'pw')
where not exists (select 1 from pg_roles where rolname = 'auth_admin') \gexec
alter role auth_admin password :'pw';

-- Une session = une famille de jetons de rafraîchissement (rotation à chaque usage).
alter table auth.refresh_tokens add column if not exists session_id uuid;
create index if not exists refresh_tokens_session_idx on auth.refresh_tokens (session_id);
alter table auth.one_time_tokens drop constraint if exists one_time_tokens_kind_check;
alter table auth.one_time_tokens add constraint one_time_tokens_kind_check check (kind in ('recovery', 'magiclink'));

grant usage on schema auth to auth_admin;
grant select, insert, update, delete on auth.users, auth.refresh_tokens, auth.one_time_tokens to auth_admin;
grant usage on schema public to auth_admin;

-- File des appels HTTP (net.http_post) traitée par l'API.
grant usage on schema net to auth_admin;
grant select, update, delete on net.http_request_queue to auth_admin;

-- Temps réel : signale un changement (sans le contenu de la ligne) à l'API,
-- qui prévient les navigateurs abonnés ; ils rechargent alors par l'API, sous RLS.
create schema if not exists realtime;
create or replace function realtime.notify_change() returns trigger language plpgsql as $fn$
declare j jsonb := to_jsonb(coalesce(new, old));
begin
  perform pg_notify('table_changes', json_build_object('t', tg_table_name, 'op', tg_op, 'id', j->>'id', 'user_id', j->>'user_id')::text);
  return null;
end $fn$;
SQL
# La table parametres n'existe qu'après la restauration des données.
psql -U postgres -d aissociate -c "do \$\$ begin if to_regclass('public.parametres') is not null then grant select on public.parametres to auth_admin; end if; end \$\$"
