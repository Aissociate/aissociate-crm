#!/usr/bin/env bash
# Copie la base Supabase vers aissociate-db (VPS). Rejouable : écrase les données locales.
#   La connexion Supabase est lue dans /root/.supabase-db-url (chmod 600), jamais
#   affichée. Format libpq par paramètres (évite les soucis d'encodage d'URL).
#   Compte utilisé : rôle temporaire en lecture seule, sans le mot de passe postgres.
#     1. sur le VPS : générer un mot de passe, en calculer l'empreinte SCRAM avec
#        aissociate-db (rôle jetable), écrire le fichier de connexion ;
#     2. sur Supabase : create role migration_reader login bypassrls
#        valid until <+24 h> password '<empreinte SCRAM>'; grant pg_read_all_data;
#        grant usage/select sur les schémas auth et storage ;
#     3. après la copie : drop role migration_reader.
#   Hôte : pooler partagé IPv4, session (l'hôte direct est en IPv6 et bannit
#   l'IP après quelques échecs d'authentification) :
#   host=aws-1-eu-north-1.pooler.supabase.com port=5432
#   user=migration_reader.<ref> password=… dbname=postgres sslmode=require
set -euo pipefail

DATA=/opt/aissociate-data
WORK="$DATA/backups/copy-$(date +%Y%m%d-%H%M%S)"
SRC_FILE=/root/.supabase-db-url
[ -s "$SRC_FILE" ] || { echo "Fichier $SRC_FILE absent ou vide"; exit 1; }
mkdir -p "$WORK"

# Client Postgres 17 éphémère : branché au réseau interne pour joindre aissociate-db.
# Les secrets sont montés en lecture seule et lus dans le conteneur : ils
# n'apparaissent ni dans la ligne de commande ni dans `docker inspect`.
run() {   # $1 = réseau, $2 = commandes
  docker run --rm -i --network "$1" \
    -v "$SRC_FILE:/run/src:ro" -v "$DATA/.env:/run/env:ro" \
    -v "$WORK:/work" -v "$DATA/sql:/sql:ro" -w /work \
    postgres:17-bookworm bash -c 'set -euo pipefail
      export SRC="$(cat /run/src)"
      export PGPASSWORD="$(grep "^POSTGRES_PASSWORD=" /run/env | cut -d= -f2-)"
      '"$2"
}
src() { run host "$1"; }                  # lecture Supabase (IPv6)
pg()  { run aissociate-internal "$1"; }   # écriture aissociate-db
DST='-h aissociate-db -U postgres -d aissociate -v ON_ERROR_STOP=1 -q'

echo "1/6 Dump du schéma public (structure + données)"
src 'pg_dump "$SRC" --schema=public --format=custom --no-owner --no-publications --no-subscriptions -f public.dump'

echo "2/6 Export auth.users, storage.buckets, storage.objects"
src 'psql "$SRC" -q -c "\copy (select id, aud, role, email, encrypted_password, email_confirmed_at, last_sign_in_at, coalesce(raw_app_meta_data, '"'"'{}'"'"'), coalesce(raw_user_meta_data, '"'"'{}'"'"'), banned_until, deleted_at, created_at, updated_at from auth.users) to users.csv csv"
    psql "$SRC" -q -c "\copy (select id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at from storage.buckets) to buckets.csv csv"
    psql "$SRC" -q -c "\copy (select id, bucket_id, name, owner, coalesce(metadata, '"'"'{}'"'"'), created_at, updated_at, last_accessed_at from storage.objects) to objects.csv csv"
    psql "$SRC" -At -c "select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = '"'"'public'"'"' and c.relkind = '"'"'r'"'"' order by 1" > tables.txt
    while read -r t; do echo "$t $(psql "$SRC" -At -c "select count(*) from public.\"$t\"")"; done < tables.txt > counts-supabase.txt'

echo "3/6 Remise à zéro de la base locale"
pg "psql $DST -c 'drop trigger if exists on_auth_user_created on auth.users' \
  -c 'truncate auth.users, storage.objects, storage.buckets cascade' \
  -c 'drop schema if exists public cascade' -c 'create schema public' \
  -c 'grant usage on schema public to anon, authenticated, service_role'"

echo "4/6 Chargement auth.users et storage.buckets"
pg "psql $DST -c '\copy auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, banned_until, deleted_at, created_at, updated_at) from users.csv csv' \
  -c '\copy storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at) from buckets.csv csv'"

echo "5/6 Restauration du schéma public"
pg "pg_restore -h aissociate-db -U postgres -d aissociate --no-owner public.dump 2> restore-errors.log || true
    grep -v 'schema \"public\" already exists' restore-errors.log | grep -E 'error|ERROR' > restore-errors-real.log || true
    psql $DST -c '\copy storage.objects (id, bucket_id, name, owner, metadata, created_at, updated_at, last_accessed_at) from objects.csv csv' \
              -f /sql/20-after-restore.sql"

echo "6/6 Comparaison des comptes de lignes"
pg 'while read -r t; do echo "$t $(psql -h aissociate-db -U postgres -d aissociate -At -c "select count(*) from public.\"$t\"")"; done < tables.txt > counts-local.txt
    echo "auth.users: $(psql -h aissociate-db -U postgres -d aissociate -At -c "select count(*) from auth.users")  storage.objects: $(psql -h aissociate-db -U postgres -d aissociate -At -c "select count(*) from storage.objects")"'

echo
echo "Tables : $(wc -l < "$WORK/tables.txt")  |  écarts de comptes :"
diff "$WORK/counts-supabase.txt" "$WORK/counts-local.txt" && echo "  aucun"
echo "Erreurs de restauration : $(wc -l < "$WORK/restore-errors-real.log") (détail : $WORK/restore-errors-real.log)"
rm -f "$WORK"/*.csv   # données personnelles : on ne garde que le dump
