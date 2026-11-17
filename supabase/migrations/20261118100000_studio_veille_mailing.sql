-- Studio IA — veille RSS, contacts et mailings.
-- studio_flux     : flux RSS / Atom suivis par un espace (30 au plus)
-- studio_veille   : articles agrégés (dédoublonnés par flux + guid, 90 jours)
-- studio_contacts : abonnés de l'espace (listes, désinscription par jeton)
-- studio_envois   : file d'envoi d'un mailing validé (un message par contact)
-- Données lues en service role par l'Edge Function `studio`, toujours filtrées
-- par workspace_id ; RLS : lecture réservée aux managers du CRM.

create table if not exists public.studio_flux (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.studio_workspaces(id) on delete cascade,
  url              text not null,
  titre            text not null default '',
  site             text,
  actif            boolean not null default true,
  derniere_lecture timestamptz,
  erreur           text,
  created_at       timestamptz not null default now(),
  unique (workspace_id, url)
);
alter table public.studio_flux enable row level security;
drop policy if exists studio_flux_manager on public.studio_flux;
create policy studio_flux_manager on public.studio_flux for select to authenticated using (public.is_manager());

create table if not exists public.studio_veille (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.studio_workspaces(id) on delete cascade,
  flux_id      uuid not null references public.studio_flux(id) on delete cascade,
  guid         text not null,
  titre        text not null,
  lien         text,
  resume       text not null default '',
  publie_le    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (flux_id, guid)
);
create index if not exists idx_studio_veille_ws on public.studio_veille(workspace_id, publie_le desc);
create index if not exists idx_studio_veille_lien on public.studio_veille(workspace_id, lien);
alter table public.studio_veille enable row level security;
drop policy if exists studio_veille_manager on public.studio_veille;
create policy studio_veille_manager on public.studio_veille for select to authenticated using (public.is_manager());

create table if not exists public.studio_contacts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.studio_workspaces(id) on delete cascade,
  email         text not null check (email = lower(email)),
  prenom        text,
  nom           text,
  listes        text[] not null default '{}',
  source        text,
  jeton         text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  desinscrit_le timestamptz,
  created_at    timestamptz not null default now(),
  unique (workspace_id, email)
);
create index if not exists idx_studio_contacts_listes on public.studio_contacts using gin (listes);
alter table public.studio_contacts enable row level security;
drop policy if exists studio_contacts_manager on public.studio_contacts;
create policy studio_contacts_manager on public.studio_contacts for select to authenticated using (public.is_manager());

create table if not exists public.studio_envois (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.studio_workspaces(id) on delete cascade,
  livrable_id  uuid not null references public.studio_livrables(id) on delete cascade,
  contact_id   uuid not null references public.studio_contacts(id) on delete cascade,
  email        text not null,
  statut       text not null default 'a_envoyer' check (statut in ('a_envoyer', 'en_cours', 'envoye', 'echec', 'ignore')),
  erreur       text,
  envoye_le    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (livrable_id, contact_id)
);
create index if not exists idx_studio_envois_file on public.studio_envois(statut, livrable_id);
create index if not exists idx_studio_envois_jour on public.studio_envois(workspace_id, envoye_le) where statut = 'envoye';
drop trigger if exists trg_studio_envois_updated on public.studio_envois;
create trigger trg_studio_envois_updated before update on public.studio_envois
  for each row execute function public.set_updated_at();
alter table public.studio_envois enable row level security;
drop policy if exists studio_envois_manager on public.studio_envois;
create policy studio_envois_manager on public.studio_envois for select to authenticated using (public.is_manager());

notify pgrst, 'reload schema';
