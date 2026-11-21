-- Abonnement annuel du Studio (12 mois pour le prix de 10, payés d'avance).
-- studio_workspaces.abonnement_annuel : montant HT de l'année en cours chez Stripe ;
-- vide = abonnement mensuel. abonnement_mensuel garde l'équivalent par mois (Rentabilité).
alter table public.studio_workspaces
  add column if not exists abonnement_annuel numeric(10, 2);

comment on column public.studio_workspaces.abonnement_annuel is
  'Montant HT de l''abonnement annuel payé d''avance (Stripe) ; null = abonnement mensuel.';
