#!/usr/bin/env bash
# Tests différentiels de l'API contre PostgREST (référence, lancée le temps du test
# sur le réseau interne puis supprimée). À lancer en root sur le VPS.
# ⚠ Écrit puis supprime quelques lignes de test (parametres, contact_requests et les
#   contacts que le trigger lead_to_contact en tire) :
#   à utiliser sur la base de préprod, pas après la bascule en production.
set -euo pipefail
API=/opt/aissociate-api
REF=postgrest-ref
cleanup() { docker rm -f "$REF" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

# Fichier d'environnement temporaire : les secrets ne passent pas par la ligne de commande.
ENVF=$(mktemp); chmod 600 "$ENVF"
JWT=$(grep '^JWT_SECRET=' "$API/.env" | cut -d= -f2-)
PW=$(grep '^AUTHENTICATOR_PASSWORD=' "$API/.env" | cut -d= -f2-)
cat > "$ENVF" <<EOF
PGRST_DB_URI=postgres://authenticator:${PW}@aissociate-db:5432/aissociate
PGRST_DB_SCHEMAS=public
PGRST_DB_ANON_ROLE=anon
PGRST_JWT_SECRET=${JWT}
PGRST_DB_MAX_ROWS=1000
JWT_SECRET=${JWT}
EOF
docker run -d --name "$REF" --network aissociate-internal --env-file "$ENVF" postgrest/postgrest:v13.0.4 >/dev/null
sleep 3
ADMIN_ID=$(docker exec aissociate-db psql -U postgres -d aissociate -Atc "select id from profiles where role = 'admin' order by created_at limit 1")
set +e
docker run --rm --network aissociate-internal --env-file "$ENVF" \
  -e API_URL=http://aissociate-api:3000 -e REF_URL=http://$REF:3000 -e ADMIN_ID="$ADMIN_ID" \
  -v "$API/app:/app:ro" -w /app node:22-alpine node test/contract/run.mjs
code=$?
rm -f "$ENVF"
# Filet de sécurité : aucune ligne de test ne doit rester.
docker exec aissociate-db psql -U postgres -d aissociate -Atc "delete from parametres where cle like '\_\_t\_%'; delete from contact_requests where message like '__test_contrat_%'; delete from contact_actions where contact_id in (select id from contacts where email like '%@example.invalid'); delete from contacts where email like '%@example.invalid'; select 'restes: ' || (select count(*) from parametres where cle like '\_\_t\_%')"
exit $code
