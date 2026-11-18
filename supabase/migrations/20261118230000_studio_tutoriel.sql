-- Studio IA — guide de prise en main (src/studio/Tutoriel.tsx) : affiché tout seul à la première
-- connexion, puis seulement à la demande (« Revoir le guide » en bas de la colonne de gauche).
-- Vide = jamais vu. Tant que la colonne n'existe pas, le Studio retient l'information dans le navigateur.
alter table public.studio_users add column if not exists tutoriel_vu_le timestamptz;

notify pgrst, 'reload schema';
