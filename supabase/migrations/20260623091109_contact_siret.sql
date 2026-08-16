/*
  # SIRET du contact (client) — ticket Benjamin

  Les devis et plans de formation individuels sont émis pour un contact
  (souvent micro-entrepreneur) sans entreprise liée. On ajoute un champ
  `siret` au contact pour pouvoir l'afficher sur le devis et le plan.
  Non destructif, idempotent.
*/

alter table public.contacts
  add column if not exists siret text;

notify pgrst, 'reload schema';
