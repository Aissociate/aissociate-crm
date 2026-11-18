#!/usr/bin/env bash
# Test de bout en bout de l'authentification avec supabase-js. À lancer en root
# sur le VPS. Crée puis supprime des comptes @example.invalid : à utiliser sur
# la base de préprod.
set -euo pipefail
API=/opt/aissociate-api
SEED_EMAIL="seed-$(date +%s)@example.invalid"
SEED_PW="$(openssl rand -hex 12)"
psqlc() { docker exec -i aissociate-db psql -U postgres -d aissociate -v ON_ERROR_STOP=1 -qAt "$@"; }
cleanup() { psqlc -c "delete from auth.users where email like '%@example.invalid'" >/dev/null; }
trap cleanup EXIT

# Compte « migré de Supabase » : hachage bcrypt $2a$ produit par pgcrypto.
psqlc -v e="$SEED_EMAIL" -v p="$SEED_PW" <<'SQL'
insert into auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values (:'e', extensions.crypt(:'p', extensions.gen_salt('bf', 10)), now(), '{"nom":"Seed","prenom":"Test"}');
SQL

# Limites de débit en mémoire : on repart d'un compteur vide.
docker restart aissociate-api >/dev/null
for _ in $(seq 1 20); do [ "$(docker inspect -f '{{.State.Health.Status}}' aissociate-api)" = healthy ] && break; sleep 2; done

ENVF=$(mktemp); chmod 600 "$ENVF"
grep '^JWT_SECRET=' "$API/.env" > "$ENVF"
printf 'SEEDED_EMAIL=%s\nSEEDED_PASSWORD=%s\nAPI_URL=http://aissociate-api:3000\n' "$SEED_EMAIL" "$SEED_PW" >> "$ENVF"
set +e
docker run --rm --network aissociate-internal --env-file "$ENVF" -v "$API/app:/src:ro" node:22-alpine \
  sh -c 'cp -r /src /w && cd /w && npm ci --no-audit --no-fund >/dev/null 2>&1 && node test/e2e/auth.mjs'
code=$?
rm -f "$ENVF"
exit $code
