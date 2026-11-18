# Hébergement — VPS Docker + Traefik

Le site public et le CRM (SPA Vite) sont servis depuis le VPS par Nginx dans Docker,
derrière Traefik (HTTPS Let's Encrypt). La base, l'auth et les Edge Functions restent
sur **Supabase** (`vkirutbpxzybucuiyjnb`) : rien à migrer côté données.

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

## Sur le VPS

- `/opt/aissociate/.env` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SITE_HOSTS`
- `/opt/aissociate/src` : clone du repo
- `/opt/traefik/.env` : `GANDIV5_PERSONAL_ACCESS_TOKEN` (renouvellement des certificats)
- Préprod : `preprod.aissociate.re` (même conteneur)
