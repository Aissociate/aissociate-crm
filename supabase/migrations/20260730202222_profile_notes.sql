-- Ticket Benjamin « ajout champ notes dans conseiller » :
-- champ libre d'informations diverses sur chaque conseiller (profil RH).
alter table public.profiles add column if not exists notes text;

comment on column public.profiles.notes is
  'Notes libres de la direction sur le conseiller (informations diverses).';
