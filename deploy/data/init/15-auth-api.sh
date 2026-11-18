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
SQL
# La table parametres n'existe qu'après la restauration des données.
psql -U postgres -d aissociate -c "do \$\$ begin if to_regclass('public.parametres') is not null then grant select on public.parametres to auth_admin; end if; end \$\$"
