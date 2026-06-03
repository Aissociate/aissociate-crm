/*
  # Coffre documentaire de la fiche contact

  - `contact_documents` : documents divers téléversés et rattachés à un contact
    (pièces, justificatifs, échanges…).
  - Bucket privé `coffre` pour les fichiers (URL signée à l'ouverture).

  Accès : direction (is_manager), conseiller affecté au contact (owner/responsable),
  ou l'utilisateur ayant déposé le document.
*/

create table if not exists public.contact_documents (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  titre       text not null,
  categorie   text,
  fichier_url text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_contact_documents_contact on public.contact_documents(contact_id);
alter table public.contact_documents enable row level security;

drop policy if exists contact_documents_all on public.contact_documents;
create policy contact_documents_all on public.contact_documents for all to authenticated
  using (
    is_manager()
    or created_by = auth.uid()
    or exists (select 1 from public.contacts c where c.id = contact_id and (c.owner_id = auth.uid() or c.responsable_id = auth.uid()))
  )
  with check (
    is_manager()
    or created_by = auth.uid()
    or exists (select 1 from public.contacts c where c.id = contact_id and (c.owner_id = auth.uid() or c.responsable_id = auth.uid()))
  );

-- Bucket privé pour le coffre des contacts
insert into storage.buckets (id, name, public) values ('coffre', 'coffre', false) on conflict (id) do nothing;
drop policy if exists "coffre_storage_rw" on storage.objects;
create policy "coffre_storage_rw" on storage.objects for all to authenticated
  using (bucket_id = 'coffre') with check (bucket_id = 'coffre');

notify pgrst, 'reload schema';
