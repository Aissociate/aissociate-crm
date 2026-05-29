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

### Réception IMAP

`supabase/functions/fetch-emails/index.ts` (imapflow + mailparser). Le bouton **Synchroniser**
de la Messagerie (onglet **Reçus**) appelle cette fonction ; elle relève les messages non lus de
la boîte INBOX, les insère (`direction = 'entrant'`, dédoublonnés sur `message_id`) et les marque
lus côté serveur.

```bash
supabase functions deploy fetch-emails
supabase secrets set IMAP_HOST=… IMAP_PORT=993 IMAP_USERNAME=… IMAP_PASSWORD=…
```

**Relève automatique** : la migration `…195603_cron_imap.sql` planifie un appel à `fetch-emails`
toutes les 15 min via `pg_cron` + `pg_net`. Prérequis — créer deux secrets dans **Supabase → Vault** :
`project_url` (= `https://<ref>.supabase.co`) et `service_role_key`. Si absents, la migration ne
plante pas (NOTICE) ; rejouez-la après avoir ajouté les secrets.

## Intégration continue (GitHub Actions)

`.github/workflows/ci.yml` exécute `npm ci` + `npm run build` (typecheck Vite/tsc) à chaque push
et pull request sur `main`.

## Versioning des pièces justificatives

Chaque pièce d'un dossier conserve son historique : téléverser un fichier remplaçant un fichier
existant archive l'ancien dans `piece_versions` (migration 10) et incrémente `dossier_pieces.version`.
L'historique est consultable depuis la fiche dossier (bouton `vN` à côté de la pièce).

## Import Google Sheets (candidatures & prospects)

`supabase/functions/import-sheets/index.ts` importe deux Google Sheets publiés
(« toute personne avec le lien ») dans Supabase, de façon **idempotente**
(déduplication via `external_id`) :

- **Candidatures « Chargé de formation »** (export Meta Lead Ads) → table `candidats`,
  rattachées à l'offre *Chargé de formation*. Les réponses libres (motivation,
  expérience, etc.) sont consignées en notes.
- **Prospects en cours** → table `contacts` (type *prospect*). Entreprise, ville,
  questionnaire **et commentaires** (colonnes de suivi) sont conservés en **notes**.

Déclenchement :
- **Manuel** — boutons « Importer candidatures » (Recrutement) et « Importer prospects » (Contacts).
- **Automatique** — migration `…195605_cron_import.sql` (toutes les heures via `pg_cron`).

```bash
supabase functions deploy import-sheets
# IDs surchargeables si besoin :
supabase secrets set SHEET_CANDIDATS_ID=… SHEET_PROSPECTS_ID=…
```

Les IDs des deux feuilles fournies sont les valeurs par défaut intégrées à la fonction.

## Points d'extension (CDC v2 / Lot 4)

- Connecteurs financeurs (EDOF…) et signature électronique → intégrations externes.
- Régénération des types : `npx supabase gen types typescript` → `src/lib/database.types.ts`.
