/*
  Studio IA — gouvernance (reprise du paquet « plateforme multi-tenant », vague 1).

  1. studio_onboarding      demandes issues du questionnaire public (sections A–H,
                            score de maturité /100, drapeaux RGPD) → CRM → création
                            d'espace en un clic (« provisionnement »).
  2. studio_workspaces      + suspendu (kill switch SUSPENDRE / REPRENDRE)
                            + budget_ia_jour_eur (plafond de dépense : arrêt, pas alerte)
  3. studio_journal         journal d'audit par espace, chaîné par SHA-256
                            (chaque ligne porte le hachage de la précédente).
  4. studio_livrables       livrables soumis à validation : a_valider → valide /
                            refuse → publie. Seul le propriétaire de l'espace valide.

  Cloisonnement : toutes ces tables sont écrites par le service role (Edge Function
  `studio`), filtrées par workspace_id de la session ; lecture réservée aux managers.
*/

-- 1. Demandes d'onboarding ----------------------------------------------------
create table if not exists public.studio_onboarding (
  id            uuid primary key default gen_random_uuid(),
  statut        text not null default 'nouvelle' check (statut in ('nouvelle', 'en_revue', 'provisionnee', 'refusee')),
  entreprise    text not null,
  contact_nom   text,
  email         text not null,
  telephone     text,
  agents        text[] not null default '{}',      -- agents souhaités (catalogue studio_agents)
  reponses      jsonb not null default '{}'::jsonb,
  score         integer not null default 0,        -- maturité /100
  lecture       text,                              -- « diagnostic » | « pilote » | « démarrage »
  drapeaux      text[] not null default '{}',      -- donnees_sensibles, mineurs, hors_ue…
  workspace_id  uuid references public.studio_workspaces(id) on delete set null,
  notes_crm     text not null default '',
  traite_par    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_studio_onboarding_statut on public.studio_onboarding(statut, created_at desc);
create index if not exists idx_studio_onboarding_email on public.studio_onboarding(lower(email), created_at desc);
drop trigger if exists trg_studio_onboarding_updated on public.studio_onboarding;
create trigger trg_studio_onboarding_updated before update on public.studio_onboarding
  for each row execute function public.set_updated_at();
alter table public.studio_onboarding enable row level security;
drop policy if exists studio_onboarding_manager on public.studio_onboarding;
create policy studio_onboarding_manager on public.studio_onboarding for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- 2. Suspension et plafond de dépense ----------------------------------------
alter table public.studio_workspaces add column if not exists suspendu boolean not null default false;
alter table public.studio_workspaces add column if not exists suspendu_le timestamptz;
alter table public.studio_workspaces add column if not exists suspendu_par text;
alter table public.studio_workspaces add column if not exists budget_ia_jour_eur numeric;  -- null = sans plafond

-- 3. Journal d'audit chaîné --------------------------------------------------
create table if not exists public.studio_journal (
  id              bigserial primary key,
  workspace_id    uuid not null references public.studio_workspaces(id) on delete cascade,
  acteur          text not null,                 -- « client:<email> », « crm », « agent:<id> », « systeme »
  agent_id        text,
  action          text not null,                 -- mission, livrable_valide, suspension, connexion…
  detail          jsonb not null default '{}'::jsonb,
  hash_precedent  text,
  hash            text not null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_studio_journal_ws on public.studio_journal(workspace_id, id desc);
alter table public.studio_journal enable row level security;
drop policy if exists studio_journal_manager on public.studio_journal;
create policy studio_journal_manager on public.studio_journal for select to authenticated using (public.is_manager());
-- Append-only : aucune politique d'écriture ; même le service role ne doit qu'insérer.
revoke update, delete on public.studio_journal from authenticated, anon;

-- 4. Livrables à valider -----------------------------------------------------
create table if not exists public.studio_livrables (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.studio_workspaces(id) on delete cascade,
  message_id      uuid references public.studio_messages(id) on delete set null,
  conversation_id uuid references public.studio_conversations(id) on delete set null,
  agent_id        text references public.studio_agents(id) on delete set null,
  titre           text not null,
  contenu         text not null,
  statut          text not null default 'a_valider' check (statut in ('a_valider', 'valide', 'refuse', 'publie')),
  soumis_par      text,
  decide_par      text,
  decide_le       timestamptz,
  commentaire     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (message_id)
);
create index if not exists idx_studio_livrables_ws on public.studio_livrables(workspace_id, statut, created_at desc);
drop trigger if exists trg_studio_livrables_updated on public.studio_livrables;
create trigger trg_studio_livrables_updated before update on public.studio_livrables
  for each row execute function public.set_updated_at();
alter table public.studio_livrables enable row level security;
drop policy if exists studio_livrables_manager on public.studio_livrables;
create policy studio_livrables_manager on public.studio_livrables for select to authenticated using (public.is_manager());

-- 5. Réglages par défaut (CRM › Studio IA › Paramètres) ----------------------
insert into public.studio_config (cle, valeur) values
  ('defaut_budget_ia_jour_eur', '5'),
  ('defaut_quota_messages_mois', '300'),
  ('defaut_quota_images_mois', '30'),
  ('defaut_quota_videos_mois', '5'),
  ('onboarding_ouvert', 'true')
on conflict (cle) do nothing;

notify pgrst, 'reload schema';
