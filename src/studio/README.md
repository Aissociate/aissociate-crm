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
`parametres.ai.model_studio`, sinon `model_agent`, sinon `anthropic/claude-sonnet-4.5`.
Les réponses arrivent en flux SSE (`meta`, `delta`, `done`, `error`) et le raisonnement
éventuel du modèle n'est jamais relayé.

## Suite envisagée
Plusieurs espaces par entreprise (pôles), invitations par les propriétaires, connecteurs
(Gmail, Google Agenda, LinkedIn) avec actions validées par l'utilisateur, missions
récurrentes planifiées, WhatsApp.
