#!/usr/bin/env bash
# Met à jour le site sur le VPS depuis origin/main puis reconstruit le conteneur.
# Installé en /usr/local/bin/aissociate-deploy ; appelé par GitHub Actions
# (clé SSH dédiée, commande forcée) ou à la main en root.
set -euo pipefail

SRC=/opt/aissociate/src
ENV_FILE=/opt/aissociate/.env

exec 9>/var/lock/aissociate-deploy.lock
flock 9   # un seul déploiement à la fois

git -C "$SRC" fetch --depth 1 origin main
git -C "$SRC" reset --hard origin/main
echo "Commit : $(git -C "$SRC" log -1 --format='%h %s')"

# Build d'abord (le site reste en ligne), puis remplacement du conteneur.
docker compose -p aissociate --env-file "$ENV_FILE" -f "$SRC/deploy/docker-compose.yml" build
docker compose -p aissociate --env-file "$ENV_FILE" -f "$SRC/deploy/docker-compose.yml" up -d
docker image prune -f >/dev/null

for _ in $(seq 1 30); do
  s=$(docker inspect -f '{{.State.Health.Status}}' aissociate-web)
  [ "$s" = healthy ] && break
  sleep 2
done
echo "Santé du conteneur : $s"
[ "$s" = healthy ]
