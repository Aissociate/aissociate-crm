/*
  # 04 — Espace doc (4.5), Kanban (4.6), Messagerie (4.7), Recrutement (4.4)

  1. Documents : base documentaire versionnee (Qualiopi), tags, categories
  2. Kanban    : boards -> colonnes -> cartes (parametrable), carte liee a un dossier
  3. Emails    : journal des messages envoyes (SMTP) lies dossier/contact
  4. Recrutement : offres + candidats (statut, score, RGPD)

  Securite : RLS activee partout (policies dans 06_rls).
*/

-- ESPACE DOCUMENTAIRE
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  titre       text not null,
  categorie   text not null default 'general',
  description text,
  fichier_url text,
  version     integer not null default 1,
  statut      text not null default 'actif',
  parent_id   uuid references public.documents(id) on delete set null,
  tags        text[] not null default '{}',
  owner_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_documents_updated on public.documents;
create trigger trg_documents_updated before update on public.documents
  for each row execute function public.set_updated_at();

create index if not exists idx_documents_categorie on public.documents(categorie);
alter table public.documents enable row level security;

-- KANBAN
create table if not exists public.kanban_boards (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  description text,
  owner_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_boards_updated on public.kanban_boards;
create trigger trg_boards_updated before update on public.kanban_boards
  for each row execute function public.set_updated_at();
alter table public.kanban_boards enable row level security;

create table if not exists public.kanban_colonnes (
  id        uuid primary key default gen_random_uuid(),
  board_id  uuid not null references public.kanban_boards(id) on delete cascade,
  titre     text not null,
  ordre     integer not null default 0,
  couleur   text not null default '#3375f5',
  created_at timestamptz not null default now()
);
create index if not exists idx_colonnes_board on public.kanban_colonnes(board_id);
alter table public.kanban_colonnes enable row level security;

create table if not exists public.kanban_cartes (
  id          uuid primary key default gen_random_uuid(),
  colonne_id  uuid not null references public.kanban_colonnes(id) on delete cascade,
  titre       text not null,
  description text,
  assignee_id uuid references public.profiles(id) on delete set null,
  dossier_id  uuid references public.dossiers(id) on delete set null,
  ordre       integer not null default 0,
  echeance    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_cartes_updated on public.kanban_cartes;
create trigger trg_cartes_updated before update on public.kanban_cartes
  for each row execute function public.set_updated_at();
create index if not exists idx_cartes_colonne on public.kanban_cartes(colonne_id);
alter table public.kanban_cartes enable row level security;

-- MESSAGERIE (journal d'envoi)
create table if not exists public.emails (
  id          uuid primary key default gen_random_uuid(),
  dossier_id  uuid references public.dossiers(id) on delete set null,
  contact_id  uuid references public.contacts(id) on delete set null,
  expediteur  text,
  destinataires text[] not null default '{}',
  sujet       text not null,
  corps       text,
  statut      text not null default 'brouillon',
  sent_at     timestamptz,
  owner_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_emails_dossier on public.emails(dossier_id);
alter table public.emails enable row level security;

-- RECRUTEMENT
create table if not exists public.offres_recrutement (
  id          uuid primary key default gen_random_uuid(),
  titre       text not null,
  description text,
  profil      text,
  lieu        text,
  statut      text not null default 'ouverte',
  owner_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_offres_updated on public.offres_recrutement;
create trigger trg_offres_updated before update on public.offres_recrutement
  for each row execute function public.set_updated_at();
alter table public.offres_recrutement enable row level security;

create table if not exists public.candidats (
  id           uuid primary key default gen_random_uuid(),
  offre_id     uuid references public.offres_recrutement(id) on delete set null,
  nom          text not null,
  prenom       text,
  email        text,
  telephone    text,
  cv_url       text,
  statut       public.candidat_statut not null default 'recu',
  score        integer check (score between 0 and 100),
  notes        text,
  rgpd_consent boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_candidats_updated on public.candidats;
create trigger trg_candidats_updated before update on public.candidats
  for each row execute function public.set_updated_at();
create index if not exists idx_candidats_offre on public.candidats(offre_id);
alter table public.candidats enable row level security;
