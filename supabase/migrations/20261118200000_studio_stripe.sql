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
