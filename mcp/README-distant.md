# MCP distant — brancher le CRM sur claude.ai, Claude Desktop ou n8n

Serveur MCP **hébergé** (Edge Function `mcp`), joignable de n'importe où :

```
https://vkirutbpxzybucuiyjnb.supabase.co/functions/v1/mcp
```

Même catalogue que l'assistant du CRM (`supabase/functions/_shared/agent/`) :
lectures (contacts, pipeline, dossiers, devis, sessions, documents,
statistiques…) et `proposer_*`, plus `lister_propositions`. Le serveur local
(`mcp/crm-server.mjs`, voir README.md) reste l'option pour Claude Code sur ce
poste.

## Sécurité

- **Jeton personnel** `crm_mcp_…`, créé dans *Paramètres › Connecteur MCP*.
  Affiché une seule fois ; la base ne garde que son empreinte SHA-256
  (table `mcp_jetons`). Révocable à tout moment, effet immédiat (le jeton est
  vérifié à chaque requête). Validité au choix : 30 j, 90 j, 1 an ou illimitée.
- **Droits de l'utilisateur du jeton.** Le serveur agit avec une session Supabase
  Auth de cet utilisateur : la RLS s'applique, les droits par rôle et le
  masquage des montants (*Paramètres › Chatbot*) aussi.
- **Aucune écriture directe.** `proposer_*` crée une ligne `ai_actions` ; rien
  ne change tant que la proposition n'est pas validée dans le CRM, dans
  *Assistant › historique*, conversation « Connecteur MCP — <libellé> — <date> ».
  Le serveur distant n'a pas de mode « exécuter ».

### Comment le serveur obtient le contexte RLS (sans exposer la clé de service)

Le projet signe ses sessions en **ES256** ; la clé privée n'est pas extractible,
on ne peut donc pas fabriquer soi-même un JWT utilisateur (et l'ancien secret
HS256, qui signe aussi `service_role`, est voué à disparaître). À la place, à
la première requête d'un jeton, la fonction :

1. vérifie le jeton (empreinte, révocation, expiration) ;
2. génère côté serveur un lien magique pour l'utilisateur
   (`auth.admin.generateLink`, **aucun e-mail envoyé**, le lien ne sort pas de
   la fonction) et le vérifie aussitôt (`verifyOtp`) → une vraie session Auth ;
3. **ferme cette session** (`auth.admin.signOut`, portée `local`) : le refresh
   token est détruit, rien ne s'accumule dans `auth.sessions` ; l'access token
   (≤ 1 h) reste valable pour la Data API ;
4. interroge la base avec cet access token (clé publique + `Authorization`),
   exactement comme le navigateur.

L'access token reste dans la mémoire de l'instance, n'est jamais renvoyé au
client, et est renouvelé 5 min avant expiration. La clé de service ne sert qu'à
lire `mcp_jetons`, le rôle et les paramètres, et à ouvrir la session — jamais à
lire la donnée métier. Effets visibles : chaque ouverture apparaît comme une
connexion dans le journal Auth et met à jour « dernière connexion ».

## Créer un jeton

*Paramètres › Connecteur MCP* → libellé (« n8n relances », « Claude Desktop
portable »…) → **Créer un jeton** → copier le jeton (ou l'« URL pour
claude.ai »). Un jeton par usage : on révoque l'un sans couper les autres.

## claude.ai — connecteur personnalisé

Les connecteurs personnalisés de claude.ai n'envoient pas d'en-tête
personnalisé : le jeton passe donc dans l'URL.

1. *Paramètres › Connecteurs › Ajouter un connecteur personnalisé*.
2. Nom : `CRM AIssociate` ; URL :
   `https://vkirutbpxzybucuiyjnb.supabase.co/functions/v1/mcp?jeton=crm_mcp_…`
   (bouton « URL pour claude.ai » du CRM). Laisser les champs OAuth vides.
3. Activer le connecteur dans la conversation.

⚠ Dans l'URL, le jeton peut apparaître dans les journaux de la passerelle
Supabase (accessibles aux seuls admins du projet). Dédier un jeton à claude.ai,
avec une durée limitée, et le révoquer au moindre doute.

## Claude Desktop

Le plus simple : ajouter le connecteur sur claude.ai (ci-dessus), il est
partagé avec Claude Desktop. Pour garder le jeton hors de l'URL, passer par le
pont `mcp-remote` dans `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "crm-aissociate": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://vkirutbpxzybucuiyjnb.supabase.co/functions/v1/mcp",
        "--header", "Authorization:${CRM_MCP_TOKEN}"
      ],
      "env": { "CRM_MCP_TOKEN": "Bearer crm_mcp_…" }
    }
  }
}
```

(Fichier : `%APPDATA%\Claude\claude_desktop_config.json` sous Windows,
`~/Library/Application Support/Claude/claude_desktop_config.json` sous macOS.
Redémarrer Claude Desktop.) Le même bloc fonctionne dans Claude Code :
`claude mcp add --transport http crm https://…/functions/v1/mcp --header "Authorization: Bearer crm_mcp_…"`.

## n8n

Nœud **MCP Client Tool** (branché sur un nœud *AI Agent*) :

- *Endpoint* : `https://vkirutbpxzybucuiyjnb.supabase.co/functions/v1/mcp`
- *Server Transport* : **HTTP Streamable**
- *Authentication* : **Bearer Auth**, credential = le jeton `crm_mcp_…`
- *Tools to include* : tous, ou une sélection (ex. lectures seulement).

Les propositions créées par un workflow n8n arrivent dans le CRM comme les
autres, à valider à la main.

## Vérifier à la main

```bash
curl -s https://vkirutbpxzybucuiyjnb.supabase.co/functions/v1/mcp \
  -H "Authorization: Bearer crm_mcp_…" -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Sans jeton, avec un jeton inconnu, expiré ou révoqué : **401**.

## Technique

- `supabase/functions/mcp/index.ts` : transport HTTP, sans état (POST JSON-RPC
  → réponse `application/json` ; GET → 405). Déploiement :
  `npx --yes supabase functions deploy mcp --project-ref vkirutbpxzybucuiyjnb --use-api --no-verify-jwt`
  (`--no-verify-jwt` : le jeton n'est pas un JWT, la fonction l'authentifie elle-même).
- `supabase/functions/_shared/mcp_jeton.ts` : vérification du jeton, session courte.
- `supabase/functions/_shared/mcp_protocole.ts` : JSON-RPC / MCP.
- `supabase/migrations/20261014100000_mcp_jetons.sql` : table, RLS, RPC
  `creer_jeton_mcp` / `revoquer_jeton_mcp`.
- Tests : `src/lib/__tests__/mcpJeton.test.ts`.
