alter table public.plans_formation
  add column if not exists dossier_id uuid references public.dossiers(id) on delete set null;
create index if not exists idx_plans_dossier on public.plans_formation(dossier_id);

alter table public.documents
  add column if not exists dossier_id uuid references public.dossiers(id) on delete set null;
create index if not exists idx_documents_dossier on public.documents(dossier_id);

create index if not exists idx_dossiers_contact on public.dossiers(contact_id);
create index if not exists idx_dossiers_contact_formation on public.dossiers(contact_id, formation_id);

notify pgrst, 'reload schema';
