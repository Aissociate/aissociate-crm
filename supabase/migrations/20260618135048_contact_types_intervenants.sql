/*
  # Types de contacts élargis aux intervenants (ticket Benjamin)

  Ajoute « formateur » (chargé de formation) et « encadrement » (personnel
  d'encadrement) à l'enum public.contact_type, afin que chaque intervenant
  puisse disposer d'une fiche contact centralisant ses coordonnées. Idempotent.
*/

alter type public.contact_type add value if not exists 'formateur';
alter type public.contact_type add value if not exists 'encadrement';

notify pgrst, 'reload schema';
