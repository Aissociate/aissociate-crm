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

## Connexions en un clic (Zernio)
Le client connecte lui-même ses comptes : bouton « Connecter » dans Studio › Connecteurs, ou lien reçu par
e-mail (`/studio/connecter/<jeton>`, valable 7 jours, envoyé depuis le Studio ou le CRM). Tout passe par
Zernio (`zernio.ts`, `bureau.ts`) : Google (Gmail, Agenda, Drive), Microsoft (Outlook, calendrier, OneDrive),
toute autre messagerie en IMAP (page hébergée `GET /connect/email`), Facebook, Instagram, LinkedIn, TikTok.

**Cloisonnement par client (tenant = `studio_workspaces.id`) :** un profil Zernio par espace, retrouvé par
son `externalId` (= id de l'espace). L'espace vient toujours du serveur (session, invitation ou appel manager
vérifié). Toute opération vérifie que le compte visé appartient au profil de l'espace. `studio_connexion_invitations`
n'a aucune politique côté client ; seul le SHA-256 du jeton est stocké.

**Coût et limites (à connaître) :**
- chaque compte connecté est facturé par Zernio au-delà de 2 (une boîte Google ou Microsoft compte une fois,
  quelles que soient ses zones) ; un moyen de paiement est requis au 3e compte et pour envoyer depuis Gmail ou IMAP ;
- Google Drive est connecté en `drive.file` : les agents ne voient que les documents qu'ils créent et ceux que le
  client choisit (bouton « Choisir des fichiers Drive », sélecteur hébergé par Zernio). OneDrive est lisible en entier ;
- une boîte sert au courrier individuel : le même contenu vers plus de 50 personnes en une heure met la boîte
  en pause. Les mailings partent donc à 45 par heure au plus, et sous un plafond quotidien par fournisseur
  (Gmail 180, Google Workspace 450, Microsoft 900, IMAP 180 ; remis à zéro à minuit UTC).

**Outils des agents :** selon les zones de la boîte connectée (`scopeAreas`) :
- `mail_rechercher`, `mail_lire`, `mail_proposer_envoi` ;
- `agenda_lister`, `agenda_proposer_rdv` ;
- `fichiers_rechercher`, `fichiers_lister`, `fichiers_lire` (texte, PDF, Docs/Slides exportés en PDF, Sheets et
  Excel, Word), `fichiers_creer_document` (Google Doc sur Drive, fichier Word sur OneDrive).

Les lectures s'exécutent tout de suite et sont tracées au journal. Les écritures enregistrent un livrable
« à valider » portant l'action (`studio_livrables.action`, avec `compte_id`) ; le « VALIDÉ » du propriétaire
l'exécute, puis passe le livrable en « publié » avec le lien. En cas d'échec, l'erreur est notée en clair
(paiement, accès manquant, plafond) et l'action peut être relancée.

**Compétences, ressources et pièces jointes :** tous les agents ont toujours deux outils, `ressource_lire`
(relit en entier une note, une compétence ou un fichier de l'index des ressources actives) et
`competence_enregistrer` (crée ou met à jour une note « Compétence — … » dans Mes ressources, signée par
l'agent, tracée au journal). La boucle du chat reste en flux : les appels d'outils arrivent par fragments
(`flux.ts`). Si le modèle ne sait pas appeler d'outils, la requête est relancée sans outils. Le chat accepte
jusqu'à 5 pièces jointes : PDF, Word, Excel, PowerPoint, OpenDocument, CSV et texte. Le texte est extrait
dans le navigateur (`src/studio/extraction.ts`, bibliothèques chargées depuis esm.sh), puis stocké dans
`studio_messages.pieces` et relu aux tours suivants. Un rappel en fin de prompt impose d'utiliser la fiche
entreprise et les ressources plutôt que des champs « à compléter ».

**Configuration :** secret Supabase `ZERNIO_API_KEY`. Les secrets `NANGO_*`, la fonction `nango-webhook`
et la table `studio_nango_connexions` ne servent plus.

## Dossiers (`dossiers.ts`, `src/studio/Dossiers.tsx`)
Arborescence par espace (`studio_dossiers`, 5 niveaux) pour ranger ressources (notes, fichiers, compétences),
livrables et visuels (`dossier_id` sur `studio_documents`, `studio_livrables`, `studio_medias`).
- Client : barre de dossiers dans Ressources, Livrables et Contenus (créer, renommer, supprimer), sélecteur
  « Ranger dans » sur chaque élément ; ce qu'on ajoute en regardant un dossier y est rangé.
- Agents : `note_enregistrer` (note avec dossier), `ranger` (ressource par titre, livrable par référence L-…,
  visuel par description), `dossiers_lister` ; `competence_enregistrer` accepte un dossier. Un chemin
  « Clients/Dupont » crée les dossiers manquants. L'arborescence et le dossier de chaque ressource sont dans
  la consigne. Rangements tracés au journal.
- Supprimer un dossier ne supprime rien d'autre : contenu et sous-dossiers remontent d'un niveau.

## Images et documents mis en forme (`vision.ts`, `html.ts`, `EditeurDocument.tsx`)

- **Images jointes au chat** (bouton trombone ou coller une capture) : le navigateur les réduit à
  1 600 px en JPEG. Le serveur les fait ensuite décrire et retranscrire par un modèle de vision
  (`parametres.ai.model_vision`, par défaut `anthropic/claude-haiku-5.5`).
  - La description rejoint les pièces jointes du message : tout agent en profite, quel que soit son
    modèle, ainsi que la suite de la conversation.
  - L'image elle-même n'est pas conservée, et le coût de lecture s'ajoute à celui de la demande.
- **Documents HTML** : outils `document_rediger`, `document_lire` et `document_modifier`. Le document
  est un livrable `format = 'html'` (à valider, avec versions).
  - Il s'ouvre dans un panneau à droite du chat, et depuis Livrables.
  - Il est modifiable en WYSIWYG dans un cadre `sandbox="allow-same-origin"` sans `allow-scripts`
    (`designMode`), puis exporté en PDF (impression) ou Word (.doc HTML) avec le papier à en-tête.
  - Nettoyage à deux niveaux : `nettoyerHtml` côté serveur (création et chaque enregistrement) et
    `htmlSur` dans le navigateur (affichage, impression, export).

## Missions d'équipe (`equipe.ts`)

- L'agent qui reçoit la demande peut consulter un collègue ouvert dans l'espace avec l'outil
  `consulter_collegue`. Exemple : un article de blog, avec l'angle par le marketing et les mots-clés par le SEO.
  Il intègre ensuite la contribution dans un seul livrable.
- Garde-fous :
  - 3 consultations par demande au plus ;
  - le collègue répond sans outils, donc ne consulte pas à son tour, et sa balise de relais est retirée ;
  - son coût OpenRouter s'ajoute à celui de la demande ;
  - chaque consultation est notée au journal (`consultation`).
- Une consultation ne compte pas dans le quota : seul le message du client compte. La réponse finale se
  termine par « _Avec l'aide de …_ ».
- La balise de relais reste réservée aux demandes entièrement hors du métier de l'agent.

## Quotas, demandes et recharges (`recharges.ts`)

- **1 demande = 1 message envoyé à un agent**, relances comprises, que ce soit par le chat, une tâche
  ou un e-mail. Ne comptent pas (`studio_messages.hors_quota`) :
  - une demande relayée à un collègue ;
  - un visuel ou une vidéo, qui ont leurs propres quotas.
- Quand un quota du mois est atteint, l'usage puise dans les **crédits de recharge**. Le registre
  `studio_recharges` (achat, offert, correction, consommation) ne périme pas : le solde se reporte de mois en mois.
  - Coûts par défaut : 1 demande = 1 crédit, 1 visuel = 5, 1 vidéo = 30.
  - Un visuel ou une vidéo en échec, ou une demande relayée, est recrédité.
- Packs : 10 € HT = 100 crédits et 30 € HT = 350 crédits. Ils se règlent dans CRM › Studio IA ›
  Paramètres et peuvent être modifiés par client dans sa fiche (`recharge_packs`).
- Achat en libre-service par le propriétaire dans « Mon périmètre » (`recharge_acheter`), si
  `recharge_achat_libre` le permet.
- Le CRM peut ajouter des crédits (offerts, achat à facturer, correction). Les achats du mois
  entrent dans le revenu de l'onglet Rentabilité. Aucun paiement en ligne : la facturation reste manuelle.

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
