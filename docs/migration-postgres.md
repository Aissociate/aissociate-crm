# Sortie de Supabase : Postgres en Docker + API maison

Statut : **plan à valider** — rien n'est encore construit. Cible : VPS Hostinger 76.13.37.71
(KVM, 1 vCPU, 3,8 Go RAM), à côté du site déjà en Docker + Traefik.

## 1. Ce qu'il y a à remplacer (inventaire du 18/11/2026)

| Brique Supabase | Usage réel | Remplacement |
|---|---|---|
| Postgres 17 | 123 Mo, 111 tables, 162 migrations, 55 fonctions `security definer` | `postgres:17` en Docker, données restaurées par `pg_dump` |
| RLS | 221 policies, 19 appels `auth.uid()` | **conservées telles quelles** (voir §2) |
| PostgREST (`.from()`) | ~1 130 appels sur 70 tables, 19 jointures imbriquées, `upsert`, `single`, `or`, `in`… | module `data` de l'API |
| RPC | 12 fonctions SQL | `POST /rpc/:fn` |
| Auth (GoTrue) | 2 comptes, e-mail + mot de passe (hash bcrypt `$2a$`, réutilisable) ; reset mot de passe ; `admin.*` (suppression, lien magique, `verifyOtp`) | module `auth` : JWT d'accès + refresh, SMTP existant |
| Storage | 16 buckets (3 publics), 499 fichiers / 302 Mo, 18 policies ; `upload`, `remove`, `createSignedUrl`, `download`, `getPublicUrl`, `copy` | fichiers sur volume Docker, métadonnées dans `storage.objects` (policies conservées) |
| Edge Functions | 36 fonctions Deno, 20 000 lignes, ~40 secrets | conteneur **Deno** maison qui exécute le même code |
| Realtime | 3 abonnements (`emails`, `notifications`, rafraîchissement de listes) | SSE + `LISTEN/NOTIFY` |
| pg_cron + pg_net + Vault | 13 tâches (11 appellent une fonction), 1 trigger `blog_articles` → LinkedIn, 2 secrets Vault | planificateur dans l'API ; trigger → `NOTIFY` ; Vault → variables d'environnement |

## 2. Principe : réécrire Supabase, pas l'application

Le front n'a **qu'un** point d'entrée (`src/lib/supabase.ts`) et les 36 fonctions importent toutes
`npm:@supabase/supabase-js@2.47.10`. On écrit notre propre client, **compatible avec le
sous-ensemble de l'API supabase-js réellement utilisé**, et on le branche à ces deux endroits :

- front : `src/lib/supabase.ts` crée notre client au lieu de celui de Supabase ;
- fonctions : une *import map* Deno redirige `npm:@supabase/supabase-js@2.47.10` vers notre client.

Les ~1 130 appels restent donc inchangés. Les écarts éventuels se corrigent au cas par cas.

**Sécurité inchangée** : chaque requête de l'API s'exécute dans une transaction
`SET LOCAL ROLE authenticated|anon` + `request.jwt.claims`, exactement comme Supabase.
On recrée les rôles `anon` / `authenticated` / `service_role` et les fonctions
`auth.uid()`, `auth.jwt()`, `auth.role()`. Les 221 policies et 55 fonctions
`security definer` s'appliquent sans modification. L'API n'invente aucune règle d'accès.

## 3. Architecture cible

```
Traefik ── aissociate.re        → aissociate-web (Nginx, inchangé)
        └─ api.aissociate.re    → aissociate-api (Node 22, Fastify)
                                     ├─ /auth/v1/*      auth (JWT HS256, bcrypt, SMTP)
                                     ├─ /rest/v1/*      data (JSON → SQL paramétré, RLS)
                                     ├─ /rpc/*          fonctions SQL
                                     ├─ /storage/v1/*   fichiers (volume /data/storage)
                                     ├─ /realtime       SSE (LISTEN/NOTIFY)
                                     ├─ /functions/v1/* → aissociate-functions (Deno 2)
                                     └─ planificateur   (13 tâches, ex-pg_cron)
                     aissociate-db  (postgres:17, réseau interne uniquement, jamais exposé)
```

