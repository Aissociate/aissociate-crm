-- Studio IA : recharges de crédits au-delà des quotas mensuels.
-- Registre des mouvements (achat, offert, correction, consommation) : le solde est la somme
-- des crédits, il ne s'efface jamais et se reporte donc de mois en mois.
-- On ne puise dans le solde qu'une fois le quota mensuel atteint (missions, visuels, vidéos).

create table if not exists public.studio_recharges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.studio_workspaces(id) on delete cascade,
  nature text not null check (nature in ('achat', 'offert', 'correction', 'consommation')),
  credits integer not null,                 -- positif : ajout ; négatif : consommation
  ressource text check (ressource in ('demande', 'image', 'video')),
  media_id uuid,                            -- consommation d'un visuel/vidéo : recréditée en cas d'échec
  prix_ht numeric(10,2),                    -- achat : montant à facturer
  acteur text,                              -- client:email, crm:email
  note text,
  created_at timestamptz not null default now()
);
create index if not exists studio_recharges_ws on public.studio_recharges (workspace_id, created_at desc);
create index if not exists studio_recharges_media on public.studio_recharges (media_id) where media_id is not null;

alter table public.studio_recharges enable row level security;
drop policy if exists studio_recharges_manager on public.studio_recharges;
create policy studio_recharges_manager on public.studio_recharges for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- Solde par espace (CRM).
create or replace view public.studio_recharges_solde with (security_invoker = true) as
  select workspace_id, coalesce(sum(credits), 0)::integer as solde
  from public.studio_recharges group by workspace_id;

-- Réglages propres à un client : packs (null = ceux des Paramètres) et achat en libre-service.
alter table public.studio_workspaces add column if not exists recharge_packs jsonb;
alter table public.studio_workspaces add column if not exists recharge_achat_libre boolean not null default true;

insert into public.studio_config (cle, valeur) values
  ('recharge_petit_prix_ht', '10'), ('recharge_petit_credits', '100'),
  ('recharge_grand_prix_ht', '30'), ('recharge_grand_credits', '350'),
  ('recharge_cout_demande', '1'), ('recharge_cout_image', '5'), ('recharge_cout_video', '30')
on conflict (cle) do nothing;

-- Une demande = un message envoyé à un agent. Une demande relayée à un collègue (l'agent
-- refuse et désigne le bon agent) ne compte pas : elle est marquée hors quota.
alter table public.studio_messages add column if not exists hors_quota boolean not null default false;

create or replace view public.studio_usage_mois with (security_invoker = true) as
  select workspace_id,
         count(*) filter (where role = 'user' and not hors_quota) as demandes,
         count(*) filter (where role = 'assistant')               as reponses,
         max(created_at)                                          as derniere_activite
  from public.studio_messages
  where created_at >= date_trunc('month', now())
  group by workspace_id;
