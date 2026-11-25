-- Calendrier par défaut du Studio (Aujourd'hui › Calendrier) : rappels posés par les agents
-- (outil rappel_programmer, quand aucun agenda n'est connecté) ou par l'utilisateur.
-- Le calendrier affiche aussi, sans table dédiée, les prochains passages des routines
-- (studio_taches) et les publications programmées (studio_livrables, action reseaux_publier).
-- Aucune donnée existante n'est modifiée.

create table if not exists public.studio_rappels (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.studio_workspaces(id) on delete cascade,
  agent_id        text,
  titre           text not null check (char_length(titre) between 1 and 200),
  note            text check (note is null or char_length(note) <= 2000),
  quand           timestamptz not null,
  cree_par        text not null,
  conversation_id uuid references public.studio_conversations(id) on delete set null,
  fait_le         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists studio_rappels_ws_quand on public.studio_rappels (workspace_id, quand);

alter table public.studio_rappels enable row level security;
drop policy if exists studio_rappels_manager on public.studio_rappels;
create policy studio_rappels_manager on public.studio_rappels for select to authenticated using (public.is_manager());
