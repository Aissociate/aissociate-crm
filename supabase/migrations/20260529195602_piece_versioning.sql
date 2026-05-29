/*
  # 10 — Versioning des pièces justificatives (CDC 4.2)

  `piece_versions` conserve l'historique des fichiers d'une pièce. À chaque
  nouveau téléversement remplaçant un fichier existant, l'ancien est archivé
  ici et `dossier_pieces.version` est incrémenté.

  Sécurité : accès aligné sur le dossier parent (mêmes règles que les pièces).
*/

create table if not exists public.piece_versions (
  id          uuid primary key default gen_random_uuid(),
  piece_id    uuid not null references public.dossier_pieces(id) on delete cascade,
  version     integer not null,
  fichier_url text,
  commentaire text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_piece_versions_piece on public.piece_versions(piece_id);
alter table public.piece_versions enable row level security;

-- Hérite des droits du dossier parent (via piece -> dossier)
drop policy if exists piece_versions_all on public.piece_versions;
create policy piece_versions_all on public.piece_versions for all to authenticated
  using (exists (
    select 1 from public.dossier_pieces p
    join public.dossiers d on d.id = p.dossier_id
    where p.id = piece_id and (is_manager() or d.owner_id = auth.uid())
  ))
  with check (exists (
    select 1 from public.dossier_pieces p
    join public.dossiers d on d.id = p.dossier_id
    where p.id = piece_id and (is_manager() or d.owner_id = auth.uid())
  ));
