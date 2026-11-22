# Studio IA : packs métier (un harnais par secteur, adapté à chaque client)

Cahier des charges fonctionnel — proposition du 23/11/2026, à valider avant tout développement.
Périmètre : le Studio client (`/studio`), son serveur (`supabase/functions/studio/`) et ses réglages côté CRM.

> **Décision du 23/11/2026 (remplace les sections 3.2, 5 et 6.1) :** le harnais n'est pas choisi dans un catalogue
> validé à la main. Il est **généré automatiquement par l'IA pour chaque client** dès que le secteur d'activité est
> renseigné au questionnaire, avec un **cadre d'exercice propre à chacun de ses agents**, puis branché aussitôt. La
> relecture humaine devient facultative (aperçu et « Régénérer » dans le CRM) ; une seconde passe IA relit et corrige
> avant enregistrement. Les packs écrits à la main restent possibles (catalogue). Mise en œuvre : voir
> `src/studio/README.md`, section « Harnais métier généré par l'IA ».

## 1. Ce qu'on veut obtenir

Aujourd'hui, un agent du Studio répond de la même façon à un boulanger et à un courtier en assurance : seule la
fiche entreprise, rédigée par le client, les distingue. C'est le reproche n° 1 fait aux concurrents (« des
réponses très standards », « un ChatGPT mal configuré ») et la raison d'un paramétrage long.

Un **pack métier** est le savoir d'un secteur, préparé une fois par Aissociate et attaché à chaque client de ce
secteur :

- l'agent connaît le vocabulaire, les questions habituelles des clients, les règles et les interdits du métier ;
- le client n'a presque rien à paramétrer : on lui pose seulement les questions que son site et ses outils n'ont
  pas permis de remplir, en langage courant ;
- on mesure la qualité métier par métier, chaque jour, avec un jeu de questions dont on connaît la bonne réponse.

Le client ne voit jamais de nœuds ni de prompt. Les nœuds et les générateurs restent l'atelier d'Aissociate.

## 2. Ce qui existe déjà (et qu'on réutilise)

| Brique | Où | Rôle aujourd'hui |
|---|---|---|
| Prompt en 8 couches | `contexte.ts` (`construirePrompt`) | identité, périmètre, règles communes, savoirs de l'agent, fiche entreprise, outils, ressources, contenus validés |
| Savoirs par agent | table `studio_agent_savoirs`, RPC `studio_recherche_savoirs`, `chargerSavoirs` (`index.ts`) | référence Aissociate **par fonction** (Nora, Maël, Inès…), commune à tous les clients, citée en « Sources : » |
| Questionnaire d'onboarding | `questionnaire.ts`, question A2 « Secteur d'activité (et code NAF si connu) » | texte libre, non exploité ensuite |
| Lecture d'un site | `veille.ts` (`lireAdresse`) | lecture d'une page publique |
| Contrôle quotidien | `controle.ts` (client fictif, `job_runs` studio-controle, alerte e-mail) | vérifie le parcours, pas la justesse des réponses |
| Améliorations quotidiennes | `ameliorations.ts` | propositions issues des conversations → tickets « Développement » |
| Propositions validées | gouvernance, `ai_actions` | rien n'est appliqué sans validation humaine |

**Ce qui manque :** une couche « secteur du client ». Dans le code, `metier` désigne la fonction de l'agent
(« chargée de communication »), pas l'activité du client.

## 3. Principes

1. **Pas d'entraînement de modèle.** Un pack = des règles + des savoirs sourcés + une fiche type + un jeu
   d'évaluation. Tout passe par le prompt et la recherche, comme les savoirs actuels.
2. **Rien de généré n'est publié sans relecture humaine.** L'IA rédige, un second modèle critique, Aissociate valide.
3. **Toujours sourcé.** Une règle métier sans source n'entre pas dans le pack. L'agent cite le pack comme il cite
   déjà les savoirs.
4. **Le client prime sur le pack** pour ses propres faits (prix, horaires, produits). Le pack prime pour les règles
   et les interdits.
5. **Aucune donnée d'un client ne passe dans un pack.** Seules des leçons générales, reformulées et validées,
   peuvent l'enrichir.
6. **Versionné.** Un client reste sur sa version tant qu'il n'a pas accepté la mise à jour.

## 4. Contenu d'un pack

