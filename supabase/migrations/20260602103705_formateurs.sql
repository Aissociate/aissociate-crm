/*
  # 18 — Gestion des formateurs + documentation + affectation au planning
*/
create table if not exists public.formateurs (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  prenom      text,
  email       text,
  telephone   text,
  specialites text,
  statut      text not null default 'actif',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_formateurs_updated on public.formateurs;
create trigger trg_formateurs_updated before update on public.formateurs
  for each row execute function public.set_updated_at();
alter table public.formateurs enable row level security;

create table if not exists public.formateur_documents (
  id           uuid primary key default gen_random_uuid(),
  formateur_id uuid not null references public.formateurs(id) on delete cascade,
  titre        text not null,
  categorie    text not null default 'autre',
  fichier_url  text,
  version      integer not null default 1,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_formateur_docs on public.formateur_documents(formateur_id);
alter table public.formateur_documents enable row level security;

alter table public.sessions_formation
  add column if not exists formateur_id uuid references public.formateurs(id) on delete set null;

drop policy if exists formateurs_select on public.formateurs;
create policy formateurs_select on public.formateurs for select to authenticated using (true);
drop policy if exists formateurs_write on public.formateurs;
create policy formateurs_write on public.formateurs for all to authenticated
  using (is_manager()) with check (is_manager());

drop policy if exists formateur_docs_select on public.formateur_documents;
create policy formateur_docs_select on public.formateur_documents for select to authenticated using (true);
drop policy if exists formateur_docs_write on public.formateur_documents;
create policy formateur_docs_write on public.formateur_documents for all to authenticated
  using (is_manager()) with check (is_manager());

insert into storage.buckets (id, name, public) values ('formateurs', 'formateurs', false)
on conflict (id) do nothing;

drop policy if exists "formateurs_storage_rw" on storage.objects;
create policy "formateurs_storage_rw" on storage.objects for all to authenticated
  using (bucket_id = 'formateurs') with check (bucket_id = 'formateurs');
