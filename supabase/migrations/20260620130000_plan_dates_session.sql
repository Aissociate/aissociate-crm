/*
  # Dates de session sur les plans de formation (ticket Benjamin)

  Champ libre `dates_session` (ex. « Les 4 et 5 août 2026 ») affiché sur le PDF
  du plan généré. Non destructif, idempotent.
*/

alter table public.plans_formation
  add column if not exists dates_session text;

notify pgrst, 'reload schema';
