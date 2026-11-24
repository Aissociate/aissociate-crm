-- Studio IA : grille « contrat de travail » (supabase/functions/studio/contrats.ts).
-- Stage gratuit / Temps partiel / Temps plein / Équipe complète + avenants, CDD mensuel ou CDI annuel.
-- Les droits du contrat sont appliqués à l'espace (quota d'heures, badges, responsables, casier).
-- Le Stage remplace l'essai gratuit de 7 jours : les espaces encore en essai (ou essai terminé
-- sans abonnement) passent en Stage. Les abonnés de l'ancienne grille (par agent) ne changent pas.

alter table public.studio_workspaces
  add column if not exists contrat text check (contrat in ('stage', 'partiel', 'plein', 'equipe')),
  add column if not exists contrat_choix jsonb,
  -- Badges d'accès (connecteurs actifs) et casier (Go de fichiers déposés) ; null = sans limite.
  add column if not exists connecteurs_max int,
  add column if not exists stockage_go int,
  add column if not exists astreinte boolean not null default false;

-- Essais en cours ou terminés sans abonnement payé → Stage gratuit (10 h = 200 demandes, aucun badge,
-- 1 responsable, casier de 1 Go). Les connecteurs déjà branchés restent ; aucun nouveau n'est accepté.
update public.studio_workspaces
set contrat = 'stage',
    contrat_choix = '{"contrat":"stage","cdi":false,"heures":0,"badges":0,"responsables":0,"archives":0,"expert":false,"astreinte":false}'::jsonb,
    offre = 'essentiel', essai_fin = null,
    quota_messages_mois = 200, connecteurs_max = 0, max_utilisateurs = 1, stockage_go = 1
where offre = 'essai'
  and coalesce(abonnement_statut, '') not in ('active', 'trialing', 'past_due');
