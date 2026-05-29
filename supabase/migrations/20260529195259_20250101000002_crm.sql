/*
  # 02 — Module CRM (CDC 4.1) : entreprises, contacts, pipeline commercial

  1. Tables
     - `entreprises` : clients / structures (raison sociale, SIRET, secteur...)
     - `contacts`    : prospects, apprenants, contacts entreprise/financeur
                       (champ `type`), avec consentement RGPD
     - `opportunites`: pipeline commercial (stages nouveau -> gagne/perdu)

  2. Relations
     - contacts.entreprise_id -> entreprises
     - contacts.financeur_id  -> financeurs (pour contact_financeur)
     - opportunites lie contact + entreprise + financeur + owner

  3. Securite
     - RLS activee ; owner_id = createur/proprietaire pour la regle conseiller.
*/

-- ENTREPRISES
create table if not exists public.entreprises (
  id              uuid primary key default gen_random_uuid(),
  raison_sociale  text not null,
  siret           text,
  naf             text,
  secteur         text,
  effectif        integer,
  adresse         text,
  code_postal     text,
  ville           text,
  telephone       text,
  email           text,
  site_web        text,
  notes           text,
  owner_id        uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_entreprises_updated on public.entreprises;
create trigger trg_entreprises_updated before update on public.entreprises
  for each row execute function public.set_updated_at();

create index if not exists idx_entreprises_owner on public.entreprises(owner_id);
alter table public.entreprises enable row level security;

-- CONTACTS
create table if not exists public.contacts (
  id            uuid primary key default gen_random_uuid(),
  type          public.contact_type not null default 'prospect',
  civilite      text,
  nom           text not null,
  prenom        text,
  email         text,
  telephone     text,
  fonction      text,
  entreprise_id uuid references public.entreprises(id) on delete set null,
  financeur_id  uuid references public.financeurs(id) on delete set null,
  owner_id      uuid references public.profiles(id) on delete set null,
  rgpd_consent  boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_contacts_updated on public.contacts;
create trigger trg_contacts_updated before update on public.contacts
  for each row execute function public.set_updated_at();

create index if not exists idx_contacts_owner on public.contacts(owner_id);
create index if not exists idx_contacts_entreprise on public.contacts(entreprise_id);
create index if not exists idx_contacts_type on public.contacts(type);
alter table public.contacts enable row level security;

-- OPPORTUNITES (pipeline)
create table if not exists public.opportunites (
  id                uuid primary key default gen_random_uuid(),
  titre             text not null,
  contact_id        uuid references public.contacts(id) on delete set null,
  entreprise_id     uuid references public.entreprises(id) on delete set null,
  financeur_id      uuid references public.financeurs(id) on delete set null,
  montant           numeric(12,2) default 0,
  stage             public.opportunite_stage not null default 'nouveau',
  probabilite       integer not null default 10 check (probabilite between 0 and 100),
  date_cloture_prev date,
  owner_id          uuid references public.profiles(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_opportunites_updated on public.opportunites;
create trigger trg_opportunites_updated before update on public.opportunites
  for each row execute function public.set_updated_at();

create index if not exists idx_opportunites_owner on public.opportunites(owner_id);
create index if not exists idx_opportunites_stage on public.opportunites(stage);
alter table public.opportunites enable row level security;
