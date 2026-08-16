-- Ticket Benjamin « Dossiers ajout cadre "Autres documents" » : espace de dépôt
-- libre, distinct des pièces justificatives du dossier financeur — documents
-- informatifs, brouillons, versions non finalisées, etc.
--
-- Volontairement séparé de `dossier_pieces` : ces documents n'entrent pas dans
-- la checklist, n'ont pas de statut d'instruction ni de versionnage, et ne
-- doivent pas peser sur le décompte « x/y validées ».
create table if not exists public.dossier_documents (
  id           uuid primary key default gen_random_uuid(),
  dossier_id   uuid not null references public.dossiers(id) on delete cascade,
  titre        text not null,
  description  text,
  fichier_url  text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on table public.dossier_documents is
  'Documents libres rattachés à un dossier (hors pièces justificatives du financeur).';

create index if not exists dossier_documents_dossier_id_idx
  on public.dossier_documents (dossier_id);

alter table public.dossier_documents enable row level security;

-- Même visibilité que le dossier porteur : si l''utilisateur voit le dossier,
-- il voit et gère ses documents libres.
drop policy if exists dossier_documents_select on public.dossier_documents;
create policy dossier_documents_select
  on public.dossier_documents for select to authenticated
  using (exists (select 1 from public.dossiers d where d.id = dossier_id));

drop policy if exists dossier_documents_insert on public.dossier_documents;
create policy dossier_documents_insert
  on public.dossier_documents for insert to authenticated
  with check (exists (select 1 from public.dossiers d where d.id = dossier_id));

drop policy if exists dossier_documents_update on public.dossier_documents;
create policy dossier_documents_update
  on public.dossier_documents for update to authenticated
  using (exists (select 1 from public.dossiers d where d.id = dossier_id));

drop policy if exists dossier_documents_delete on public.dossier_documents;
create policy dossier_documents_delete
  on public.dossier_documents for delete to authenticated
  using (exists (select 1 from public.dossiers d where d.id = dossier_id));
