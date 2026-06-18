-- 1. Documents de recrutement (coffre du candidat)
create table if not exists public.candidat_documents (
  id          uuid primary key default gen_random_uuid(),
  candidat_id uuid not null references public.candidats(id) on delete cascade,
  titre       text not null,
  categorie   text,
  fichier_url text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_candidat_documents_candidat
  on public.candidat_documents(candidat_id, created_at desc);
alter table public.candidat_documents enable row level security;

drop policy if exists candidat_documents_all on public.candidat_documents;
create policy candidat_documents_all on public.candidat_documents
  for all to authenticated
  using (is_manager()) with check (is_manager());

-- 2. Bucket privé dédié au recrutement (URL signée à l'ouverture)
insert into storage.buckets (id, name, public)
  values ('recrutement', 'recrutement', false)
  on conflict (id) do nothing;
drop policy if exists "recrutement_rw" on storage.objects;
create policy "recrutement_rw" on storage.objects for all to authenticated
  using (bucket_id = 'recrutement' and is_manager())
  with check (bucket_id = 'recrutement' and is_manager());

-- 3. Champs conseiller : statut + date de recrutement
alter table public.profiles
  add column if not exists statut_conseiller text default 'actif',
  add column if not exists date_recrutement date;

notify pgrst, 'reload schema';
