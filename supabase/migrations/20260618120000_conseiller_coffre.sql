/*
  # Coffre-fort personnel des conseillers

  Espace documentaire propre à chaque conseiller : la direction y dépose les
  documents qui lui sont destinés (scripts, grilles tarifaires, modèles…). Le
  conseiller consulte (et peut alimenter) son propre coffre ; la direction voit
  et gère tous les coffres.

  - Table `conseiller_documents` (métadonnées + URL du fichier).
  - Bucket privé `conseiller_coffre` (ouverture via URL signée).
*/

create table if not exists public.conseiller_documents (
  id            uuid primary key default gen_random_uuid(),
  conseiller_id uuid not null references public.profiles(id) on delete cascade,
  titre         text not null,
  categorie     text,
  fichier_url   text not null,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_conseiller_documents_conseiller
  on public.conseiller_documents(conseiller_id, created_at desc);
alter table public.conseiller_documents enable row level security;

-- Direction (is_manager) : tous les coffres. Conseiller : uniquement le sien.
drop policy if exists conseiller_documents_all on public.conseiller_documents;
create policy conseiller_documents_all on public.conseiller_documents
  for all to authenticated
  using (is_manager() or conseiller_id = auth.uid())
  with check (is_manager() or conseiller_id = auth.uid());

-- Bucket privé pour les fichiers du coffre conseiller (URL signée à l'ouverture)
insert into storage.buckets (id, name, public)
  values ('conseiller_coffre', 'conseiller_coffre', false)
  on conflict (id) do nothing;
drop policy if exists "conseiller_coffre_rw" on storage.objects;
create policy "conseiller_coffre_rw" on storage.objects for all to authenticated
  using (bucket_id = 'conseiller_coffre') with check (bucket_id = 'conseiller_coffre');

notify pgrst, 'reload schema';
