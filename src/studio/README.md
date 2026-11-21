# Studio IA : espace agentique des entreprises clientes

Les entreprises qui souscrivent à l'offre « agents IA » d'Aissociate se connectent
sur `/studio` avec un e-mail et un mot de passe. Elles y trouvent une équipe d'agents
spécialisés qui connaissent leur entreprise. Le module s'inspire de limova.ai : des
agents avec un prénom, la valeur affichée en temps gagné, une base de ressources qu'on
active ou désactive, et des demandes prêtes à l'emploi.

## Navigation et écran « Aujourd'hui » (refonte, lot 2)

- **Cinq entrées** (`routes.ts`, testé) : Aujourd'hui, Mon équipe, Routines, Mes documents, Réglages et connecteurs.
  Les anciennes pages sont devenues les onglets de leur section. Les anciennes adresses (`/studio/livrables`,
  `/studio/connecteurs`…) redirigent en gardant paramètres et ancre : le serveur renvoie encore vers
  `/studio/connecteurs?…` (connexion d'un compte) et `/studio/perimetre?…` (Stripe). Pour ajouter une page :
  un onglet dans `SECTIONS`, une route dans `StudioApp.tsx`.
- **Aujourd'hui** (`pages/Aujourdhui.tsx`, `aujourdhui/`) : la file des livrables « à valider », une seule carte
  dépliée à la fois.
  - Bouton nommé par l'effet et pastille de portée : `decision.ts` (testé), déduits de l'action du livrable.
  - Valider retient l'appel 8 secondes (`useDecisions.ts`) : « Annuler » empêche l'envoi. Onglet fermé pendant ce
    délai : rien ne part. Changement de page dans le Studio : l'envoi part tout de suite.
  - Refuser passe par les quatre raisons du lot 1 ; « Annuler » remet le livrable « à valider ».
  - « mission confiée par Léa » n'apparaît que si c'est vrai (`studio_livrables.confie_par`, migration
    `20261123100000`, écrit par `outils.ts` › `creerLivrable` quand Léa missionne un spécialiste). La relecture
    elle-même n'est pas tracée, donc pas affichée.
  - Colonne de droite : action serveur `aujourdhui` (`faits.ts`, testé). « Fait sans vous » met en phrases le
    journal des 7 derniers jours ; le temps gagné reprend la règle du mois ; « À venir » liste les prochains
    passages de routines et les publications programmées.
  - Dictée : reconnaissance vocale du navigateur (`aujourdhui/DemanderLea.tsx`), bouton masqué si elle manque.
- **Téléphone** (moins de 640 px, `aujourdhui/DecisionsMobile.tsx`) : une décision par écran, « Plus tard » passe à
  la suivante sans rien enregistrer, « Parler à Léa » dicte et envoie la demande.
- Les jetons visuels de la spécification (fond `#F6F5F3`, texte `#141414`, accent `#EA6A1E`, cibles de 44 px)
  s'appliquent au menu et à « Aujourd'hui » ; les autres pages gardent leurs tailles actuelles.

## « Mon équipe » et missions guidées (refonte, lot 3)

- **Mon équipe** (`pages/Equipe.tsx`) : une carte compacte par agent, avec « Fait seul », « Vous demande toujours »
  et un état seulement s'il est utile (« N décisions vous attendent », « Au travail »). L'action serveur `equipe`
  renvoie ces états (`livrables.ts` › `etatsAgents`, testé) et les comptes branchés de l'espace, affichés une fois
  en tête puisqu'ils sont communs à toute l'équipe.
- **Fiche d'un spécialiste** (`pages/Specialiste.tsx`, `/studio/equipe/:agent`) : sélecteur en pastilles, tuiles de
  pouvoirs (« Vous recevez : … »), panneau de mission.
- **Mission guidée** (`missionGuidee.ts`, testé sur les 26 pouvoirs des migrations) : le guide est déduit des champs
  du pouvoir, sans réécrire sa consigne. Le premier champ à choix devient la question en un clic, le premier texte
  obligatoire devient la précision (écrite ou dictée), le reste s'affiche en dessous. Un pouvoir ajouté depuis le
  CRM est donc guidé d'office. Le catalogue peut reformuler : `recoit` sur le pouvoir, `question` sur un champ.
- **Résultat dans « Aujourd'hui »** : `chat {…, pouvoir, mission: true}` soumet la réponse comme livrable à valider
  (`livrables.ts` › `soumettreMission`), sauf réponse vide, relais vers un collègue, ou proposition déjà déposée par
  l'agent pendant la mission. Visuels et vidéos restent dans « Contenus ».
- Les textes « Fait seul » / « Vous demande toujours » des 7 agents sont dans `missionGuidee.ts` (`AUTONOMIE`) ; un
  agent inconnu reçoit la règle commune. La conversation libre reste à `/studio/assistants/:agent`.

## Routines (refonte, lot 4)

- **Chaîne d'étapes** (`supabase/functions/studio/routines.ts`, testé) : départ (jours et heures), étapes d'agent,
  « Vous validez », envoi. Une validation est insérée d'office devant le premier envoi et ne peut pas être retirée.
  11 modèles par métier (`MODELES`), avec réglages (compteur, choix, bascule, texte) et une seule question à la
  création. « En clair » et l'historique en phrases sont calculés côté serveur.
- **Écrans** : `pages/Routines.tsx` (cartes), `pages/Routine.tsx` (`/studio/routines/:id` : chaîne, panneau de
  réglage par étape, « La dernière fois », historique), `pages/NouvelleRoutine.tsx` (`/studio/routines/nouvelle` :
  demande écrite ou dictée à Léa via `routine_proposer`, ou galerie `routine_modeles`, puis `routine_creer`).
- **Depuis le chat** (`functions/studio/routine_outil.ts`) : Léa seule a l'outil `routine_proposer` ; sa
  proposition (mêmes contrôles que `validerProposition`) devient une décision `routine_creer` dans « Aujourd'hui »,
  sans bouton « Modifier ». Au « VALIDÉ », la routine est créée en mode essai, comme depuis la page.
- **Mode essai** : 7 jours à la création. Les livrables sont notés dans un carnet (`Ctx.essai`, `outils.ts`) sans
  rien envoyer ni écrire. À la fin, une décision « Mettre en route » (`routine_activer`) arrive dans
  « Aujourd'hui » ; la routine reste à l'essai tant qu'elle n'est pas validée. « Essayer sur un vrai cas » lance un
  passage d'essai à la demande.
- **Passages** (`studio_routine_passages`) : un par exécution. Un échec planifié est repris une heure plus tard
  (`reprise_prevue`, deuxième et dernière tentative) ; l'historique fusionne l'échec et sa reprise en un incident.
- Pas de déclencheur par événement : plusieurs heures par jour font office de surveillance. Sans la migration
  `20261124100000_studio_routines.sql`, les actions répondent 503 et l'ancienne liste reste lisible.

## Isolation (à préserver)

| Couche | Emplacement | Contact avec le CRM |
|---|---|---|
| Front client | `src/studio/` (pages, api, composants) | aucun import `@/…` ; seule exception : les modules autonomes du signalement de bug (`src/lib/captureEcran.ts`, `bugContext.ts`, `AnnotateurCapture.tsx`), sans Supabase ni auth CRM |
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
- Les agents reçoivent ces coordonnées dans leur contexte (`blocCoordonnees`, `contexte.ts`) et ne recréent pas
  l'en-tête dans un document HTML : l'aperçu (`EditeurDocument`) et les exports l'ajoutent autour du contenu.

## Paiement en ligne Stripe (`stripe.ts`)
- Recharges : « Mon périmètre » ouvre une page Stripe Checkout (paiement unique, facture Stripe). Les crédits
  ne sont ajoutés qu'à la confirmation (webhook), une seule fois par session (`studio_recharges.stripe_ref` unique).
- Abonnement mensuel : agents ouverts au tarif dégressif (prix `studio_agents_v2`, paliers 149 → 74,50 € HT, sans frais de mise en place)
  + connecteurs facturés (`studio_connecteur_<centimes>`), TVA fixe 8,5 % (La Réunion). Portail client Stripe
  (carte, factures, résiliation en fin de période) ; « Mettre à jour mon abonnement » aligne les quantités au prorata.
- Le compte Stripe est partagé avec d'autres produits : tout porte `metadata.app = "studio"`, le portail a sa propre
  configuration, et le webhook du Studio (événements `checkout.session.*`, `customer.subscription.*`) pointe vers
  cette fonction (en-tête `Stripe-Signature`).
- Secrets : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (migration `20261118200000`). Sans clé, l'ancien
  fonctionnement reste : la recharge est créditée tout de suite et facturée à part.
- Passage du bac à sable au réel : changer les deux secrets, recréer le webhook côté réel, puis
  `update studio_workspaces set stripe_client = null, stripe_abonnement = null, abonnement_statut = null;`.
  Produits, prix, taux de TVA et configuration du portail sont recréés automatiquement.

- TVA : taux fixe de 8,5 % pour tous les clients (`TAXE_AUTOMATIQUE = false` dans `stripe.ts`, décision du 18/11/2026).
  Le calcul automatique (8,5 % à La Réunion, Stripe Tax ailleurs) reste codé : le réactiver exige une immatriculation
  TVA France sur le compte Stripe réel, qui n'en a pas.
- Libellé bancaire des abonnements : « AISSOCIATE STUDIO IA », posé sur les produits Stripe du Studio (le libellé par
  défaut du compte partagé est celui d'un autre produit). Les recharges portent le suffixe « STUDIO IA ».

## Essai gratuit, identifiants et CGV (`essai.ts`, `courriel.ts`, `cgv.ts`)
- Fin du questionnaire (`essai_auto` = true) : espace `offre = 'essai'` créé avec les agents demandés,
  `essai_fin` = +7 jours (`essai_jours`), mot de passe provisoire envoyé par e-mail depuis contact@aissociate.re
  (serveur SMTP du CRM ; secrets `STUDIO_SMTP_USERNAME` / `STUDIO_SMTP_PASSWORD` de la boîte contact@ si le
  serveur refuse cet expéditeur pour la boîte du CRM ; dernier repli : expéditeur du CRM, réponses vers contact@). Échec d'envoi : espace créé, `studio_onboarding.identifiants_envoyes_le` vide.
- Pendant l'essai : quotas habituels, sauf deux garde-fous réglés dans CRM › Studio IA › Paramètres et lus à
  chaque demande (`studio_config`) : `essai_connecteurs_max` (1 par défaut, Zernio ou manuel) et
  `essai_quota_videos` (0 par défaut : la vidéo s'ouvre à l'abonnement). Rien n'est écrit sur l'espace : dès
  l'abonnement payé, ses quotas reprennent seuls. L'accompagnement de 15 jours démarre à l'abonnement. Après : seules les actions de
  `ACTIONS_APRES_ESSAI` répondent (Mon périmètre, abonnement, mot de passe, CGV, en-tête) ; missions par e-mail
  et tâches planifiées s'arrêtent. Un abonnement payé lève le blocage et passe l'offre en « essentiel ».
- CGV : livrables désignés par `studio_config.cgv_livrables` (ids, dans l'ordre). Version = empreinte des textes ;
  acceptation horodatée par utilisateur (`studio_users.cgv_*`, IP et navigateur), rien d'autre n'est accessible avant.

## Autonomie du client (mot de passe, agents, inscriptions)
- **Mot de passe oublié** : `mdp_oublie {email}` répond toujours `ok` (pas d'énumération des comptes), au plus 3 liens par heure et par compte.
  Le lien `/studio/mot-de-passe/:jeton` vaut une heure et ne sert qu'une fois (`studio_reinitialisations`, seul le SHA-256 est stocké).
  `mdp_reinitialiser` ferme toutes les sessions du compte.
- **Ajout d'un agent** : `agent_ajouter {agent_id}` (propriétaire) ouvre l'agent dans `studio_workspace_agents`. Si un abonnement est en cours,
  il est synchronisé aussitôt (prorata). Autorisé aussi après la fin de l'essai, pour composer l'équipe avant de s'abonner. Le retrait passe par Aissociate.
- **Inscriptions** : 3 questionnaires par adresse IP et par 24 h (`studio_onboarding.ip`), en plus de la limite par e-mail. L'e-mail n'est pas vérifié par
  un lien : le mot de passe n'est envoyé qu'à cette adresse, donc seul son titulaire peut entrer.
- **Offre** : 149 € HT le premier agent, puis 131, 112, 93 et 74,50 € (`PALIERS_AGENTS`, prix Stripe `studio_agents_v2`). Aucuns frais de mise en place.
  Les mêmes montants sont dans `src/site/pages/AgentsIA.tsx`, `scripts/prerender.mjs` et `supabase/functions/studio-demo`.
- **Fin d'essai** : le menu se réduit à « Mon abonnement » et « Mon compte » ; la carte d'abonnement passe en tête, sans suspension ni recharges.
- **CRM** : la liste des espaces affiche l'essai (jours restants, terminé) et l'abonnement Stripe ; les demandes signalent les identifiants non envoyés.

## Guide de prise en main (`Tutoriel.tsx`)
- Surimpression en 10 étapes, affichée toute seule à la première connexion (après le mot de passe et les CGV), jamais après la fin de l'essai.
- Chaque étape éclaire un élément réel repéré par `data-tuto` (les liens du menu portent leur adresse, la zone de mission `mission`,
  le bouton du guide `guide`). Si l'élément n'est pas visible (menu replié sur mobile), la carte s'affiche au centre.
- « Vu » est mémorisé dans `studio_users.tutoriel_vu_le` (action `tutoriel_vu`), avec un repli dans le navigateur tant que la colonne manque.
- Le bouton « Revoir le guide », en bas de la colonne de gauche, le relance à la demande. Pour ajouter une étape : `ETAPES_TUTORIEL`.

## Contrôle quotidien du parcours client (`controle.ts`, `controle_rapport.ts`)
- pg_cron `studio-controle`, chaque jour à 02:00 UTC (06:00 à La Réunion), appelle l'action `controle_cron` (clé `studio_cron_cle`).
  Il est aussi lancé à la demande depuis CRM › Studio IA clients › Contrôle (action `admin_controle`).
- Un client fictif (`parcours-<horodatage>@controle.aissociate.re`) passe par le vrai parcours, en appelant la fonction déployée :
  - questionnaire, puis espace d'essai et e-mail d'identifiants (capturé, pas envoyé) ;
  - connexion, puis nouveau mot de passe ;
  - CGV : accès bloqué avant l'acceptation, ouvert après ;
  - essai en cours, puis refus d'un deuxième connecteur ;
  - page de paiement d'une recharge, puis blocage à la fin de l'essai ;
  - page de paiement de l'abonnement ;
  - webhook Stripe signé (abonnement, puis recharge rejouée deux fois), puis déblocage ;
  - nettoyage : espace, demande et client Stripe de test supprimés. Aucun lead n'est créé dans le CRM.
- En Stripe live (compte partagé), aucune session de paiement n'est créée. Seuls la clé, le prix, le webhook et
  les livraisons sont vérifiés.
- Autres contrôles :
  - secrets, job `studio-taches` (RPC `studio_controle_crons`), pages du site ;
  - SMTP (`verifierSmtp`, sans envoi), Stripe (webhook et événements non livrés sur 24 h), OpenRouter (crédit), Zernio ;
  - activité réelle sur 24 h : identifiants non envoyés, tâches en erreur.
- Tout échec est rejoué 20 s plus tard. S'il se reproduit, il est « confirmé » ; sinon il est « intermittent » et n'envoie pas d'e-mail.
  Un problème confirmé, ou un parcours rétabli après une panne, envoie un e-mail (constat, cause probable, solution
  préconisée) à `studio_config.controle_destinataires`. Chaque passage est consigné dans `job_runs` (`studio-controle`).

## Lecture de pages web (`web_lire_page`)
Outil disponible pour tous les agents : lit une page publique dont l'agent connaît l'adresse, et renvoie son texte
avec les liens internes du site (`liensPage`) pour naviguer. Il réutilise `lireAdresse` de `veille.ts` : pas d'IP
privée ni de localhost, redirections revérifiées, 2 Mo et 10 s au plus. Le texte est marqué comme DONNÉE.
Pas de moteur de recherche : une page affichée uniquement par JavaScript ressort sans texte.

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

## Serveurs MCP des clients (`mcp_client.ts`)
- **Plusieurs serveurs par espace** (8 au plus) : un connecteur `mcp:<nom>` chacun (`connecteur_enregistrer` avec
  `nouveau: true` le nomme d'après l'outil) ; l'ancien type `mcp` reste lu. Adresse https vers un hôte public
  seulement (pas de réseau local ni d'IP privée), jeton chiffré (`securite.ts`), facturé comme un connecteur MCP.
- **Mise en service** : le client remplit la carte « Serveurs MCP » (statut « demande ») ; dans le CRM, fiche de
  l'espace › Connecteurs › « Tester la connexion » (`admin_tester_mcp` : outils vus, lecture ou écriture), puis
  « Connecté ». Toute modification par le client repasse en « demande ».
- **Transport** : HTTP streamable (POST JSON-RPC, réponse JSON ou SSE, `Mcp-Session-Id`), `initialize` puis
  `tools/list` (cache 5 min par connecteur) et `tools/call` ; jeton en `Authorization: Bearer`.
- **Agents** (`outils.ts`) : outils `mcp_<serveur>__<outil>` (40 par serveur), consigne listant les serveurs et
  ceux injoignables. Lecture (`readOnlyHint`, ou nom get/list/search/rechercher/fiche/ask… sans annotation) :
  appelée pendant la conversation, résultat présenté comme données tierces, journalisé (`mcp_lecture`).
  Le reste devient une décision `mcp_appel` (aperçu des paramètres, sans « Modifier ») appelée au « VALIDÉ ».

## API des clients (`api_client.ts`)
- **Plusieurs API par espace** (8 au plus) : carte « API » de Connecteurs, `connecteur_enregistrer` avec
  `type: "api"` crée `api:<nom>`. Champs : adresse de base (https, hôte public), authentification
  (`bearer`, `entete` + nom, `parametre` + nom, `basic` « identifiant:mot_de_passe », `aucune`), clé chiffrée,
  description, adresse OpenAPI (JSON, facultative), mode d'emploi libre (6 000 caractères). Facturée « API ».
- **Mise en service** : CRM › espace › Connecteurs › « Tester la connexion » (`admin_tester_api` : statut de la
  racine avec la clé, nombre d'opérations OpenAPI lues), puis « Connecté ». Une racine en 404 peut être normale.
- **Agents** (`outils.ts`) : un outil `api_<nom>__requete` {methode, chemin, parametres, corps} par API ;
  la consigne donne le mode d'emploi et les opérations OpenAPI (120 max, cache 30 min). Chemin relatif
  uniquement (pas d'adresse complète, de `..`, d'espace), redirections jamais suivies, clé masquée dans les
  réponses (20 000 caractères max). GET / HEAD : appelés tout de suite, journalisés (`api_lecture`) ;
  POST, PUT, PATCH, DELETE : décision `api_appel` (aperçu de la requête, sans « Modifier ») envoyée au « VALIDÉ ».

## Traitements en lots dans « Mes ressources » (`lots.ts`, `src/studio/ressources/`)
- **Gestion groupée** : cases à cocher (et « Tout sélectionner » sur la liste affichée), barre d'actions
  `BarreSelection` → action `ressources_lot` {op: activer | desactiver | ranger | supprimer, ids (50 max)}.
  Activer des documents sensibles exige `confirmer: true`, chaque activation est journalisée comme une par une.
- **Import en masse** (`importMasse.ts`, testé) : fichiers, dossier entier (`webkitdirectory`) ou glisser-déposer
  (dossiers parcourus) ; fichiers système et formats inconnus écartés, doublons (même nom, même taille)
  ignorés, 200 fichiers par import lus deux par deux, progression puis bilan détaillé.
- **Confier à un agent** (`ConfierLot`) : `lot_lancer` {ids, agent_id, consigne, mode: chaque | synthese}.
  Le serveur enchaîne les étapes `lot_etape` (clé du déclencheur, une instance par étape, comme les
  routines) : chaque étape passe par le même chemin que le chat (`executeurMail`, quotas, garde, journal),
  document(s) joint(s) en pièces, puis la réponse est soumise en livrable (`soumis_par: "lot"`) dans
  « Aujourd'hui ». « Un résultat par document » : 25 documents max, un passage chacun, l'un après l'autre ;
  « Synthèse » : 12 documents max lus ensemble (120 000 caractères). Un document sensible désactivé n'est
  jamais lu. En cas d'échec, un livrable « Traitement en lot — n non traités » fait le bilan. Limite connue :
  une étape interrompue par l'hébergeur arrête la chaîne (rien n'est rejoué).

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
- **Livrables** : `studio_livrables` (`a_valider` → `valide` / `refuse` → `publie`). Seul le propriétaire décide.
  - Toute écriture externe d'un agent (e-mail, publication, agenda, dépôt) est soumise d'office ;
    « Soumettre à validation » sous une réponse ne sert qu'aux réponses texte.
  - La décision vit dans `livrables.ts` (testé) : seul appel d'`executerAction`, écriture conditionnée au
    statut lu (deux validations simultanées = une seule exécution), garde répétée en base
    (migration `20261122100000`).
  - Un refus exige une raison en un clic (`refus_raison`, migration `20261122110000`) ; les cinq derniers
    refus d'un agent lui sont rendus dans son contexte (`contexte.ts` › `blocRefus`).
- **Ressources sensibles** (`sensible.ts`, testé) : RIB / IBAN, pièce d'identité, bulletin de paie et numéro de
  sécurité sociale sont reconnus à l'ajout (import ou note d'agent) et rangés désactivés, dans « Confidentiel »
  si aucun dossier n'est choisi. L'activation demande une confirmation (`ressource_toggle {confirmer}`), tracée
  au journal. Colonne `studio_documents.sensible` (migration `20261122120000`) ; sans elle, la ressource est
  quand même désactivée, sans pastille.

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
