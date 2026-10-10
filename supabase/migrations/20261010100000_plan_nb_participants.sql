-- Effectif saisi à la main sur le plan de formation (« pax ») : il prime sur
-- le décompte des stagiaires nommés, qui ne sont pas toujours tous connus.
alter table public.plans_formation
  add column if not exists nb_participants integer check (nb_participants is null or nb_participants > 0);
