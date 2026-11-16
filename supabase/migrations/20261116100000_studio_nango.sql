/*
  Studio IA — connexions en un clic via Nango (OAuth géré par Nango).

  Cloisonnement par client (tenant = studio_workspaces.id) :
  - les sessions de connexion Nango sont créées UNIQUEMENT par l'Edge Function
    `studio`, avec le tag organization_id = l'espace de la session Studio (jamais
    une valeur envoyée par le navigateur) ;
  - le webhook signé `nango-webhook` rattache la connexion à l'espace lu dans ces
    tags, après vérification HMAC et existence de l'espace ;
  - studio_nango_connexions n'a aucune politique pour les clients : seul le
    service role y écrit ; les managers du CRM la lisent.

  studio_connexion_invitations : liens « connectez votre application » envoyés
  par e-mail (valables 7 jours, rattachés à UN espace ; seul le SHA-256 du jeton
  est stocké). À l'ouverture, une session Nango fraîche (30 min) est créée.
*/

create table if not exists public.studio_nango_connexions (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.studio_workspaces(id) on delete cascade,
  integration_id text not null,           -- clé de l'intégration dans Nango (ex. google-calendar)
  connection_id  text not null,           -- identifiant de connexion Nango
  provider       text,
  statut         text not null default 'connecte' check (statut in ('connecte', 'erreur', 'revoque')),
  erreur         text,
  connecte_par   text,                    -- e-mail de la personne qui a autorisé
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (workspace_id, integration_id)
);
create unique index if not exists uq_studio_nango_connexion on public.studio_nango_connexions(connection_id, integration_id);
drop trigger if exists trg_studio_nango_updated on public.studio_nango_connexions;
create trigger trg_studio_nango_updated before update on public.studio_nango_connexions
  for each row execute function public.set_updated_at();
alter table public.studio_nango_connexions enable row level security;
drop policy if exists studio_nango_manager_lecture on public.studio_nango_connexions;
create policy studio_nango_manager_lecture on public.studio_nango_connexions for select to authenticated
  using (public.is_manager());

create table if not exists public.studio_connexion_invitations (
  id             uuid primary key default gen_random_uuid(),
  token_hash     text not null unique,
  workspace_id   uuid not null references public.studio_workspaces(id) on delete cascade,
  integration_id text,                    -- null = toutes les intégrations proposées
  email          text,
  cree_par       text,                    -- « crm:<profil> » ou « studio:<utilisateur> »
  expires_at     timestamptz not null,
  ouvert_at      timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_studio_invitations_ws on public.studio_connexion_invitations(workspace_id, created_at desc);
alter table public.studio_connexion_invitations enable row level security;
drop policy if exists studio_invitations_manager_lecture on public.studio_connexion_invitations;
create policy studio_invitations_manager_lecture on public.studio_connexion_invitations for select to authenticated
  using (public.is_manager());

notify pgrst, 'reload schema';
