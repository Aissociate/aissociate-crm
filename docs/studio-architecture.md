# Module Studio IA : appels et dépendances

> Analyse du code au 18/11/2026 (commit `51c3167`). Complète [`src/studio/README.md`](../src/studio/README.md), qui décrit les règles métier ; ce document décrit **qui appelle quoi**.
> Les graphes sont en Mermaid : ils s'affichent dans GitHub, VS Code (extension Markdown Preview Mermaid) ou tout lecteur Markdown compatible.

## Sommaire
1. [Vue d'ensemble](#1-vue-densemble)
2. [Points d'entrée de l'Edge Function](#2-points-dentrée-de-ledge-function-studio)
3. [Catalogue des actions](#3-catalogue-des-actions)
4. [Front client : pages → actions](#4-front-client--pages--actions)
5. [Admin CRM : actions et accès directs](#5-admin-crm--actions-et-accès-directs)
6. [Dépendances entre modules serveur](#6-dépendances-entre-modules-serveur)
7. [Flux détaillés (séquences)](#7-flux-détaillés)
8. [Données : tables, vues, RPC, stockage](#8-données)
9. [Services externes et secrets](#9-services-externes-et-secrets)
10. [Points d'attention](#10-points-dattention)

---

## 1. Vue d'ensemble

Tout le Studio passe par **une seule Edge Function, `studio`** (`verify_jwt = false`), qui joue cinq rôles selon la requête reçue : API client, API admin, récepteur de webhooks (Stripe, AgentMail), cible des tâches pg_cron et page publique (questionnaire, invitations, désinscription). Une seconde fonction, **`studio-demo`**, porte l'agent commercial « Sam » du site public ; elle est indépendante.

```mermaid
flowchart LR
  subgraph Navigateurs
    C["Client entreprise<br/>/studio/* (StudioApp)"]
    A["Manager CRM<br/>/studio-admin (StudioAdmin)"]
    P["Visiteur du site<br/>/agents-ia, /studio/demarrer"]
  end

  subgraph Supabase
    F["Edge Function<br/><b>studio</b><br/>index.ts + 32 modules"]
    D["Edge Function<br/><b>studio-demo</b> (Sam)"]
    DB[("Postgres<br/>tables studio_*<br/>+ parametres, contact_requests…")]
    ST[("Storage<br/>bucket studio-medias")]
    CRON["pg_cron<br/>studio-taches (horaire)<br/>studio-controle (02:00 UTC)"]
  end

  subgraph Externes
    OR["OpenRouter<br/>LLM, vision, image, vidéo"]
    ZE["Zernio<br/>Google, Microsoft, IMAP,<br/>réseaux sociaux, applications"]
    SP["Stripe<br/>Checkout, abonnements, portail"]
    AM["AgentMail<br/>boîte de liaison par espace"]
    SM["SMTP<br/>contact@aissociate.re"]
  end

  C -- "POST {action, token}<br/>jeton Studio maison" --> F
  P -- "onboarding_soumettre,<br/>tarif_public, invitation_ouvrir" --> F
  P -- "POST {messages}" --> D
  A -- "functions.invoke<br/>JWT Supabase manager" --> F
  A -- "lecture/écriture directe<br/>(RLS managers)" --> DB
  CRON -- "net.http_post<br/>{action, cle}" --> F
  SP -- "webhook<br/>Stripe-Signature" --> F
  AM -- "webhook<br/>svix-*" --> F

  F -- "service role,<br/>filtré par workspace_id" --> DB
  F --> ST
  F --> OR & ZE & SP & AM & SM
  D --> DB
  D --> OR
```

**Trois modes d'authentification coexistent dans la même fonction :**

| Appelant | Preuve d'identité | Vérification |
|---|---|---|
| Client Studio | `token` opaque dans le corps (64 hex, 30 jours) | `chargerSession` : SHA-256 du jeton → `studio_sessions` → `studio_users` → `studio_workspaces` |
| Manager CRM | JWT Supabase dans `Authorization` | `estManager` : `auth.getUser` puis RPC `is_manager` |
| pg_cron | `cle` dans le corps | comparaison à temps constant avec `studio_cron_cle` |
| Stripe | en-tête `Stripe-Signature` | HMAC avec `STRIPE_WEBHOOK_SECRET` |
| AgentMail | en-têtes `svix-id/timestamp/signature` | HMAC Svix avec `AGENTMAIL_WEBHOOK_SECRET` (+ `_PRECEDENT`) |
| Public | aucune | limites par IP / e-mail, jetons à usage unique |

---

## 2. Points d'entrée de l'Edge Function `studio`

`Deno.serve` (`index.ts:1165`) applique les filtres **dans cet ordre** ; le premier qui correspond répond.

```mermaid
flowchart TD
  R["Requête entrante"] --> M{"Méthode ?"}
  M -- OPTIONS --> CORS["200 (CORS)"]
  M -- "autre que POST" --> E405["405"]
  M -- POST --> Q{"?desinscription=jeton"}
  Q -- oui --> DES["desinscrire()<br/>désinscription en un clic"]
  Q -- non --> S{"en-tête<br/>Stripe-Signature ?"}
  S -- oui --> STR["stripe.verifierSignature<br/>→ stripe.traiterEvenement"]
  S -- non --> X{"en-tête svix-id ?"}
  X -- oui --> LIA["verifierSvix → traiterMail<br/>(EdgeRuntime.waitUntil)"]
  X -- non --> CR{"taches_cron, tache_executer,<br/>envois_traiter, controle_cron ?"}
  CR -- oui --> CLE{"cle valide ?"} -- oui --> JOBS["tâches / mailing / contrôle<br/>(en arrière-plan)"]
  CLE -- non --> E401a["401"]
  CR -- non --> AD{"action admin_* ?"}
  AD -- oui --> MAN{"estManager ?"} -- oui --> ADMIN["admin()"]
  MAN -- non --> E403["403"]
  AD -- non --> PUB{"action publique ?<br/>tarif_public, onboarding_soumettre,<br/>desinscription, invitation_ouvrir,<br/>mdp_oublie, mdp_reinitialiser, login"}
  PUB -- oui --> PUBH["traitement sans session"]
  PUB -- non --> SES{"chargerSession(token)"}
  SES -- invalide --> E401b["401 Session expirée"]
  SES -- ok --> CGV{"CGV acceptées ?"}
  CGV -- "non (sauf me, logout,<br/>change_password, cgv*)" --> E403c["403 cgv:true"]
  CGV -- oui --> ESS{"essai terminé ?"}
  ESS -- "oui et action hors<br/>ACTIONS_APRES_ESSAI" --> E402["402 essai_termine"]
  ESS -- non --> SW["switch (action)<br/>~75 actions client"]
  SW -- "chat" --> CHAT["chat() → flux SSE"]
```

Les missions (chat, médias) passent en plus par `gouvernance.garde()` : refus si l'espace est **suspendu** ou si le **plafond IA du jour** est atteint.

---

## 3. Catalogue des actions

Toutes les actions sont des `POST` JSON `{ action, token?, ... }` sur `/functions/v1/studio`. Sauf mention, la réponse est du JSON ; `chat` renvoie un flux SSE.

### 3.1 Publiques (sans session)

| Action | Rôle | Modules appelés |
|---|---|---|
| `login` | E-mail + mot de passe → jeton + `me` ; 5 échecs / 15 min | `securite` |
| `mdp_oublie` | Lien de réinitialisation (toujours `ok`, 3 / h / compte) | `securite`, `courriel` |
| `mdp_reinitialiser` | Nouveau mot de passe, ferme toutes les sessions | `securite`, `journal` |
| `onboarding_soumettre` | Questionnaire `/studio/demarrer` → demande + lead + essai auto | `gouvernance`, `questionnaire`, `essai`, `courriel` |
| `tarif_public` | Prix des connecteurs pour `/agents-ia` | `facturation` |
| `invitation_ouvrir` | Lien « connectez votre application » → URL Zernio | `invitations`, `bureau`, `zernio` |
| `desinscription` | Désinscription d'un contact de mailing | `index` |

### 3.2 Client (session obligatoire)

| Domaine | Actions | Modules serveur |
|---|---|---|
| **Compte** | `me`, `logout`, `change_password`, `cgv`, `cgv_accepter`, `tutoriel_vu` | `securite`, `cgv` |
| **Chat** | `chat` (SSE), `chat_arreter`, `conversations`, `messages`, `conversation_delete`, `retour`, `epingler`, `creations` | `contexte`, `outils`, `equipe`, `flux`, `vision`, `medias`, `recharges`, `gouvernance` |
| **Médias** | `media_statut`, `medias` | `medias` |
| **Ressources & dossiers** | `ressources`, `ressource_get`, `ressource_add`, `ressource_toggle`, `ressource_delete`, `dossiers`, `dossier_creer`, `dossier_renommer`, `dossier_deplacer`, `dossier_supprimer`, `ranger` | `dossiers` |
| **Entreprise** | `contexte_update`, `entete`, `entete_update`, `entete_logo` | Storage `studio-medias` |
| **Messageries / agenda / fichiers** | `bureau_etat`, `bureau_connecter`, `bureau_deconnecter`, `drive_choisir`, `connexion_invitation` | `bureau`, `zernio`, `invitations` |
| **Réseaux sociaux** | `reseaux_etat`, `reseaux_connecter`, `reseaux_deconnecter` | `zernio` |
| **Applications** | `apps_etat`, `apps_connecter`, `apps_deconnecter` | `applications`, `zernio` |
| **Connecteurs manuels** | `connecteurs`, `connecteur_enregistrer`, `connecteur_supprimer` | `connecteurs`, `securite` (chiffrement) |
| **Gouvernance** | `perimetre`, `suspendre`, `journal`, `livrables`, `livrable_soumettre`, `livrable_decider`, `livrable_modifier`, `liaison` | `gouvernance`, `journal`, `outils.executerAction` |
| **Facturation** | `recharge_acheter`, `abonnement_souscrire`, `abonnement_gerer`, `abonnement_synchroniser`, `agent_ajouter` | `recharges`, `stripe`, `facturation` |
| **Tâches planifiées** | `taches`, `tache_enregistrer`, `tache_supprimer`, `tache_lancer` | `taches` |
| **Veille** | `flux`, `flux_ajouter`, `flux_basculer`, `flux_supprimer`, `flux_actualiser` | `veille` |
| **Contacts & mailing** | `contacts`, `contact_ajouter`, `contacts_importer`, `contact_supprimer`, `contact_desinscrire` | `mailing` |
| **Rapport** | `rapport` | `rapport` |

### 3.3 Admin CRM (JWT manager)

| Action | Rôle |
|---|---|
| `admin_create_user`, `admin_set_password` | Créer un accès / réinitialiser un mot de passe provisoire |
| `admin_provisionner` | Créer l'espace depuis une demande d'onboarding |
| `admin_suspendre`, `admin_journal` | Arrêt d'urgence ; journal + vérification de la chaîne SHA-256 |
| `admin_modeles` | Catalogue OpenRouter (prix, constructeurs) |
| `admin_harness_defaut` | Consigne système par défaut des agents |
| `admin_rapport` | Rapport mensuel de valeur d'un client |
| `admin_connexions`, `admin_invitation` | État Zernio d'un espace ; lien d'invitation par e-mail |
| `admin_facturation_connecteurs` | Connecteurs facturables par espace |
| `admin_liaison` | Créer / activer / couper la boîte AgentMail |
| `admin_controle` | Lancer le contrôle du parcours client à la demande |

### 3.4 Internes (pg_cron, clé `studio_cron_cle`)

| Action | Déclencheur | Effet |
|---|---|---|
| `taches_cron` | pg_cron `studio-taches`, `1 * * * *` | Repère les tâches échues → un `tache_executer` par tâche ; relance les campagnes de mailing |
| `tache_executer` | `taches_cron` (auto-appel HTTP) | Exécute une tâche comme une mission chat (session `tache`) |
| `envois_traiter` | `taches_cron` / `mailing.declencherEnvois` | Un lot de mailing (45 / h, plafond quotidien par fournisseur), se relance jusqu'à épuisement |
| `controle_cron` | pg_cron `studio-controle`, `0 2 * * *` | Parcours client fictif de bout en bout, alerte e-mail, `job_runs` |

---

## 4. Front client : pages → actions

Le front n'importe rien du CRM (`@/…`). Il passe uniquement par `src/studio/api.ts` : `appel(action, données)` pour le JSON et `discuter()` pour le flux SSE du chat. Le jeton vit dans `localStorage['studio.jeton']` ; un 401 l'efface et lève `SessionExpiree`.

```mermaid
flowchart LR
  subgraph Pages["src/studio"]
    APP["StudioApp"]
    CNX["pages/Connexion"]
    REI["pages/Reinitialiser"]
    QUE["pages/Questionnaire"]
    CGVp["pages/AccepterCgv"]
    CHATp["pages/AgentChat"]
    CREA["pages/Creations"]
    RES["pages/Ressources<br/>+ Dossiers"]
    LIV["pages/Livrables<br/>+ EditeurLivrable / EditeurDocument"]
    PER["pages/Perimetre"]
    CON["pages/Connecteurs<br/>+ Messageries, ReseauxSociaux, Applications"]
    TAC["pages/Taches, Veille, Contacts"]
    ENT["pages/Entreprise, PapierEntete"]
    AUT["pages/Journal, ParEmail, Rapport, Compte"]
    PUBp["pages/ConnecterInvitation, Desinscription"]
  end
  API["api.ts<br/>appel() / discuter()"]
  FN["Edge Function studio"]

  APP -- "me, logout, tutoriel_vu" --> API
  CNX -- "login, mdp_oublie" --> API
  REI -- "mdp_reinitialiser" --> API
  QUE -- "onboarding_soumettre" --> API
  CGVp -- "cgv, cgv_accepter" --> API
  CHATp -- "chat (SSE), chat_arreter, conversations,<br/>messages, retour, livrable_soumettre" --> API
  CREA -- "creations, medias, epingler" --> API
  RES -- "ressource_*, dossier_*, ranger" --> API
  LIV -- "livrables, livrable_decider,<br/>livrable_modifier" --> API
  PER -- "perimetre, suspendre, recharge_acheter,<br/>agent_ajouter, abonnement_*" --> API
  CON -- "connecteur*, bureau_*, reseaux_*,<br/>apps_*, connexion_invitation" --> API
  TAC -- "taches, tache_*, flux*, contact*" --> API
  ENT -- "contexte_update, entete*" --> API
  AUT -- "journal, liaison, rapport,<br/>change_password" --> API
  PUBp -- "invitation_ouvrir, desinscription" --> API
  API -- "POST /functions/v1/studio" --> FN
```

**Modules purs côté navigateur** (aucun appel réseau, sauf chargement de bibliothèques depuis esm.sh) :

| Fichier | Rôle |
|---|---|
| `extraction.ts` | Texte des pièces jointes (PDF, Word, Excel, PowerPoint, ODF, CSV) |
| `exportDoc.ts` / `exports.ts` | Markdown → `.docx` (docx@9.5.1 via esm.sh) et PDF (impression d'un cadre caché) ; `exports.ts` appelle `entete` |
| `htmlSur.ts` | Nettoyage HTML avant affichage, impression, export |
| `blocs.ts`, `rapport.ts`, `journal.ts`, `csvContacts.ts` | Mise en forme et analyse pures, testées |

---

## 5. Admin CRM : actions et accès directs

L'admin (`src/studio/admin/`) est la seule partie qui importe le CRM (`@/lib/supabase`, `@/components/ui`). Il mélange deux voies : **les actions sensibles passent par la fonction** (mots de passe, Zernio, Stripe, AgentMail, OpenRouter), **le reste lit et écrit directement les tables** sous la RLS managers.

```mermaid
flowchart LR
  subgraph Admin["src/studio/admin"]
    SA["StudioAdmin"]
    OB["OnboardingPanel"]
    GO["GouvernanceEspace"]
    LI["LiaisonEspace"]
    CX["ConnexionsEspace"]
    RE["RentabilitePanel"]
    HA["HarnessPanel"]
    CT["ControlePanel"]
    PA["ParametresPanel"]
    RC["RechargesEspace"]
    SV["SavoirsAgent"]
    CE["ConnecteursEspace"]
  end
  FN["Edge Function studio"]
  DB[("Postgres (RLS managers)")]

  SA -- "admin_create_user, admin_set_password,<br/>admin_modeles" --> FN
  OB -- "admin_provisionner" --> FN
  GO -- "admin_suspendre, admin_journal" --> FN
  LI -- "admin_liaison" --> FN
  CX -- "admin_connexions, admin_invitation" --> FN
  RE -- "admin_rapport,<br/>admin_facturation_connecteurs" --> FN
  HA -- "admin_harness_defaut" --> FN
  CT -- "admin_controle" --> FN

  SA -. "studio_workspaces, studio_users,<br/>studio_agents, studio_workspace_agents,<br/>studio_usage_mois, studio_recharges_solde, entreprises" .-> DB
  OB -. "studio_onboarding, studio_config" .-> DB
  RE -. "studio_rentabilite_mois, studio_demo_appels,<br/>studio_recharges, studio_config" .-> DB
  HA & PA -. "studio_config" .-> DB
  RC -. "studio_recharges, studio_workspaces" .-> DB
  SV -. "studio_agent_savoirs" .-> DB
  CE -. "studio_connecteurs" .-> DB
  CT -. "job_runs" .-> DB
```

---

## 6. Dépendances entre modules serveur

`supabase/functions/studio/` : 33 fichiers hors tests. `index.ts` (≈ 2 000 lignes) importe 27 des 32 autres modules. Le graphe ci-dessous omet les arêtes `index.ts → *` pour rester lisible et montre les dépendances **entre** modules.

```mermaid
flowchart TB
  IDX["index.ts<br/>(routeur, chat, sessions, tâches)"]

  subgraph IA["IA et agents"]
    contexte; outils; equipe; flux; vision; medias; html
  end
  subgraph Conn["Connexions (Zernio)"]
    zernio; bureau; agenda; applications; applications_outils; connecteurs; invitations
  end
  subgraph Gouv["Gouvernance"]
    gouvernance; journal; securite; questionnaire; cgv; essai
  end
  subgraph Fact["Facturation"]
    stripe; recharges; facturation
  end
  subgraph Canal["Canaux"]
    liaison; liaison_traitement; agentmail; mailing; veille; courriel; taches
  end
  subgraph Ctrl["Contrôle"]
    controle; controle_rapport
  end
  subgraph Divers
    dossiers; rapport
  end

  IDX -.->|importe 27 modules| IA

  outils --> agenda & applications & applications_outils & bureau & dossiers & html & journal & liaison & mailing & veille & zernio
  equipe --> outils
  vision --> flux
  medias --> recharges
  connecteurs --> applications & applications_outils & bureau & contexte & securite & zernio
  applications --> zernio
  applications_outils --> applications & zernio
  bureau --> agenda & zernio
  invitations --> bureau & securite & zernio
  facturation --> applications & bureau & zernio
  mailing --> bureau
  gouvernance --> courriel & html & journal & outils & questionnaire & securite
  liaison_traitement --> agentmail & gouvernance & liaison
  stripe --> journal
  controle --> cgv & controle_rapport & courriel & gouvernance & questionnaire & recharges & securite & stripe & zernio
  controle_rapport --> questionnaire
```

**Lecture du graphe :**
- **`zernio.ts`** est la brique la plus partagée (7 modules en dépendent) : tout ce qui touche un compte tiers du client passe par lui.
- **`outils.ts`** (≈ 1 070 lignes) est le second pivot : il assemble les 31 outils proposés au modèle et `executerAction`, qui exécute un livrable validé.
- **`gouvernance.ts` → `outils.ts`** : la décision sur un livrable (`VALIDÉ`) exécute l'action portée par ce livrable.
- **Modules feuilles** (aucune dépendance interne) : `agenda`, `agentmail`, `cgv`, `contexte`, `courriel`, `dossiers`, `essai`, `flux`, `html`, `journal`, `liaison`, `questionnaire`, `rapport`, `recharges`, `securite`, `taches`, `veille`, `zernio`. La plupart sont purs et testés (`*.test.ts`).
- **`controle.ts`** dépend de presque tout le parcours : il rejoue le vrai chemin client.

### Outils exposés aux agents (`outils.ts`, `applications_outils.ts`, `equipe.ts`)

| Famille | Outils | Condition |
|---|---|---|
| Toujours | `ressource_lire`, `competence_enregistrer`, `note_enregistrer`, `dossiers_lister`, `ranger`, `document_rediger`, `document_lire`, `document_modifier`, `web_lire_page` | — |
| Messagerie | `mail_rechercher`, `mail_lire`, `mail_proposer_envoi` | boîte Zernio zone `email` |
| Agenda | `agenda_lister`, `agenda_proposer_rdv` | zone `calendar` |
| Fichiers | `fichiers_rechercher`, `fichiers_lister`, `fichiers_lire`, `fichiers_creer_document` | zone `files` (Drive / OneDrive) |
| Réseaux | `reseaux_publications`, `reseaux_commentaires`, `reseaux_messages`, `reseaux_statistiques`, `reseaux_proposer_publication`, `reseaux_proposer_reponse_commentaire`, `reseaux_proposer_message` | compte réseau connecté |
| Veille & mailing | `veille_actualites`, `veille_lire_article`, `veille_ajouter_flux`, `blog_proposer_article`, `contacts_listes`, `mailing_proposer` | — |
| Applications | outils `app_*` générés (blog Shopify/WordPress/Wix/Webflow, CRM HubSpot/Salesforce, YouTube, WhatsApp, Google Analytics, régies publicitaires) | application reliée |
| Équipe | `consulter_collegue` (3 par demande au plus) | au moins un autre agent ouvert |

Règle commune : **lecture = exécutée tout de suite et tracée ; écriture = `*_proposer_*` → livrable « à valider »**, exécuté par `outils.executerAction` au « VALIDÉ » du propriétaire.

---

## 7. Flux détaillés

### 7.1 Connexion et session

```mermaid
sequenceDiagram
  autonumber
  participant N as Navigateur (Connexion.tsx)
  participant F as studio (index.ts)
  participant DB as Postgres

  N->>F: login {email, password}
  F->>DB: count studio_login_echecs (15 min)
  alt 5 échecs ou plus
    F-->>N: 429 Trop de tentatives
  end
  F->>DB: studio_users + studio_credentials
  F->>F: verifierMotDePasse (PBKDF2-SHA256)<br/>calcul factice si compte inconnu
  alt échec
    F->>DB: insert studio_login_echecs
    F-->>N: 401
  else succès
    F->>DB: insert studio_sessions {sha256(jeton), +30 j}
    F->>DB: delete studio_login_echecs
    F->>F: chargerSession + construireMe
    F-->>N: {token, user, workspace, agents, stats, conversations}
    N->>N: localStorage studio.jeton
  end
  Note over N,F: Requêtes suivantes : {action, token}<br/>CGV puis fin d'essai vérifiées avant le switch
```

### 7.2 Mission dans le chat (`chat`, flux SSE)

C'est le flux le plus riche : il mobilise quotas, gouvernance, contexte, outils, collègues et comptabilité.

```mermaid
sequenceDiagram
  autonumber
  participant N as AgentChat.tsx (discuter)
  participant F as studio · chat()
  participant DB as Postgres
  participant OR as OpenRouter
  participant T as outils / Zernio

  N->>F: chat {agent_id, message | pouvoir, conversation_id?, pieces?}
  F->>DB: agents de l'espace (agent ouvert ?)
  F->>DB: compterDemandesMois
  opt quota du mois atteint
    F->>DB: recharges.couvrable (sinon 429 recharge:true)
  end
  F->>DB: gouvernance.garde (suspendu ? plafond IA du jour ?)
  F->>DB: parametres.ai (clé, modèles)
  opt images jointes
    F->>OR: vision.decrireImage (model_vision)
  end
  F->>DB: reprise ou création studio_conversations
  alt super-pouvoir média (image / vidéo)
    F->>OR: medias.lancerMedia
    F->>DB: studio_medias, studio_messages, journal
    F-->>N: JSON {media:{id, statut:en_cours}}
    N->>F: media_statut {id} (sondage)
  else mission texte
    par contexte
      F->>DB: 12 derniers messages
      F->>DB: rpc studio_recherche_docs (4) + 8 docs récents
      F->>DB: contenus épinglés (6), connecteurs, harness, en-tête
      F->>DB: rpc studio_recherche_savoirs (8 000 car.)
    end
    F->>DB: insert message client
    F->>T: outilsEspace (définitions selon connexions)
    F-->>N: event meta {conversation_id, ressources, savoirs}
    loop jusqu'à 7 tours
      F->>OR: chat/completions stream:true (+ tools)
      OR-->>F: fragments delta / tool_calls / usage
      F-->>N: event delta {text}
      opt appels d'outils (5 par tour au plus)
        alt consulter_collegue
          F->>OR: collègue, sans outils, sans flux
        else autre outil
          F->>T: outils.executer (lecture) ou livrable à valider (écriture)
        end
        F-->>N: event outil {libelle} / document {id, titre}
      end
    end
    F->>DB: insererReponse (coût USD, tokens, modèle)
    F-->>N: event done {message_id}
    F->>DB: journaliser mission ; hors_quota si [[RELAIS:…]]
  end
  Note over F: EdgeRuntime.waitUntil : la génération continue si l'onglet se ferme.<br/>chat_arreter pose arret_demande, relu toutes les 2 s.
```

### 7.3 Onboarding et essai gratuit

```mermaid
sequenceDiagram
  autonumber
  participant V as Visiteur (Questionnaire.tsx)
  participant F as studio
  participant DB as Postgres
  participant SM as SMTP

  V->>F: onboarding_soumettre {contact, reponses, accord}
  F->>DB: limite 3 demandes / IP / 24 h + limite e-mail
  F->>F: questionnaire : score /100, points RGPD
  F->>DB: insert studio_onboarding + contact_requests (lead CRM)
  alt essai_auto
    F->>DB: provisionner : studio_workspaces (offre essai, +7 j),<br/>studio_workspace_agents, studio_users, studio_credentials
    F->>SM: courriel : identifiants provisoires
    F->>DB: identifiants_envoyes_le
  end
  F-->>V: {ok, essai, identifiants_envoyes}
  Note over V,F: Sinon : CRM › Demandes › admin_provisionner
```

### 7.4 Paiement Stripe (recharge et abonnement)

```mermaid
sequenceDiagram
  autonumber
  participant N as Perimetre.tsx
  participant F as studio
  participant S as Stripe
  participant DB as Postgres

  N->>F: recharge_acheter {index} | abonnement_souscrire
  F->>S: client + produit/prix (créés au besoin, metadata.app=studio)
  F->>S: checkout/sessions
  F-->>N: {url}
  N->>S: paiement (page Stripe)
  S->>F: webhook checkout.session.completed / customer.subscription.*
  F->>F: verifierSignature (STRIPE_WEBHOOK_SECRET)
  F->>DB: studio_recharges (stripe_ref unique : une seule fois)<br/>ou studio_workspaces.abonnement_statut / offre
  F->>DB: journal
  Note over N,F: abonnement_gerer → portail Stripe<br/>abonnement_synchroniser / agent_ajouter → quantités au prorata
```

### 7.5 Canal e-mail de liaison (AgentMail)

```mermaid
sequenceDiagram
  autonumber
  participant U as Utilisateur (e-mail)
  participant AM as AgentMail
  participant F as studio
  participant L as liaison_traitement
  participant DB as Postgres

  U->>AM: « [Hugo] objet » vers la boîte de l'espace
  AM->>F: webhook message.received (svix-*)
  F->>F: verifierSvix
  F-->>AM: 200 immédiat
  F->>L: traiterMail (waitUntil)
  L->>DB: dédoublonnage event_id, 30 messages / h / espace
  L->>L: expéditeur autorisé + SPF/DKIM/DMARC ; détection fraude au président
  alt commande du propriétaire
    L->>DB: VALIDÉ / REFUSÉ L-…, SUSPENDRE, REPRENDRE
  else mission
    L->>F: executeurMail → même chemin que chat()
    L->>DB: studio_instructions INSTR-AAAA-NNNN, livrable « à valider »
    L->>AM: réponse dans le fil (Auto-Submitted)
  end
```

### 7.6 Tâches planifiées et mailing

```mermaid
flowchart LR
  CRON["pg_cron studio-taches<br/>1 * * * *"] -->|"taches_cron {cle}"| F1["tachesEchues()"]
  F1 -->|"pour chaque tâche échue :<br/>POST tache_executer {cle, id}"| F2["executerTache()<br/>session 'tache' → chat()"]
  F2 --> DB[("studio_taches<br/>compte rendu, statut")]
  F1 -->|relancerEnvois| F3["envois_traiter {cle, id}"]
  F3 -->|"mailing.traiterLot<br/>45 / h, plafond/jour"| Z["bureau.envoyerMessageMailing<br/>(Zernio)"]
  F3 -->|"reste à envoyer"| F3
  CRON2["pg_cron studio-controle<br/>0 2 * * *"] -->|"controle_cron {cle}"| C["controle.executer()<br/>client fictif de bout en bout"]
  C --> JR[("job_runs")]
  C -->|"problème confirmé"| MAIL["e-mail d'alerte"]
```

Chaque tâche tourne **dans sa propre instance** (appel HTTP à soi-même) pour ne pas buter sur la limite de 150 s des Edge Functions.

---

## 8. Données

### 8.1 Modèle simplifié

```mermaid
erDiagram
  entreprises ||--o{ studio_workspaces : "entreprise_id (seule FK vers le CRM)"
  studio_workspaces ||--o{ studio_users : ""
  studio_users ||--|| studio_credentials : "PBKDF2"
  studio_users ||--o{ studio_sessions : "sha256 jeton"
  studio_users ||--o{ studio_reinitialisations : ""
  studio_agents ||--o{ studio_workspace_agents : ""
  studio_workspaces ||--o{ studio_workspace_agents : "agents ouverts"
  studio_agents ||--o{ studio_agent_savoirs : "base commune"
  studio_workspaces ||--o{ studio_conversations : ""
  studio_conversations ||--o{ studio_messages : ""
  studio_messages }o--o| studio_medias : "media_id"
  studio_workspaces ||--o{ studio_documents : "ressources"
  studio_workspaces ||--o{ studio_dossiers : "5 niveaux"
  studio_workspaces ||--o{ studio_livrables : "a_valider → publie"
  studio_workspaces ||--o{ studio_journal : "chaîne SHA-256"
  studio_workspaces ||--o{ studio_recharges : "registre crédits"
  studio_workspaces ||--o{ studio_taches : ""
  studio_workspaces ||--o{ studio_flux : ""
  studio_flux ||--o{ studio_veille : ""
  studio_workspaces ||--o{ studio_contacts : ""
  studio_workspaces ||--o{ studio_envois : "campagnes"
  studio_workspaces ||--o{ studio_connecteurs : "manuels"
  studio_workspaces ||--o{ studio_instructions : "e-mails reçus"
  studio_workspaces ||--o{ studio_connexion_invitations : ""
  studio_onboarding }o--o| studio_workspaces : "provisionné"
```

### 8.2 Inventaire

| Catégorie | Objets |
|---|---|
| **Identité** | `studio_workspaces`, `studio_users`, `studio_credentials` (aucune politique RLS), `studio_sessions`, `studio_login_echecs`, `studio_reinitialisations` |
| **Agents** | `studio_agents`, `studio_workspace_agents`, `studio_agent_savoirs`, `studio_config` (harness, CGV, quotas par défaut, destinataires du contrôle) |
| **Conversations** | `studio_conversations`, `studio_messages`, `studio_medias` |
| **Contenus** | `studio_documents`, `studio_dossiers`, `studio_livrables` |
| **Gouvernance** | `studio_onboarding`, `studio_journal`, `studio_instructions` |
| **Connexions** | `studio_connecteurs`, `studio_connexion_invitations`, `studio_nango_connexions` *(abandonnée)* |
| **Automatisation** | `studio_taches`, `studio_cron_cle`, `studio_flux`, `studio_veille`, `studio_contacts`, `studio_envois` |
| **Facturation** | `studio_recharges` |
| **Démo** | `studio_demo_appels` |
| **Vues** | `studio_usage_mois`, `studio_rentabilite_mois`, `studio_recharges_solde` |
| **RPC** | `studio_recherche_docs`, `studio_recherche_savoirs` (service role), `studio_controle_crons`, `is_manager` |
| **Tables CRM touchées** | `parametres` (clé `ai`, SMTP), `contact_requests` (leads), `job_runs` ; `studio-demo` écrit aussi `contacts`, `opportunites` |
| **Storage** | bucket privé `studio-medias` (logos, images, vidéos ; URL signées 1 h) |

Tables les plus sollicitées par le code serveur : `studio_workspaces` (39 requêtes), `studio_livrables` (22), `studio_documents` (17), `studio_messages` (16), `studio_users` (15).

---

## 9. Services externes et secrets

| Service | Usage | Modules | Secrets |
|---|---|---|---|
| **OpenRouter** | Chat en flux, consultation de collègue, vision, images (`meta/muse-image`), vidéos (`minimax/hailuo-3-max`), catalogue de modèles | `index`, `vision`, `medias`, `studio-demo` | `OPENROUTER_API_KEY` (sinon `parametres.ai.openrouter_key`) |
| **Zernio** | Profils par espace ; Gmail/Outlook/IMAP, agendas, Drive/OneDrive ; réseaux sociaux ; applications | `zernio`, `bureau`, `applications*`, `invitations`, `facturation` | `ZERNIO_API_KEY` |
| **Stripe** | Checkout (recharges), abonnements, portail, webhook | `stripe` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **AgentMail** | Boîte de liaison par espace, webhook Svix, réponses | `agentmail`, `liaison*` | `AGENTMAIL_API_KEY`, `AGENTMAIL_WEBHOOK_SECRET`, `AGENTMAIL_WEBHOOK_SECRET_PRECEDENT` |
| **SMTP** | Identifiants, réinitialisation, alertes du contrôle | `courriel` | `SMTP_HOST/PORT/USERNAME/PASSWORD/FROM`, `STUDIO_SMTP_FROM/USERNAME/PASSWORD` |
| **Web public** | `web_lire_page`, flux RSS de veille (anti-SSRF, 2 Mo, 10 s) | `veille` | — |
| **esm.sh** (navigateur) | `docx`, extracteurs PDF/Office chargés à la demande | `exports.ts`, `extraction.ts` | — |
| **Supabase** | Base, stockage, auth des managers | tous | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` |
| **Chiffrement local** | Secrets des connecteurs manuels | `securite` | `STUDIO_CLE_CHIFFREMENT` |

---

## 10. Points d'attention

Constats issus de la lecture du code (aucun n'a été corrigé ici) :

1. **`index.ts` concentre tout** : ≈ 2 000 lignes, routeur, sessions, `chat()` (≈ 375 lignes), tâches, admin. Toute évolution du chat ou d'une action client touche ce fichier. Extraire `chat()` et `admin()` dans leurs modules réduirait le risque de conflit (cf. commits Bolt qui écrasent `main`).
2. **Ordre des filtres signifiant** : la désinscription (`?desinscription=`) passe avant toute vérification ; les webhooks sont reconnus **à la présence d'un en-tête**. C'est voulu, mais une nouvelle route publique doit être insérée avant `chargerSession`, et une nouvelle action « après essai » ajoutée à `ACTIONS_APRES_ESSAI` (`essai.ts`), sinon elle répondra 402.
3. **Webhook AgentMail** : `verifierSvix` est appelé avant le test « secrets absents » ; sans secret, la réponse reste un 503 correct, mais l'ordre peut surprendre à la relecture.
4. **Commentaire d'en-tête incomplet** (`index.ts:10-55`) : il ne liste ni les actions Zernio réseaux/applications, ni Stripe, ni dossiers, ni `mdp_*`, `cgv`, `tutoriel_vu`. Le [catalogue §3](#3-catalogue-des-actions) est à jour.
5. **Reliquats Nango** : la table `studio_nango_connexions` et la migration `20261116100000_studio_nango.sql` ne servent plus (README).
6. **Admin en double voie** : certaines écritures admin (quotas, recharges, savoirs, paramètres) passent directement par les tables sous RLS managers, donc hors de `journaliser()` : elles n'apparaissent dans `studio_journal` que si un déclencheur SQL le fait (non vérifié ici). Les actions passant par la fonction, elles, sont journalisées.
7. **Prix dupliqués** : paliers 149 → 74,50 € présents dans `stripe.ts`, `studio-demo/index.ts`, `src/site/pages/AgentsIA.tsx` et `scripts/prerender.mjs`, à garder alignés à la main.
8. **Deux fonctions déployées séparément** : `studio` et `studio-demo` ne se déploient pas par un push (redéploiement via le MCP Supabase).
