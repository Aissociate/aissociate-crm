/*
  # Gestion des devis (Aissociate -> Client), conformes norme française

  - `devis` : en-tête (numéro chronologique, client, financeur, dates, statut,
    TVA, totaux, PDF). Numéro auto via séquence (numérotation continue exigée).
  - `devis_lignes` : prestations (désignation, quantité, unité, PU HT).
  - TVA : par défaut exonérée (formation pro, art. 261-4-4° du CGI) -> total = HT.
  - Bucket privé `devis` pour les PDF générés.

  Organisme émetteur (SIRET, N° déclaration d'activité, TVA intra…) : stocké dans
  le paramètre `organisme` (édité dans Paramètres), lu par l'Edge Function.
*/

do $$ begin
  if not exists (select 1 from pg_type where typname = 'devis_statut') then
    create type public.devis_statut as enum ('brouillon', 'envoye', 'accepte', 'refuse', 'expire');
  end if;
end $$;

create sequence if not exists public.devis_seq;

create table if not exists public.devis (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique default ('DEVIS-' || lpad(nextval('public.devis_seq')::text, 5, '0')),
  contact_id    uuid references public.contacts(id) on delete set null,
  entreprise_id uuid references public.entreprises(id) on delete set null,
  financeur_id  uuid references public.financeurs(id) on delete set null,
  dossier_id    uuid references public.dossiers(id) on delete set null,
  date_emission date not null default current_date,
  date_validite date,
  statut        public.devis_statut not null default 'brouillon',
  tva_taux      numeric not null default 0,
  tva_exoneree  boolean not null default true,
  total_ht      numeric not null default 0,
  total_tva     numeric not null default 0,
  total_ttc     numeric not null default 0,
  objet         text,
  conditions    text,
  notes         text,
  fichier_url   text,
  owner_id      uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_devis_contact on public.devis(contact_id);
create index if not exists idx_devis_owner on public.devis(owner_id);
alter table public.devis enable row level security;

create table if not exists public.devis_lignes (
  id               uuid primary key default gen_random_uuid(),
  devis_id         uuid not null references public.devis(id) on delete cascade,
  designation      text not null,
  description      text,
  quantite         numeric not null default 1,
  unite            text not null default 'heure',
  prix_unitaire_ht numeric not null default 0,
  ordre            int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_devis_lignes_devis on public.devis_lignes(devis_id);
alter table public.devis_lignes enable row level security;

-- RLS : direction voit tout, conseiller ses devis (owner). Les lignes suivent le devis.
drop policy if exists devis_select on public.devis;
create policy devis_select on public.devis for select to authenticated using (is_manager() or owner_id = auth.uid());
drop policy if exists devis_write on public.devis;
create policy devis_write on public.devis for all to authenticated using (is_manager() or owner_id = auth.uid()) with check (is_manager() or owner_id = auth.uid());

drop policy if exists devis_lignes_all on public.devis_lignes;
create policy devis_lignes_all on public.devis_lignes for all to authenticated
  using (exists (select 1 from public.devis d where d.id = devis_id and (is_manager() or d.owner_id = auth.uid())))
  with check (exists (select 1 from public.devis d where d.id = devis_id and (is_manager() or d.owner_id = auth.uid())));

-- Bucket privé pour les PDF de devis
insert into storage.buckets (id, name, public) values ('devis', 'devis', false) on conflict (id) do nothing;
drop policy if exists "devis_storage_rw" on storage.objects;
create policy "devis_storage_rw" on storage.objects for all to authenticated
  using (bucket_id = 'devis') with check (bucket_id = 'devis');
