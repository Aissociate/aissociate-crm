# Studio IA : espace agentique des entreprises clientes

Les entreprises qui souscrivent à l'offre « agents IA » d'Aissociate se connectent
sur `/studio` avec un e-mail et un mot de passe. Elles y trouvent une équipe d'agents
spécialisés qui connaissent leur entreprise. Le module s'inspire de limova.ai : des
agents avec un prénom, la valeur affichée en temps gagné, une base de ressources qu'on
active ou désactive, et des demandes prêtes à l'emploi.

## Isolation (à préserver)

| Couche | Emplacement | Contact avec le CRM |
|---|---|---|
| Front client | `src/studio/` (pages, api, composants) | aucun import `@/…` |
| Admin CRM | `src/studio/admin/StudioAdmin.tsx` | `@/lib/supabase`, `@/components/ui` |
| Routes | `src/App.tsx` | `/studio/*` (lazy) et `/studio-admin` (managers) |
| Menu | `src/components/Layout.tsx` | 1 entrée « Studio IA clients » |
| Données | migration `20261111100000_studio_agents.sql` | tables `studio_*` ; seule FK vers le CRM : `studio_workspaces.entreprise_id` |
| Serveur | `supabase/functions/studio/` (`verify_jwt = false`) | lit `parametres.ai` (clé et modèle OpenRouter) |

**Les clients ne sont pas des utilisateurs Supabase Auth.** Une vingtaine de politiques
RLS du CRM ouvrent des lectures à tout rôle `authenticated`, donc un JWT client verrait
des données du CRM. Le Studio a sa propre authentification :
- mot de passe haché en PBKDF2-SHA256 (`studio_credentials`, qu'aucune politique RLS
  n'ouvre, même aux managers) ;
- jeton de session opaque de 64 caractères hexadécimaux, valable 30 jours. Le navigateur
  le garde dans le localStorage, la base n'en stocke que le SHA-256 (`studio_sessions`) ;
- anti brute-force : 5 échecs par e-mail en 15 minutes (`studio_login_echecs`).

L'Edge Function lit tout en service role et filtre **chaque** requête par le
`workspace_id` de la session. `studio_recherche_docs` (recherche plein texte) est
réservée au `service_role`.

## Cycle de vie
1. CRM › Studio IA clients › **Nouvel espace** : nom, entreprise du CRM, offre, quota,
   échéance et fiche entreprise.
2. Rouvrir l'espace et **créer un accès**. Un mot de passe provisoire s'affiche une
   seule fois, à transmettre au client, qui doit le changer à sa première connexion.
3. Le client complète « Mon entreprise » et importe ses ressources (PDF, TXT, MD ou CSV,
   texte extrait dans le navigateur), puis confie des missions aux agents.
4. Le CRM suit l'usage via la vue `studio_usage_mois` (missions du mois, dernière activité).

## Modèle IA
Le modèle se règle dans CRM › Studio IA clients, avec un sélecteur qui charge le catalogue
OpenRouter via l'action `admin_modeles` (clé du CRM) et le classe par constructeur, avec les prix.
Le premier niveau renseigné l'emporte :
1. `studio_workspace_agents.modele` : cet agent, pour ce client ;
2. `studio_workspaces.modele` : tous les agents de ce client ;
3. `studio_agents.modele` : cet agent, par défaut ;
4. `parametres.ai.model_studio` (s'il est autorisé), sinon `deepseek/deepseek-v4.1-flash-1017`.

Seuls les modèles de `MODELES_STUDIO` (dans `supabase/functions/studio/index.ts`) sont acceptés : DeepSeek V4.1 Flash, Mistral Large 4 et Claude Haiku 5.5. Tout autre réglage enregistré en base est ignoré.

La clé reste celle du CRM : le secret `OPENROUTER_API_KEY`, sinon `parametres.ai.openrouter_key`.
Les réponses arrivent en flux SSE (`meta`, `delta`, `done`, `error`) et le raisonnement
éventuel du modèle n'est jamais relayé.

## Base de connaissances par agent
`studio_agent_savoirs` contient le savoir-faire d'Aissociate, commun à tous les clients (dispositifs, règles, méthodes).
Elle s'édite dans CRM › Studio IA clients › Catalogue d'agents › un agent. On peut saisir du texte ou importer
un fichier PDF, TXT, MD ou CSV.
- Avant chaque demande, l'agent reçoit les documents pertinents (`studio_recherche_savoirs`), complétés par les plus
  récents dans un budget de 8 000 caractères.
- Il doit terminer sa réponse par « Sources : titre (référence) » et ne jamais citer un document absent de la liste.
- Le client voit seulement les titres et références consultés, jamais le contenu brut.
- Si la migration `20261112100000_studio_savoirs.sql` n'est pas appliquée, la fonction continue de tourner, sans base.

## Exports Word / PDF et papier à en-tête
Chaque réponse texte d'un agent, ainsi que chaque contenu gardé, propose deux boutons : **Word** et **PDF**.
- `exportDoc.ts` (module pur, testé) convertit le Markdown en blocs. Il produit le HTML imprimable du PDF et le `.docx`.
- `exports.ts` fait le lien avec le navigateur :
  - la bibliothèque `docx@9.5.1` est chargée au premier clic depuis esm.sh, sans toucher au bundle ni au lockfile ;
  - le logo est converti en PNG (Word ne lit pas le WebP) ;
  - le PDF est produit par l'impression d'un cadre caché (« Enregistrer au format PDF »).
- Papier à en-tête : « Mon entreprise » › Papier à en-tête (coordonnées et logo). Les données sont en base dans
  `studio_workspaces.entete` et `logo_chemin` (migration `20261112120000`). Le logo est rangé dans le bucket
  `studio-medias`, en PNG, JPEG ou WebP (pas de SVG), 500 Ko au maximum.
- Si la migration n'est pas appliquée, le bloc d'en-tête est masqué et les exports partent sans en-tête.

## Images et vidéos
Un super-pouvoir porteur de `"media": "image"` ou `"media": "video"` ne passe pas par le chat :
la fonction lance une génération (`medias.ts`) et crée une ligne `studio_medias`.
- Images : `meta/muse-image` (environ 0,01 $), générée en tâche de fond, puis la page vérifie
  l'avancement via `media_statut`.
- Vidéos : `minimax/hailuo-3-max` en 768p (0,08 $ la seconde). Le job OpenRouter est vérifié
  à chaque `media_statut` et, une fois terminé, le fichier est rapatrié.
- Fichiers dans le bucket privé `studio-medias`, servis par des URL signées valables 1 h.
- Quotas mensuels `quota_images_mois` et `quota_videos_mois` par espace (0 = désactivé).
- Les champs nommés `format` et `duree` du formulaire deviennent `aspect_ratio` et `duration`.

## Suite envisagée
Plusieurs espaces par entreprise (pôles), invitations par les propriétaires, connecteurs
(Gmail, Google Agenda, LinkedIn) avec actions validées par l'utilisateur, missions
récurrentes planifiées, WhatsApp.
