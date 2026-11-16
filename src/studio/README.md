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

## Connexions en un clic (Nango)
Le client connecte lui-même ses applications : bouton « Connecter » dans Studio › Connecteurs, ou lien reçu
par e-mail (`/studio/connecter/<jeton>`, valable 7 jours). Toute intégration activée dans le compte Nango
apparaît automatiquement.

**Cloisonnement par client (tenant = `studio_workspaces.id`) :**
1. Seule l'Edge Function `studio` crée les sessions Nango, avec le tag `organization_id` égal à l'espace de
   la session Studio, ou de l'invitation, ou d'un appel manager vérifié. Ce n'est jamais une valeur envoyée
   par le navigateur.
2. Le webhook `nango-webhook` vérifie d'abord la signature HMAC-SHA256 du corps brut. Il rattache ensuite
   la connexion à l'espace lu dans les tags, refuse un espace inexistant et ne déplace jamais une connexion
   d'un espace à un autre.
3. La synchronisation de secours ne liste chez Nango que `tags[organization_id]=<espace>`, puis revérifie le tag.
4. `studio_nango_connexions` et `studio_connexion_invitations` n'ont aucune politique côté client : seul le
   service role y écrit, et les managers les lisent. Pour les invitations, seul le SHA-256 du jeton est stocké.

**Page Connecteurs :**
- les cartes Google Workspace, Outlook / Microsoft 365, Facebook, Instagram, LinkedIn et TikTok affichent un
  bouton « Connecter » par service dès que l'intégration correspondante est activée dans Nango (rapprochement
  par fournisseur : `google-mail`, `google-calendar`, `google-drive`, `outlook`, `microsoft`, `facebook`,
  `instagram`, `linkedin`, `tiktok-accounts`…). Sans intégration activée, la carte garde la demande assistée ;
- SMTP et serveur MCP restent des connexions directes ;
- « Sur demande, en contactant Aissociate » liste tout le catalogue Nango (`GET /providers`, cache 24 h). Une
  demande crée une ligne `studio_connecteurs` de type `app:<fournisseur>`, suivie dans le CRM. Pour la
  servir : activer l'intégration dans Nango, elle apparaît alors en un clic chez le client.

**Outils des agents (Google Drive) :** `outils.ts` + `drive.ts`. Si l'espace a une connexion `google-drive`,
le chat passe en appel de fonctions : `drive_rechercher`, `drive_lister`, `drive_lire` (exécutés tout de suite,
tracés au journal) et `drive_creer_document`, qui ne crée rien mais enregistre un livrable « à valider »
portant l'action (`studio_livrables.action`). Le « VALIDÉ » du propriétaire exécute l'action, puis passe le
livrable en « publié » avec le lien (`resultat`). En cas d'échec, l'erreur est notée et le dépôt peut être
relancé. Le jeton Google est demandé à Nango pour la connexion de l'espace de la session uniquement.
Migration `20261117120000_studio_outils.sql`.

