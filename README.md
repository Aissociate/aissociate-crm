# CRM Formation — AIssociate

CRM métier de gestion des dossiers de formation (organisme Qualiopi), conçu pour
être **100 % compatible Bolt** (WebContainer) avec **Supabase** comme base de données.

## Stack

- **Vite + React 18 + TypeScript** (tourne intégralement en WebContainer / Bolt)
- **Tailwind CSS 3**
- **Supabase** — Postgres + Auth + Row Level Security, via `@supabase/supabase-js`
- `react-router-dom`, `recharts`, `lucide-react`, `date-fns`

Aucune dépendance native, aucun serveur Node persistant : toute la persistance passe par Supabase.

## Démarrage dans Bolt

1. Importer/ouvrir le projet dans [bolt.new](https://bolt.new).
2. Cliquer sur **« Connect to Supabase »** (en haut à droite). Bolt crée/lie un projet
   Supabase, renseigne `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` et applique
   les migrations de `supabase/migrations/`.
3. L'application démarre. Créer un compte depuis l'écran de connexion.
4. Promouvoir le premier compte en **admin** : table `profiles`, colonne `role` → `admin`
   (SQL editor Supabase). Les comptes suivants peuvent ensuite être gérés depuis
   **Administration**.

## Démarrage local (hors Bolt)

```bash
cp .env.example .env          # renseigner URL + clé anon Supabase
npm install
npm run dev
```

Appliquer les migrations SQL (`supabase/migrations/`) dans l'ordre via le SQL editor
de Supabase ou la CLI `supabase db push`.

## Modules (alignés sur le CDC)

| CDC | Module | Page |
|-----|--------|------|
| 4.1 | CRM — contacts, entreprises, pipeline | `/contacts`, `/entreprises`, `/pipeline` |
| 4.2 | Dossiers par financeur + workflow + pièces | `/dossiers`, `/dossiers/:id` |
| 4.3 | Génération de plans de formation | `/plans`, `/formations` |
| 4.4 | Recrutement (offres + candidats) | `/recrutement` *(manager)* |
| 4.5 | Espace documentaire versionné | `/documents` |
| 4.6 | Kanban paramétrable | `/kanban` |
| 4.7 | Messagerie | `/messagerie` |
| 4.8 | Statistiques & reporting | `/statistiques` |
| 4.9 | Administration & RBAC, paramètres | `/administration`, `/parametres` *(admin)* |

## Droits (RBAC — CDC 2.1)

Appliqués **côté base via RLS** *et* côté UI :

- **admin** : accès total, gestion des utilisateurs et paramètres.
- **directeur_commercial** : tous les dossiers, catalogue, plans, recrutement, stats collectives.
- **conseiller** : ses propres dossiers/contacts, catalogue en lecture seule,
  pas de recrutement ni d'export RGPD.

## Schéma Supabase

Voir `supabase/migrations/` (7 fichiers ordonnés) : enums + socle, CRM, formations/dossiers,
documents/kanban/mail/recrutement, audit/paramètres, **policies RLS**, et **seed** des
financeurs, workflows, formations et tableau Kanban par défaut.

## Stockage de fichiers (Supabase Storage)

Migration `supabase/migrations/20250101000008_storage.sql` : buckets `documents` (public),
`pieces` (privé), `cv` (privé) + policies pour utilisateurs authentifiés. L'upload est câblé
dans **Dossiers › pièces justificatives**, **Espace documentaire** et **Recrutement › CV**.
Les buckets privés sont ouverts via des **URL signées** (`createSignedUrl`).

## Envoi d'e-mails (Edge Function SMTP)

`supabase/functions/send-email/index.ts` (Deno + denomailer). La page **Messagerie** l'appelle
via `supabase.functions.invoke('send-email', …)`.

```bash
supabase functions deploy send-email
supabase secrets set SMTP_HOST=… SMTP_PORT=587 SMTP_USERNAME=… SMTP_PASSWORD=… SMTP_FROM=…
```

Sans déploiement/secrets, l'envoi échoue proprement et le message est conservé en brouillon.

## Points d'extension (CDC v2 / Lot 4)

- Réception e-mail (IMAP) et synchronisation → Edge Function dédiée.
- Connecteurs financeurs (EDOF…) et signature électronique → intégrations externes.
- Régénération des types : `npx supabase gen types typescript` → `src/lib/database.types.ts`.
