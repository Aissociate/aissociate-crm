/*
  # 03 — Formations, plans de formation, workflows & dossiers (CDC 4.2 / 4.3)

  1. Tables
     - `formations`        : catalogue (objectifs, programme, duree, modalite, prix)
     - `plans_formation`   : plan sur mesure derive d'une formation (versionne)
     - `workflows`         : workflow parametrable par financeur
     - `workflow_etapes`   : etapes ordonnees d'un workflow
     - `dossiers`          : dossier de financement (statut metier, montants, dates)
     - `dossier_pieces`    : pieces justificatives (statut, obligatoire, version)

  2. Logique
     - Un dossier reference un financeur -> choix du workflow associe.
     - Le statut suit l'enum dossier_statut ; etape_courante reference le workflow.

  3. Securite : RLS activee ; conseiller limite a ses dossiers via owner_id.
*/

-- FORMATIONS (catalogue)
create table if not exists public.formations (
  id            uuid primary key default gen_random_uuid(),
  intitule      text not null,
  objectifs     text,
  programme     jsonb not null default '[]'::jsonb,
  prerequis     text,
  public_vise   text,
  duree_heures  integer not null default 0,
  modalite      text not null default 'presentiel',
  prix          numeric(12,2) default 0,
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_formations_updated on public.formations;
create trigger trg_formations_updated before update on public.formations
  for each row execute function public.set_updated_at();

alter table public.formations enable row level security;

-- PLANS DE FORMATION (sur mesure, versionnes)
create table if not exists public.plans_formation (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  formation_id  uuid references public.formations(id) on delete set null,
  contact_id    uuid references public.contacts(id) on delete set null,
  entreprise_id uuid references public.entreprises(id) on delete set null,
  financeur_id  uuid references public.financeurs(id) on delete set null,
  objectifs     text,
  contenu       jsonb not null default '[]'::jsonb,
  duree_heures  integer not null default 0,
  modalite      text not null default 'presentiel',
  statut        public.plan_statut not null default 'brouillon',
  version       integer not null default 1,
  owner_id      uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_plans_updated on public.plans_formation;
create trigger trg_plans_updated before update on public.plans_formation
  for each row execute function public.set_updated_at();

create index if not exists idx_plans_owner on public.plans_formation(owner_id);
alter table public.plans_formation enable row level security;

-- WORKFLOWS (parametrables par financeur)
create table if not exists public.workflows (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null,
  financeur_id uuid references public.financeurs(id) on delete cascade,
  actif        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_workflows_updated on public.workflows;
create trigger trg_workflows_updated before update on public.workflows
  for each row execute function public.set_updated_at();

alter table public.workflows enable row level security;

create table if not exists public.workflow_etapes (
  id          uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  ordre       integer not null default 0,
  libelle     text not null,
  description text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_wf_etapes_wf on public.workflow_etapes(workflow_id);
alter table public.workflow_etapes enable row level security;

-- DOSSIERS
create table if not exists public.dossiers (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,
  intitule        text not null,
  contact_id      uuid references public.contacts(id) on delete set null,
  entreprise_id   uuid references public.entreprises(id) on delete set null,
  financeur_id    uuid references public.financeurs(id) on delete set null,
  formation_id    uuid references public.formations(id) on delete set null,
  plan_id         uuid references public.plans_formation(id) on delete set null,
  workflow_id     uuid references public.workflows(id) on delete set null,
  statut          public.dossier_statut not null default 'brouillon',
  etape_courante  integer not null default 0,
  montant_demande numeric(12,2) default 0,
  montant_accorde numeric(12,2) default 0,
  date_debut      date,
  date_fin        date,
  date_depot      date,
  owner_id        uuid references public.profiles(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_dossiers_updated on public.dossiers;
create trigger trg_dossiers_updated before update on public.dossiers
  for each row execute function public.set_updated_at();

create index if not exists idx_dossiers_owner on public.dossiers(owner_id);
create index if not exists idx_dossiers_statut on public.dossiers(statut);
create index if not exists idx_dossiers_financeur on public.dossiers(financeur_id);
alter table public.dossiers enable row level security;

-- PIECES JUSTIFICATIVES
create table if not exists public.dossier_pieces (
  id           uuid primary key default gen_random_uuid(),
  dossier_id   uuid not null references public.dossiers(id) on delete cascade,
  libelle      text not null,
  obligatoire  boolean not null default true,
  statut       public.piece_statut not null default 'manquante',
  fichier_url  text,
  version      integer not null default 1,
  commentaire  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_pieces_updated on public.dossier_pieces;
create trigger trg_pieces_updated before update on public.dossier_pieces
  for each row execute function public.set_updated_at();

create index if not exists idx_pieces_dossier on public.dossier_pieces(dossier_id);
alter table public.dossier_pieces enable row level security;