| Élément | Contenu | Exemple boulangerie | Exemple courtage en assurance |
|---|---|---|---|
| Identification | nom, codes NAF couverts, mots-clés de reconnaissance | 10.71C, 47.24Z | 66.22Z |
| Fiche type | champs à connaître sur l'entreprise (nom, libellé, type, requis, d'où on peut le déduire) | horaires, jours de fermeture, gamme, allergènes, commandes spéciales, délai | n° ORIAS, compagnies partenaires, produits distribués, procédure sinistre, médiateur |
| Règles et interdits | phrases courtes, chacune sourcée | toujours signaler les allergènes (règlement INCO) | jamais de tarif ni de garantie engageante ; devoir de conseil (DDA) ; réclamation → procédure écrite |
| Cas de relais à un humain | situations où l'agent s'arrête et transmet | allergie grave, commande > N € | sinistre, résiliation, litige |
| Savoirs | fiches sourcées (FAQ clients, saisonnalité, réglementation) | calendrier des fêtes, conservation | mentions obligatoires, délais de rétractation |
| Vocabulaire et ton | termes du métier, formules à éviter | « viennoiserie », « pièce montée » | « souscripteur », « franchise » |
| Préréglages | agents conseillés, super-pouvoirs, routines, connecteurs | message des horaires de fêtes | relance d'échéances |
| Jeu d'évaluation | 30 à 50 questions : réponse attendue, éléments obligatoires, pièges interdits | « Vos croissants contiennent-ils des fruits à coque ? » → renvoi à la liste des allergènes, pas d'invention | « Combien coûte une assurance habitation ? » → pas de chiffre, proposition de devis |

## 5. Fabriquer un pack (atelier Aissociate, dans le CRM)

Écran CRM › Studio IA clients › **Packs métier**.

1. **Entrée** : nom du secteur, codes NAF, convention collective si utile, consignes de l'équipe.
2. **Recherche sourcée** : l'IA rassemble les textes publics utiles (Légifrance, ACPR, DGCCRF, fédérations
   professionnelles, sites de référence). Chaque extrait garde son URL.
3. **Génération** : l'IA produit le pack au format JSON imposé (section 4), en ne s'appuyant que sur les extraits
   rassemblés.
4. **Relecture critique** par un second modèle : contradictions, règles sans source, sources inventées, conseils
   dangereux. Chaque remarque est rattachée à un élément du pack.
5. **Validation humaine** élément par élément : accepter, corriger, supprimer. Pour les secteurs réglementés
   (assurance, santé, immobilier), la validation par un professionnel du secteur est recommandée (point 13).
6. **Essai** : le jeu d'évaluation tourne contre un espace fictif du secteur ; le score s'affiche avant publication.
7. **Publication** d'une version (1, 2, 3…). Une version publiée n'est plus modifiable ; on en crée une nouvelle.

Le générateur tourne en tâche de fond (`job_runs`) : la limite des 150 s ne doit pas couper une génération.

## 6. Attacher un pack à un client

