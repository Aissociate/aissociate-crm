/*
  Studio IA — harness général configurable + connecteurs d'applications.

  1. studio_config : réglages globaux du Studio édités dans le CRM.
     - 'harness_regles'    : règles communes injectées dans TOUS les agents.
     - 'harness_perimetre' : règle de périmètre (spécialiste + relais), avec les
       variables {{metier}}, {{super_pouvoirs}}, {{collegues}}.
     Valeur vide ou absente = texte par défaut du code (supabase/functions/studio/contexte.ts).

  2. studio_connecteurs : connexions d'un espace aux applications externes
     (Gmail/Google Workspace, Outlook, SMTP sur mesure, Facebook, Instagram,
     LinkedIn, TikTok, serveur MCP). Les connexions OAuth sont enregistrées en
     « demande » et finalisées à la main par Aissociate ; les secrets (mot de
     passe SMTP, jeton MCP) sont chiffrés AES-GCM par l'Edge Function.
*/

create table if not exists public.studio_config (
  cle        text primary key,
  valeur     text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.studio_config enable row level security;
drop policy if exists studio_config_manager on public.studio_config;
create policy studio_config_manager on public.studio_config for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create table if not exists public.studio_connecteurs (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.studio_workspaces(id) on delete cascade,
  type           text not null check (type in ('google', 'outlook', 'smtp', 'facebook', 'instagram', 'linkedin', 'tiktok', 'mcp')),
  statut         text not null default 'demande' check (statut in ('demande', 'en_cours', 'connecte', 'erreur', 'desactive')),
  -- Informations non secrètes saisies par le client (adresse, page, hôte SMTP…).
  infos          jsonb not null default '{}'::jsonb,
  -- Secret chiffré (AES-GCM, clé dérivée côté Edge Function) : jamais renvoyé au navigateur.
  secret_chiffre text,
  notes_admin    text not null default '',
  demande_par    uuid references public.studio_users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (workspace_id, type)
);
create index if not exists idx_studio_connecteurs_ws on public.studio_connecteurs(workspace_id);
drop trigger if exists trg_studio_connecteurs_updated on public.studio_connecteurs;
create trigger trg_studio_connecteurs_updated before update on public.studio_connecteurs
  for each row execute function public.set_updated_at();
alter table public.studio_connecteurs enable row level security;
drop policy if exists studio_connecteurs_manager on public.studio_connecteurs;
create policy studio_connecteurs_manager on public.studio_connecteurs for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- 3. Portraits des agents (générés avec Nano Banana, servis par le site : public/agents-ia/studio).
-- Vide = pastille avec l'initiale. Modifiable dans CRM › Studio IA clients › Catalogue d'agents.
alter table public.studio_agents add column if not exists photo text;
update public.studio_agents set photo = '/agents-ia/studio/' || id || '.webp'
where id in ('lea', 'hugo', 'sam', 'ines', 'mael', 'nora') and photo is null;

-- 4. Démo publique « Sam, agent commercial d'Aissociate » (Edge Function studio-demo).
-- Journal minimal des appels, pour limiter la consommation par visiteur
-- (IP hachée, jamais stockée en clair). Service role uniquement.
create table if not exists public.studio_demo_appels (
  id           bigserial primary key,
  ip_hash      text not null,
  conversation text not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_studio_demo_appels on public.studio_demo_appels(ip_hash, created_at desc);
alter table public.studio_demo_appels enable row level security;

notify pgrst, 'reload schema';
