/*
  # 21 — Fiche de suivi contact + journal d'actions
*/
alter table public.contacts add column if not exists statut_entreprise text;
alter table public.contacts add column if not exists ville text;
alter table public.contacts add column if not exists autres text;
alter table public.contacts add column if not exists effectif text;
alter table public.contacts add column if not exists besoin_resume text;
alter table public.contacts add column if not exists formation_envisagee text;
alter table public.contacts add column if not exists financement_envisage text;
alter table public.contacts add column if not exists interet text;
alter table public.contacts add column if not exists statut_prospect text;
alter table public.contacts add column if not exists responsable_id uuid references public.profiles(id) on delete set null;
alter table public.contacts add column if not exists date_fixee date;
alter table public.contacts add column if not exists eligibilite_verifiee boolean not null default false;
alter table public.contacts add column if not exists financement_demande boolean not null default false;
alter table public.contacts add column if not exists financement_valide boolean not null default false;
alter table public.contacts add column if not exists inscription_validee boolean not null default false;
alter table public.contacts add column if not exists date_formation date;
alter table public.contacts add column if not exists assiette_commission numeric(12,2);
alter table public.contacts add column if not exists commission_validee boolean not null default false;
alter table public.contacts add column if not exists commission_payee boolean not null default false;

create table if not exists public.contact_actions (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  date_action date not null default current_date,
  type        text not null default 'note',
  description text not null,
  faite       boolean not null default true,
  auteur_id   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_contact_actions_contact on public.contact_actions(contact_id, date_action desc);
alter table public.contact_actions enable row level security;

drop policy if exists contact_actions_all on public.contact_actions;
create policy contact_actions_all on public.contact_actions for all to authenticated
  using (exists (select 1 from public.contacts c where c.id = contact_id and (is_manager() or c.owner_id = auth.uid())))
  with check (exists (select 1 from public.contacts c where c.id = contact_id and (is_manager() or c.owner_id = auth.uid())));
