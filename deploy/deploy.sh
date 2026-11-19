#!/usr/bin/env bash
# Met à jour le site sur le VPS depuis origin/main puis reconstruit le conteneur web,
# et le conteneur des fonctions serveur quand leur code a changé.
# Installé en /usr/local/bin/aissociate-deploy ; appelé par GitHub Actions
# (clé SSH dédiée, commande forcée) ou à la main en root.
set -euo pipefail

SRC=/opt/aissociate/src
ENV_FILE=/opt/aissociate/.env
FN_DIR=/opt/aissociate-functions          # docker-compose.yml + .env des fonctions
FN_STAMP="$FN_DIR/.deployed-tree"         # empreinte du code des fonctions déployé
INSTALLED=/usr/local/bin/aissociate-deploy

exec 9>/var/lock/aissociate-deploy.lock
flock 9   # un seul déploiement à la fois

git -C "$SRC" fetch --depth 1 origin main
git -C "$SRC" reset --hard origin/main
echo "Commit : $(git -C "$SRC" log -1 --format='%h %s')"

# Le script installé suit celui du repo : s'il a changé, on l'installe et on le relance.
if [ -z "${AISSOCIATE_DEPLOY_REEXEC:-}" ] && ! cmp -s "$SRC/deploy/deploy.sh" "$INSTALLED"; then
  install -m 755 "$SRC/deploy/deploy.sh" "$INSTALLED"
  echo "Script de déploiement mis à jour, relance."
  exec 9>&-
  AISSOCIATE_DEPLOY_REEXEC=1 exec "$INSTALLED"
fi

attendre_sante() { # conteneur, essais (2 s chacun)
  local s=""
  for _ in $(seq 1 "$2"); do
    s=$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null || echo absent)
    [ "$s" = healthy ] && break
    sleep 2
  done
  echo "Santé de $1 : $s"
  [ "$s" = healthy ]
}

# ── Site + CRM ───────────────────────────────────────────────────────────────
# Build d'abord (le site reste en ligne), puis remplacement du conteneur.
docker compose -p aissociate --env-file "$ENV_FILE" -f "$SRC/deploy/docker-compose.yml" build
docker compose -p aissociate --env-file "$ENV_FILE" -f "$SRC/deploy/docker-compose.yml" up -d
attendre_sante aissociate-web 30

# Traefik met ~1 s à router le nouveau conteneur : attendre qu'il serve le site.
for _ in $(seq 1 30); do
  c=$(curl -sk -o /dev/null -w '%{http_code}' --resolve aissociate.re:443:127.0.0.1 https://aissociate.re/healthz || true)
  [ "$c" = 200 ] && break
  sleep 1
done
echo "Routage Traefik : $c"
[ "$c" = 200 ]

# ── Fonctions serveur (Deno) ─────────────────────────────────────────────────
# Reconstruites seulement si leur code a changé : un redémarrage coupe les
# conversations en cours du Studio. Empreinte = arbres git (marche en clone superficiel).
arbre=$(git -C "$SRC" rev-parse HEAD:supabase/functions HEAD:functions-runtime | tr '\n' ' ')
if [ "$arbre" = "$(cat "$FN_STAMP" 2>/dev/null || true)" ]; then
  echo "Fonctions : code inchangé, pas de reconstruction."
else
  echo "Fonctions : code modifié, reconstruction."
  docker image inspect aissociate-functions:latest >/dev/null 2>&1 \
    && docker tag aissociate-functions:latest aissociate-functions:precedente
  docker build -q -t aissociate-functions:latest -f "$SRC/functions-runtime/Dockerfile" "$SRC"
  # Même nom de projet compose que le conteneur en place (sinon conflit de container_name).
  projet=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' aissociate-functions 2>/dev/null || true)
  projet=${projet:-aissociate-functions}
  docker compose -p "$projet" -f "$FN_DIR/docker-compose.yml" up -d --no-build
  if attendre_sante aissociate-functions 60; then
    echo "$arbre" > "$FN_STAMP"
  else
    echo "Fonctions en échec : retour à l'image précédente." >&2
    # Diagnostic visible dans la CI : journaux du conteneur et derniers contrôles de santé.
    echo "── Journaux de aissociate-functions ──" >&2
    docker logs --tail 60 aissociate-functions >&2 2>&1 || true
    echo "── Contrôles de santé ──" >&2
    docker inspect -f '{{range .State.Health.Log}}{{.ExitCode}} {{.Output}}{{end}}' aissociate-functions >&2 || true
    docker inspect -f 'État : {{.State.Status}}, redémarrages : {{.RestartCount}}' aissociate-functions >&2 || true
    if docker image inspect aissociate-functions:precedente >/dev/null 2>&1; then
      docker tag aissociate-functions:precedente aissociate-functions:latest
      docker compose -p "$projet" -f "$FN_DIR/docker-compose.yml" up -d --no-build --force-recreate
      attendre_sante aissociate-functions 60 || true
    fi
    exit 1
  fi
fi

docker image prune -f >/dev/null
