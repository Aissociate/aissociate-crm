# Hébergement — VPS Docker + Traefik

Le site public et le CRM (SPA Vite) sont servis depuis le VPS par Nginx dans Docker,
derrière Traefik (HTTPS Let's Encrypt). Depuis le 18/11/2026, la base (Postgres 17), l'API
(données, auth, stockage, temps réel) et les fonctions tournent aussi sur le VPS, sans
Supabase : voir `docs/migration-postgres.md`, `deploy/data`, `deploy/api`, `deploy/functions`.

| Fichier | Rôle |
|---|---|
| `../Dockerfile` | build `npm run build` (tsc + vite + prérendu SEO) puis image Nginx |
| `nginx.conf` | traduction de `public/_redirects` (Netlify) : 301, 410, sitemap proxifié, fallback SPA |
| `docker-compose.yml` | conteneur `aissociate-web` + labels Traefik |
| `traefik/docker-compose.yml` | reverse proxy partagé (`/opt/traefik`), certificats en DNS-01 via l'API Gandi |
| `deploy.sh` | mise à jour depuis `origin/main` (installé en `/usr/local/bin/aissociate-deploy`) |

**⚠ `public/_redirects` n'est plus lu** : toute nouvelle redirection doit aussi être
ajoutée dans `deploy/nginx.conf`.

## Déploiement

Automatique à chaque push sur `main` (job `deploy` de `.github/workflows/ci.yml`, après
tests + build). À la main : `ssh root@VPS aissociate-deploy`.

`deploy.sh` :
- se réinstalle lui-même en `/usr/local/bin/aissociate-deploy` quand sa version du repo change ;
- reconstruit `aissociate-web` à chaque fois ;
- reconstruit `aissociate-functions` (image depuis `/opt/aissociate/src`, compose et `.env` de
  `/opt/aissociate-functions`) **seulement si** `supabase/functions` ou `functions-runtime` ont changé
  (empreinte dans `/opt/aissociate-functions/.deployed-tree`) ; en cas d'échec de santé, retour à
  l'image `aissociate-functions:precedente` et déploiement en erreur.

Forcer une reconstruction des fonctions : `rm /opt/aissociate-functions/.deployed-tree && aissociate-deploy`.
L'API et la base (`/opt/aissociate-api`, `/opt/aissociate-data`) restent déployées à la main.

## Sur le VPS

- `/opt/aissociate/.env` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SITE_HOSTS`
- `/opt/aissociate/src` : clone du repo
- `/opt/traefik/.env` : `GANDIV5_PERSONAL_ACCESS_TOKEN` (renouvellement des certificats)
- Préprod : `preprod.aissociate.re` (même conteneur)
