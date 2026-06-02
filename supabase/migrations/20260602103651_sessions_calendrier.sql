/*
  # 17 — Calendrier des sessions de formation + participants
*/
create table if not exists public.sessions_formation (
  id           uuid primary key default gen_random_uuid(),
  titre        text not null,
  formation_id uuid references public.formations(id) on delete set null,
  dossier_id   uuid references public.dossiers(id) on delete set null,
  date_debut   timestamptz not null,
  date_fin     timestamptz,
  lieu         text,
  modalite     text not null default 'presentiel',
  formateur    text,
  couleur      text not null default '#ea6a1e',
  notes        text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_sessions_updated on public.sessions_formation;
create trigger trg_sessions_updated before update on public.sessions_formation
  for each row execute function public.set_updated_at();

create index if not exists idx_sessions_debut on public.sessions_formation(date_debut);
alter table public.sessions_formation enable row level security;

create table if not exists public.session_participants (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions_formation(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  nom        text not null,
  prenom     text,
  email      text,
  statut     text not null default 'inscrit',
  created_at timestamptz not null default now()
);

create index if not exists idx_participants_session on public.session_participants(session_id);
alter table public.session_participants enable row level security;

drop policy if exists sessions_all on public.sessions_formation;
create policy sessions_all on public.sessions_formation for all to authenticated
  using (true) with check (true);

drop policy if exists participants_all on public.session_participants;
create policy participants_all on public.session_participants for all to authenticated
  using (true) with check (true);
