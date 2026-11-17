-- Studio IA : dossiers pour ranger ressources (notes, fichiers, compétences), livrables et médias.
-- Arborescence par espace (parent_id), créée par le client ou par ses agents.
-- Supprimer un dossier ne supprime rien d'autre : son contenu remonte au dossier parent
-- (fait par la fonction studio) ; à défaut, ON DELETE SET NULL le remet à la racine.

create table if not exists public.studio_dossiers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.studio_workspaces(id) on delete cascade,
  parent_id uuid references public.studio_dossiers(id) on delete cascade,
  nom text not null check (char_length(btrim(nom)) between 1 and 80 and position('/' in nom) = 0),
  cree_par text,            -- « Prénom » de l'utilisateur ou de l'agent
  created_at timestamptz not null default now()
);

-- Pas deux dossiers du même nom au même endroit (casse ignorée).
create unique index if not exists studio_dossiers_nom_unique
  on public.studio_dossiers (workspace_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(nom)));
create index if not exists studio_dossiers_ws on public.studio_dossiers (workspace_id);

alter table public.studio_dossiers enable row level security;
drop policy if exists studio_dossiers_manager on public.studio_dossiers;
create policy studio_dossiers_manager on public.studio_dossiers for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

alter table public.studio_documents add column if not exists dossier_id uuid references public.studio_dossiers(id) on delete set null;
alter table public.studio_livrables add column if not exists dossier_id uuid references public.studio_dossiers(id) on delete set null;
alter table public.studio_medias    add column if not exists dossier_id uuid references public.studio_dossiers(id) on delete set null;

create index if not exists studio_documents_dossier on public.studio_documents (dossier_id) where dossier_id is not null;
create index if not exists studio_livrables_dossier on public.studio_livrables (dossier_id) where dossier_id is not null;
create index if not exists studio_medias_dossier    on public.studio_medias (dossier_id) where dossier_id is not null;