Garde-fous du module `data` :
- tables, colonnes et relations validées contre le schéma (introspection au démarrage) ;
- toutes les valeurs passées en paramètres, jamais concaténées ;
- opérateurs en liste blanche (`eq neq gt gte lt lte like ilike is in contains or not match`) ;
- limites de taille et de durée par requête.

Budget mémoire estimé : Postgres ~300 Mo, API ~120 Mo, Deno ~300 Mo, soit environ 0,7 Go.

## 4. Étapes

| # | Étape | Livrable | Vérification |
|---|---|---|---|
| 1 | Base Docker + restauration | `aissociate-db`, schémas `auth`/`storage` minimaux, rôles, données copiées | comptes de lignes identiques table par table |
| 2 | Client compatible + API `data`/`rpc` | `packages/db-client`, `api/` | tests de contrat : mêmes requêtes contre Supabase et contre l'API, résultats comparés, **par rôle** (anon, utilisateur, admin) |
| 3 | Auth | connexion, inscription, session, reset, `admin.*` | connexion avec les 2 comptes existants, reset par e-mail |
| 4 | Storage | upload, signed URL, public URL, copie des 302 Mo | chaque fichier téléchargeable, policies testées |
| 5 | Fonctions Deno + planificateur + realtime | conteneur `aissociate-functions`, 13 tâches, SSE | chaque fonction appelée une fois ; journal `job_runs` |
| 6 | Préprod complète | `preprod.aissociate.re` sur la nouvelle pile, prod toujours sur Supabase | recette manuelle du CRM + vitest |
| 7 | Bascule | fenêtre de maintenance ~30 min : gel des écritures, dump final, synchro fichiers, nouvelles variables, rebuild | même recette sur la prod |
| 8 | Après bascule | sauvegardes, supervision, arrêt de Supabase | voir §6 |

## 5. Points externes à mettre à jour à la bascule

Ces URL pointent aujourd'hui vers `vkirutbpxzybucuiyjnb.supabase.co/functions/v1/…` :
- webhooks **Stripe** et **AgentMail** ;
- URL de redirection OAuth **LinkedIn** ;
- clients **MCP** (`/functions/v1/mcp`) ;
- règle `/sitemap-blog.xml` dans `deploy/nginx.conf` ;
- liens de désinscription des **newsletters déjà envoyées** : ils ne peuvent pas être réécrits.
  On garde une fonction Supabase minimale qui redirige vers la nouvelle API pendant
  quelques mois, avant de fermer le projet.

## 6. Ce que Supabase faisait et qu'il faudra assurer nous-mêmes

- **Sauvegardes** : `pg_dump` quotidien + archive des fichiers, copiés **hors du VPS**
  (destination à choisir). Sans ça, une panne du VPS = perte des données.
- Mises à jour de sécurité de Postgres, de Node et de Deno.
- Supervision : disque, mémoire, erreurs de l'API.
- 1 seul vCPU : les builds Docker lancés au déploiement concurrencent la base. À terme,
  construire les images dans GitHub Actions et ne faire que les tirer sur le VPS.

## 7. Retour arrière

Jusqu'à l'arrêt définitif, Supabase reste intact. Revenir en arrière = remettre les anciennes
variables `VITE_SUPABASE_*` et redéployer le front (~3 min). Les données écrites entre la
bascule et le retour arrière devront être recopiées à la main : d'où une recette serrée en
préprod avant de basculer.

## 8. Estimation

8 à 12 jours de travail effectif, dont environ la moitié en tests (contrat, RLS, recette).
Livraison par étapes sur la préprod ; la prod ne bouge qu'à l'étape 7, avec ton accord.
