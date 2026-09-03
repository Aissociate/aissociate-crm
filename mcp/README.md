# MCP CRM — brancher le CRM sur Claude

Serveur MCP local qui donne à Claude un accès direct au CRM : consulter les
contacts, le pipeline, les dossiers, les devis, les sessions, la base
documentaire, et **proposer** des écritures que tu valides ensuite dans le CRM.

C'est le même catalogue d'outils que l'assistant interne (Edge Function
`agent`), servi cette fois à Claude Code au lieu du chat du CRM.

## Ce que ça permet

| Outil | Ce qu'il fait |
|---|---|
| `rechercher_contacts`, `fiche_contact` | Contacts, avec suivi, opportunités et dossiers liés |
| `lister_actions_a_faire` | Relances planifiées, filtrables sur le retard |
| `rechercher_entreprises` | Entreprises (raison sociale, SIRET, ville, secteur) |
| `lister_pipeline` | Opportunités par étape, avec probabilité et échéance |
| `lister_dossiers`, `fiche_dossier` | Dossiers de financement et leurs pièces |
| `lister_devis` | Devis émis |
| `catalogue_formations`, `lister_sessions` | Catalogue et sessions planifiées |
| `rechercher_documents` | Recherche full-text dans la base documentaire interne |
| `lister_leads`, `lister_candidats` | Leads du site et candidats *(direction uniquement)* |
| `statistiques` | Agrégats calculés en base (pipeline, contacts, devis, dossiers, activité, sessions) |
| `proposer_*` (7 outils) | Créent une **proposition** à valider dans le CRM |
| `lister_propositions` | Statut des propositions (validées, annulées, expirées) |

## Sécurité

- Le serveur se connecte avec **ton compte CRM** (email + mot de passe, via la
  clé anonyme publique). Toutes les requêtes passent par la RLS : Claude voit
  exactement ce que tu vois, ni plus. La clé de service n'est jamais utilisée.
- Les droits par rôle (direction / conseiller) et le masquage des montants
  suivent la configuration `Paramètres > Chatbot`, comme dans l'assistant.
- **Aucune écriture directe.** Les outils `proposer_*` créent une ligne
  `ai_actions` en statut `proposee` ; rien ne touche la base tant que tu n'as
  pas cliqué « Valider » dans le CRM. Une proposition ignorée expire au bout
  de 24 h.
- Les propositions arrivent dans **Assistant > historique**, dans une
  conversation nommée « Claude Code (MCP) — <date> ». C'est là que tu valides
  ou que tu annules.

## Installation

1. Les dépendances sont déjà dans le projet (`npm install` si ce n'est pas fait).

2. Déclare le serveur dans `.mcp.json` à la racine (ce fichier est ignoré par
   git : ton mot de passe ne part jamais sur GitHub) :

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=vkirutbpxzybucuiyjnb"
    },
    "crm": {
      "command": "node",
      "args": ["mcp/crm-server.mjs"],
      "env": {
        "CRM_EMAIL": "ton.email@aissociate.re",
        "CRM_PASSWORD": "ton-mot-de-passe-CRM"
      }
    }
  }
}
```

3. Relance Claude Code. Le serveur `crm` apparaît dans `/mcp`.

Pour vérifier le branchement sans passer par Claude :

```bash
CRM_EMAIL=... CRM_PASSWORD=... npm run mcp
```

Le serveur affiche `connecté : … — rôle …` puis `serveur MCP prêt (stdio)`, et
reste en attente. `Ctrl+C` pour sortir.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `CRM_EMAIL` | **Requis.** Email du compte CRM |
| `CRM_PASSWORD` | **Requis.** Mot de passe du compte CRM |
| `CRM_SUPABASE_URL` | Optionnel, par défaut le projet de production |
| `CRM_SUPABASE_ANON_KEY` | Optionnel, par défaut la clé anonyme publique du projet |

## À savoir

- Le catalogue d'outils est **dupliqué** depuis
  `supabase/functions/agent/index.ts` : une évolution des outils de l'assistant
  doit être reportée ici. Les deux fichiers sont volontairement écrits de la
  même façon pour que la comparaison reste facile.
- **Deux écarts volontaires** avec l'Edge Function `agent`, qui sont des
  correctifs — l'assistant du CRM a toujours les deux défauts :
  - `fiche_dossier` : l'Edge Function sélectionne `dossier_pieces.date_reception`,
    colonne qui n'existe pas. Le select échoue, l'erreur est ignorée, et la
    liste des pièces remonte donc **toujours vide**. Ici : `commentaire` +
    `updated_at`, et l'erreur éventuelle est remontée.
  - `proposer_maj_statut_dossier` : l'Edge Function oublie `en_instruction`,
    pourtant une valeur de l'enum `dossier_statut`. Ajoutée ici.
- `parametres` n'est lisible en base que par un compte admin. Avec un compte
  conseiller, le serveur retombe sur les droits par défaut ; la RLS reste de
  toute façon la limite réelle du périmètre.
