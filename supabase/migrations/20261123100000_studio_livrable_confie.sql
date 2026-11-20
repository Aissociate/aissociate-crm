-- Studio IA — trace « mission confiée par » sur les livrables (refonte, lot 2, §3.1).
-- Quand Léa confie une mission à un spécialiste, ce que celui-ci propose (e-mail,
-- publication, document) porte l'identifiant de l'agent qui a confié la mission.
-- L'écran « Aujourd'hui » l'affiche (« mission confiée par Léa ») : seulement ce qui
-- est vrai, la relecture elle-même n'étant pas tracée.
-- Écrit par supabase/functions/studio/outils.ts (creerLivrable) ; les livrables
-- existants restent sans trace.

alter table public.studio_livrables add column if not exists confie_par text
  references public.studio_agents(id) on delete set null;