**Compétences, ressources et pièces jointes :** tous les agents ont toujours deux outils, `ressource_lire`
(relit en entier une note, une compétence ou un fichier de l'index des ressources actives) et
`competence_enregistrer` (crée ou met à jour une note « Compétence — … » dans Mes ressources, signée par
l'agent, tracée au journal). La boucle du chat reste en flux : les appels d'outils arrivent par fragments
(`flux.ts`). Si le modèle ne sait pas appeler d'outils, la requête est relancée sans outils. Le chat accepte
jusqu'à 5 pièces jointes : PDF, Word, Excel, PowerPoint, OpenDocument, CSV et texte. Le texte est extrait
dans le navigateur (`src/studio/extraction.ts`, bibliothèques chargées depuis esm.sh), puis stocké dans
`studio_messages.pieces` et relu aux tours suivants. Un rappel en fin de prompt impose d'utiliser la fiche
entreprise et les ressources plutôt que des champs « à compléter ».

**Configuration :**
- secrets Supabase `NANGO_SECRET_KEY` et `NANGO_WEBHOOK_SIGNING_KEY` ;
- dans Nango › Environment settings › Webhooks, l'URL `https://<projet>.supabase.co/functions/v1/nango-webhook` ;
- migration `20261116100000_studio_nango.sql`.

## Coûts, rentabilité et rapport mensuel
- **Coût réel** : chaque réponse enregistre `cout` (USD), les tokens et le modèle, lus dans le dernier fragment du
  flux OpenRouter (`usage`). Les médias gardent leur coût ; une vidéo sans coût renvoyé est estimée à 0,08 $/s.
  La démo Sam journalise le sien dans `studio_demo_appels.cout`.
- **CRM › Rentabilité** :
  - par client et par mois : abonnement HT (saisi dans la fiche de l'espace), missions, part de réponses
    « à revoir », coût IA en € (taux USD → EUR réglable), marge ;
  - le coût de la démo Sam est affiché à part ;
  - les données viennent de la vue `studio_rentabilite_mois`.
- **Rapport mensuel de valeur** (`rapport.ts`, pur et testé) : missions, temps gagné estimé, contenus gardés,
  visuels, détail par agent et comparaison avec le mois précédent, **sans aucun coût**. Le client le voit dans
  Studio › Rapport mensuel et peut l'exporter en PDF ou Word. Le CRM l'imprime aux couleurs du client (bouton « Rapport »).
- Si la migration `20261112140000_studio_couts.sql` n'est pas appliquée : les réponses sont enregistrées sans coût
  et l'onglet Rentabilité indique la migration manquante.

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

## Gouvernance (reprise du paquet « plateforme multi-tenant », vague 1)
Migration `20261116120000_studio_gouvernance.sql`, logique serveur dans
`supabase/functions/studio/gouvernance.ts`.
- **Onboarding** : questionnaire public `/studio/demarrer` (définition unique
  `supabase/functions/studio/questionnaire.ts`, partagée par le front et la fonction, testée).
  La demande arrive dans `studio_onboarding` avec un score de maturité /100, des points
  d'attention RGPD et un lead `contact_requests`. CRM › Studio IA › Demandes → « Créer
  l'espace » (`admin_provisionner`) : espace, agents choisis ouverts, quotas et plafond par
  défaut (onglet Paramètres), fiche entreprise pré-remplie, propriétaire avec mot de passe provisoire.
- **Mon périmètre** : formule, agents inclus / hors formule, consommation du mois,
  plafond IA du jour, arrêt d'urgence (`suspendre`, propriétaire ; `admin_suspendre`, CRM).
- **Plafond de dépense** : `budget_ia_jour_eur` par espace ; au plafond, chat et médias
  sont refusés jusqu'au lendemain (jour de La Réunion). Coût réel OpenRouter × `taux_usd_eur`.
- **Journal** : `studio_journal`, chaîné par SHA-256 (`journal.ts`, testé) ; missions,
  médias, livrables, connecteurs, suspension. Vérification de la chaîne dans la fiche espace (CRM).
- **Livrables** : « Soumettre à validation » sous une réponse → `studio_livrables`
  (`a_valider` → `valide` / `refuse` → `publie`). Seul le propriétaire décide.

## Canal e-mail de liaison (vague 2 du paquet)
Migration `20261117100000_studio_liaison.sql`. Une boîte AgentMail par espace, créée
depuis la fiche espace du CRM (`admin_liaison`). Les e-mails arrivent par webhook
AgentMail signé Svix sur l'URL de la fonction `studio` (en-têtes `svix-*`), traités en
arrière-plan (`EdgeRuntime.waitUntil`) par `liaison_traitement.ts`.
- Écoutés : les utilisateurs actifs de l'espace, depuis leur adresse de connexion, avec
  SPF/DKIM/DMARC corrects. Le reste part en quarantaine, sans réponse.
- Fraude au président (IBAN, virement, cartes prépayées) : jamais exécuté, même par un
  utilisateur autorisé ; une suspension demandée dans le même message s'applique.
- `[Hugo] objet` désigne l'agent (sinon l'agent par défaut de l'espace). La mission passe
  par le même chemin que le chat (garde, quotas, coût, journal) ; la réponse revient dans
  le fil et devient un livrable « à valider » (référence `L-xxxxxxxx`).
- Propriétaire : `VALIDÉ L-…` / `REFUSÉ L-…`, `SUSPENDRE`, `REPRENDRE`.
- Registre `studio_instructions` (référence `INSTR-AAAA-NNNN`, dédoublonné par `event_id`),
  30 messages / heure / espace au plus, réponses marquées `Auto-Submitted` (pas de boucle).
- Secrets : `AGENTMAIL_API_KEY`, `AGENTMAIL_WEBHOOK_SECRET` (+ `_PRECEDENT` en rotation).

## Suite envisagée
Publication réseaux sociaux,
outils Nango utilisés par les agents (sessions d'agent avec connexions épinglées),
plusieurs espaces par entreprise (pôles), missions récurrentes planifiées.
