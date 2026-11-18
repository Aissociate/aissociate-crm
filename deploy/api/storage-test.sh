#!/usr/bin/env bash
# Test de bout en bout du stockage avec supabase-js. À lancer en root sur le VPS,
# sur la base de préprod : crée puis supprime des fichiers sous « e2e/ ».
set -euo pipefail
API=/opt/aissociate-api
psqlc() { docker exec -i aissociate-db psql -U postgres -d aissociate -v ON_ERROR_STOP=1 -qAt "$@"; }
cleanup() {
  # Filet de sécurité : lignes et fichiers de test restants.
  psqlc -c "delete from storage.objects where name like 'e2e/%' returning bucket_id || '/' || id" 2>/dev/null \
    | while read -r f; do docker exec aissociate-api rm -f "/data/storage/$f"; done
  psqlc -c "delete from storage.buckets where id = 'e2e-limit'; delete from auth.users where email like '%@example.invalid'" >/dev/null 2>&1 || true
}
trap cleanup EXIT
psqlc -c "insert into storage.buckets (id, name, public, file_size_limit) values ('e2e-limit', 'e2e-limit', false, 10) on conflict do nothing"

docker restart aissociate-api >/dev/null   # compteurs de limitation de débit à zéro
for _ in $(seq 1 20); do [ "$(docker inspect -f '{{.State.Health.Status}}' aissociate-api)" = healthy ] && break; sleep 2; done

ENVF=$(mktemp); chmod 600 "$ENVF"
grep '^JWT_SECRET=' "$API/.env" > "$ENVF"
echo 'API_URL=http://aissociate-api:3000' >> "$ENVF"
set +e
docker run --rm --network aissociate-internal --env-file "$ENVF" -v "$API/app:/src:ro" node:22-alpine \
  sh -c 'cp -r /src /w && cd /w && npm ci --no-audit --no-fund >/dev/null 2>&1 && node test/e2e/storage.mjs'
code=$?
rm -f "$ENVF"
echo "fichiers restants sur disque : $(docker exec aissociate-api sh -c 'find /data/storage -type f | wc -l')"
exit $code
