-- Studio IA — raison de refus d'un livrable (refonte, lot 1, §4.2).
-- Obligatoire au refus (un clic), contrôlée par supabase/functions/studio/livrables.ts,
-- puis rendue à l'agent dans son contexte (contexte.ts › blocRefus) pour qu'il en tienne compte.
-- Le commentaire libre (colonne existante) reste facultatif.

alter table public.studio_livrables add column if not exists refus_raison text;
alter table public.studio_livrables drop constraint if exists studio_livrables_refus_raison_check;
alter table public.studio_livrables add constraint studio_livrables_refus_raison_check
  check (refus_raison is null or refus_raison in ('trop_long', 'mauvais_ton', 'pas_le_moment', 'autre'));

-- Lecture des derniers refus d'un agent à chaque mission.
create index if not exists idx_studio_livrables_refus on public.studio_livrables(workspace_id, agent_id, decide_le desc)
  where statut = 'refuse';