### 6.1 Choix du pack
- À la fin du questionnaire, la réponse A2 (et le code NAF s'il est donné) propose un pack. L'équipe peut le
  changer dans la fiche de l'espace (CRM).
- Pas de pack correspondant : l'espace fonctionne comme aujourd'hui.

### 6.2 Pré-remplissage de la fiche
- L'IA remplit la fiche type à partir : du site du client (`lireAdresse`), des réponses au questionnaire, des
  outils connectés quand il y en a (fiche Google, boutique…).
- Chaque valeur garde son origine (« lu sur votre site », « d'après le questionnaire »).

### 6.3 Questions au client
- Les champs requis encore vides deviennent des questions simples dans « Mon entreprise » et sur l'écran
  « Aujourd'hui » (« Faites-vous des pièces montées sur commande ? Avec quel délai ? »).
- Le client valide ou corrige les valeurs pré-remplies. Rien n'est affiché comme un formulaire technique.

### 6.4 Ce qui change dans le prompt
Nouvelle couche entre la couche 4 (savoirs de l'agent) et la couche 5 (fiche entreprise), dans `contexte.ts` :

```
## Ton contexte métier : boulangerie-pâtisserie
Règles à respecter (toujours) : …
Situations où tu passes la main à un humain : …
Vocabulaire : …
## Fiche métier de l'entreprise
Horaires : … (validé par le client)
Allergènes : … (lu sur le site, à confirmer)
```

Les savoirs du pack sont cherchés comme les savoirs actuels (même budget, même citation « Sources : »). Les règles
et les cas de relais sont toujours inclus, sans recherche.

## 7. Mesurer la qualité

- **Contrôle quotidien par secteur** : `controle.ts` ajoute un espace fictif par pack publié et lui pose un
  échantillon du jeu d'évaluation (10 questions tirées au hasard par jour, pour maîtriser le coût).
- **Notation** par un modèle juge : éléments obligatoires présents, pièges évités, source citée. Score sur 100.
- **Alerte** si le score d'un secteur baisse de plus de 10 points ou passe sous un seuil (`job_runs`, e-mail).
- **Suivi** dans le CRM : score par pack et par version, questions qui échouent le plus souvent.

## 8. Faire évoluer les packs

- `ameliorations.ts` propose des modifications de pack à partir des conversations réelles, sous forme de
  **leçons générales** (« les clients demandent souvent si le pain est bio »), jamais de données d'un client.
- Chaque proposition est un ticket ; une fois acceptée, elle entre dans la version suivante.
- Les clients sont prévenus d'une nouvelle version (« Votre équipe connaît désormais … ») et peuvent l'accepter.
  Par défaut, une correction de règle (ex. réglementation modifiée) est appliquée d'office, avec un message.

## 9. Données (esquisse)

```sql
create table public.studio_packs_metier (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,              -- 'boulangerie', 'courtage-assurance'
  nom          text not null,
  codes_naf    text[] not null default '{}',
  version      int  not null,
  statut       text not null default 'brouillon', -- brouillon | publie | archive
  fiche_type   jsonb not null default '[]',  -- [{nom, libelle, type, requis, aide, deduction}]
  regles       jsonb not null default '[]',  -- [{texte, source}]
  relais       jsonb not null default '[]',  -- [{situation, consigne}]
  vocabulaire  jsonb not null default '[]',
  prereglages  jsonb not null default '{}',  -- agents, super-pouvoirs, routines, connecteurs
  evaluation   jsonb not null default '[]',  -- [{question, attendus[], interdits[]}]
  score        numeric,                      -- dernier score d'essai
  publie_le    timestamptz,
  unique (code, version)
);

create table public.studio_pack_savoirs (    -- même forme que studio_agent_savoirs
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.studio_packs_metier(id) on delete cascade,
  titre text not null, source text not null, contenu text not null, actif boolean not null default true
);

alter table public.studio_workspaces
  add column pack_code text,
  add column pack_version int,
  add column fiche_metier jsonb not null default '{}'; -- {champ: {valeur, origine, valide}}
```

Plus une RPC `studio_recherche_pack_savoirs`, calquée sur `studio_recherche_savoirs`. Migrations à appliquer sur la
base de production par SSH (`docker exec … psql`).

## 10. Confidentialité

- Les packs ne contiennent que des sources publiques et le savoir-faire d'Aissociate.
- Les leçons tirées des conversations sont reformulées et validées avant d'entrer dans un pack ; aucun nom, chiffre
  ou document d'un client n'en fait partie.
- La génération et l'évaluation passent par les mêmes fournisseurs d'IA que le Studio : la question du transfert
  hors UE (OpenRouter) s'applique aussi ici.

## 11. Coûts

- Fabrication d'un pack : quelques euros d'IA (recherche + génération + critique), surtout du temps de relecture.
- Évaluation : 10 questions par secteur et par jour, avec un modèle juge économique.
- Prompt : la couche métier ajoute environ 1 000 à 2 000 tokens par demande ; budget à fixer comme `BUDGET_SAVOIRS`.

## 12. Découpage proposé

| Lot | Contenu | Résultat vérifiable |
|---|---|---|
| 1 | Tables, couche de prompt, choix du pack dans le CRM, **un pack écrit à la main** (boulangerie) | un espace boulangerie répond mieux qu'un espace sans pack sur 20 questions types |
| 2 | Fiche type, pré-remplissage (site + questionnaire), questions au client | un nouvel espace a sa fiche remplie à plus de 70 % sans saisie |
| 3 | Jeu d'évaluation, espace fictif par secteur dans le contrôle quotidien, score dans le CRM | score quotidien par pack, alerte en cas de baisse |
| 4 | Générateur IA (recherche, génération, critique) et écran de validation | un deuxième pack (courtage en assurance) produit en moins d'une journée de relecture |
| 5 | Versions, mises à jour proposées au client, leçons issues des conversations | une correction de règle atteint tous les clients du secteur |

Le lot 1 sert de test : s'il n'améliore pas nettement les réponses, on s'arrête là.

## 13. Points à trancher

1. **Premiers secteurs** : lesquels lancer (boulangerie, courtage en assurance, artisans du bâtiment, agences
   immobilières…) ?
2. **Granularité** : un pack par code NAF, ou des secteurs maison regroupant plusieurs codes ?
3. **Client à plusieurs activités** (boulangerie + traiteur) : un pack principal seul, ou plusieurs ?
4. **Validation des secteurs réglementés** : relecture par un professionnel extérieur (rémunéré) ou par l'équipe ?
5. **Mises à jour** : quelles modifications s'appliquent d'office, lesquelles attendent l'accord du client ?
6. **Prix** : le pack est-il inclus dans l'abonnement ou vendu en option ?
7. **Lien avec l'accompagnement financé** : la prise en main du pack peut-elle devenir le contenu d'une formation
   Qualiopi financée (OPCO, AGEFICE, FAFCEA) ?
