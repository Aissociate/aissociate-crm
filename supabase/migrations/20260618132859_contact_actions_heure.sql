/*
  # Heure des actions de suivi (ticket Benjamin « heures dans suivi des actions »)

  Ajoute une colonne `heure_action` (time, nullable) à public.contact_actions
  pour horodater finement les actions et permettre un tri chronologique
  (date_action + heure_action). Non destructif, idempotent.
*/

alter table public.contact_actions
  add column if not exists heure_action time;

notify pgrst, 'reload schema';
