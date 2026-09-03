/*
  # Facturation (norme française, numérotation continue)

  - `factures` : miroir des devis (client, financeur, dossier, TVA exonérée
    formation pro) + échéance, règlement (date, mode) et rapprochement
    bancaire Qonto (`qonto_transaction_id`, `rapproche_le`).
  - `facture_lignes` : prestations.
  - Bucket privé `factures` pour les PDF (Edge Function `generate-facture`).
  - RLS identique aux devis : direction = tout, conseiller = ses factures.
*/

do $$ begin
  if not exists (select 1 from pg_type where typname = 'facture_statut') then
    create type public.facture_statut as enum ('brouillon', 'envoyee', 'payee', 'annulee');
  end if;
end $$;

create sequence if not exists public.factures_seq;

create table if not exists public.factures (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique default ('FACT-' || lpad(nextval('public.factures_seq')::text, 5, '0')),
  devis_id      uuid references public.devis(id) on delete set null,
  contact_id    uuid references public.contacts(id) on delete set null,
  entreprise_id uuid references public.entreprises(id) on delete set null,
  financeur_id  uuid references public.financeurs(id) on delete set null,
  dossier_id    uuid references public.dossiers(id) on delete set null,
  formation_id  uuid references public.formations(id) on delete set null,
  date_emission date not null default current_date,
  date_echeance date,
  statut        public.facture_statut not null default 'brouillon',
  tva_taux      numeric not null default 0,
  tva_exoneree  boolean not null default true,
  total_ht      numeric not null default 0,
  total_tva     numeric not null default 0,
  total_ttc     numeric not null default 0,
  objet         text,
  conditions    text,
  notes         text,
  fichier_url   text,
  date_reglement date,
  mode_reglement text,
  qonto_transaction_id text,
  rapproche_le  timestamptz,
  owner_id      uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_factures_contact on public.factures(contact_id);
create index if not exists idx_factures_statut on public.factures(statut);
create index if not exists idx_factures_owner on public.factures(owner_id);
alter table public.factures enable row level security;

drop trigger if exists trg_factures_updated on public.factures;
create trigger trg_factures_updated before update on public.factures
  for each row execute function public.set_updated_at();

create table if not exists public.facture_lignes (
  id               uuid primary key default gen_random_uuid(),
  facture_id       uuid not null references public.factures(id) on delete cascade,
  designation      text not null,
  description      text,
  quantite         numeric not null default 1,
  unite            text not null default 'heure',
  prix_unitaire_ht numeric not null default 0,
  ordre            int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_facture_lignes_facture on public.facture_lignes(facture_id);
alter table public.facture_lignes enable row level security;

drop policy if exists factures_select on public.factures;
create policy factures_select on public.factures for select to authenticated
  using (is_manager() or owner_id = auth.uid());
drop policy if exists factures_write on public.factures;
create policy factures_write on public.factures for all to authenticated
  using (is_manager() or owner_id = auth.uid())
  with check (is_manager() or owner_id = auth.uid());

drop policy if exists facture_lignes_all on public.facture_lignes;
create policy facture_lignes_all on public.facture_lignes for all to authenticated
  using (exists (select 1 from public.factures f where f.id = facture_id and (is_manager() or f.owner_id = auth.uid())))
  with check (exists (select 1 from public.factures f where f.id = facture_id and (is_manager() or f.owner_id = auth.uid())));

insert into storage.buckets (id, name, public) values ('factures', 'factures', false) on conflict (id) do nothing;
drop policy if exists "factures_storage_rw" on storage.objects;
create policy "factures_storage_rw" on storage.objects for all to authenticated
  using (bucket_id = 'factures') with check (bucket_id = 'factures');

notify pgrst, 'reload schema';
