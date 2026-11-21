-- Connecteur réservé à certains agents (Studio › Réglages et connecteurs › « Agents »).
--
-- Une ligne par connecteur restreint :
--   cle     « zernio:<id du compte Zernio> » (messagerie, agenda, fichiers, réseau social, application en un clic)
--           ou le type d'une ligne studio_connecteurs (« api:brevo », « mcp:notion », « smtp »…) ;
--   agents  identifiants des agents qui peuvent s'en servir.
-- Pas de ligne = toute l'équipe (rien ne change pour les connecteurs existants).
-- Aucune donnée existante n'est modifiée.

create table if not exists public.studio_connecteur_agents (
  workspace_id uuid not null references public.studio_workspaces(id) on delete cascade,
  cle          text not null check (char_length(cle) between 1 and 200),
  agents       text[] not null check (cardinality(agents) between 1 and 20),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, cle)
);
alter table public.studio_connecteur_agents enable row level security;
drop policy if exists studio_connecteur_agents_manager on public.studio_connecteur_agents;
create policy studio_connecteur_agents_manager on public.studio_connecteur_agents for select to authenticated using (public.is_manager());
