#!/usr/bin/env bash
# Test de bout en bout des fonctions et du temps réel, par l'URL publique de l'API.
# À lancer en root sur le VPS, sur la base de préprod.
set -euo pipefail
API=/opt/aissociate-api
psqlc() { docker exec -i aissociate-db psql -U postgres -d aissociate -v ON_ERROR_STOP=1 -qAt "$@"; }
cleanup() { psqlc -c "delete from notifications where type = 'e2e'; delete from auth.users where email like '%@example.invalid'" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker restart aissociate-api >/dev/null   # compteurs de limitation de débit à zéro
for _ in $(seq 1 20); do [ "$(docker inspect -f '{{.State.Health.Status}}' aissociate-api)" = healthy ] && break; sleep 2; done
sleep 2   # le temps que Traefik reprenne le conteneur
ENVF=$(mktemp); chmod 600 "$ENVF"
grep '^JWT_SECRET=' "$API/.env" > "$ENVF"
echo 'API_URL=https://api.aissociate.re' >> "$ENVF"
set +e
docker run --rm --env-file "$ENVF" -v "$API/app:/src:ro" node:22-alpine \
  sh -c 'cp -r /src /w && cd /w && npm ci --no-audit --no-fund >/dev/null 2>&1 && node test/e2e/functions-realtime.mjs'
code=$?
rm -f "$ENVF"
exit $code
