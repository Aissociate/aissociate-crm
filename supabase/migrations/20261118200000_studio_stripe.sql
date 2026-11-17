-- Studio IA : paiement en ligne par Stripe (recharges et abonnement mensuel).
-- Le client Stripe et l'abonnement de chaque espace, et la référence Stripe d'une recharge
-- payée (unique : un webhook rejoué ne crédite jamais deux fois).

alter table public.studio_workspaces
  add column if not exists stripe_client text,
  add column if not exists stripe_abonnement text,
  add column if not exists abonnement_statut text,
  add column if not exists abonnement_fin timestamptz,
  add column if not exists abonnement_agents int,
  add column if not exists abonnement_connecteurs int;

alter table public.studio_recharges
  add column if not exists stripe_ref text;

create unique index if not exists studio_recharges_stripe_ref
  on public.studio_recharges (stripe_ref) where stripe_ref is not null;

-- ── Essai gratuit de 7 jours (créé automatiquement à la fin du questionnaire) ──
alter table public.studio_workspaces drop constraint if exists studio_workspaces_offre_check;
alter table public.studio_workspaces add constraint studio_workspaces_offre_check
  check (offre = any (array['essai', 'essentiel', 'pro', 'sur_mesure']));
alter table public.studio_workspaces add column if not exists essai_fin timestamptz;

alter table public.studio_onboarding add column if not exists identifiants_envoyes_le timestamptz;

-- ── Acceptation des CGV et de l'accord RGPD à la première connexion ──
-- La version est l'empreinte des documents : s'ils changent, chacun les accepte de nouveau.
alter table public.studio_users
  add column if not exists cgv_version text,
  add column if not exists cgv_acceptees_le timestamptz,
  add column if not exists cgv_preuve jsonb;

insert into public.studio_config (cle, valeur) values
  ('essai_auto', 'true'),
  ('essai_jours', '7'),
  -- Livrables publiés de l'espace Aissociate : CGV « Agents virtuels IA » puis annexe RGPD (DPA).
  ('cgv_livrables', '904c6754-db21-4d65-80c0-8a62a187d140,246394c1-79de-4efb-8399-d069bfbcfe5e')
on conflict (cle) do nothing;
