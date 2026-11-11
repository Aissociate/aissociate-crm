/*
  Studio IA — choix du modèle OpenRouter.

  Ordre de priorité (le premier renseigné l'emporte) :
    1. studio_workspace_agents.modele  : cet agent, pour ce client
    2. studio_workspaces.modele        : tous les agents de ce client
    3. studio_agents.modele            : cet agent, par défaut
    4. parametres.ai.model_studio, puis parametres.ai.model_agent
    5. anthropic/claude-sonnet-4.5
  La clé utilisée reste celle du CRM (secret OPENROUTER_API_KEY, sinon parametres.ai.openrouter_key).
*/
alter table public.studio_agents           add column if not exists modele text;
alter table public.studio_workspaces       add column if not exists modele text;
alter table public.studio_workspace_agents add column if not exists modele text;

notify pgrst, 'reload schema';
