/*
  # Nouveau type de contact : « contact »

  Ajoute la valeur `contact` à l'enum public.contact_type (à côté de prospect,
  apprenant, contact_entreprise, contact_financeur). Idempotent.
*/

alter type public.contact_type add value if not exists 'contact';

notify pgrst, 'reload schema';
