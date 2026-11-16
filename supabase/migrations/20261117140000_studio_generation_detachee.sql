-- Studio IA — une réponse d'agent continue même si l'utilisateur quitte la page.
-- generation_depuis : réponse en cours de rédaction (affichée « rédige… » au retour).
-- arret_demande     : bouton « Arrêter » (seul moyen d'interrompre une réponse).
alter table public.studio_conversations
  add column if not exists generation_depuis timestamptz,
  add column if not exists arret_demande timestamptz;

notify pgrst, 'reload schema';

-- Livrables modifiables : 20 dernières versions conservées.
alter table public.studio_livrables add column if not exists versions jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
