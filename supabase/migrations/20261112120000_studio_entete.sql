/*
  Studio IA — papier à en-tête par client, utilisé pour les exports Word et PDF.

  - entete : coordonnées affichées en tête et en pied des documents
    {raison_sociale, adresse, code_postal, ville, telephone, email, site, siret, mentions}
  - logo_chemin : logo dans le bucket privé studio-medias (<workspace>/logo.<ext>),
    téléversé par le propriétaire depuis « Mon entreprise » via l'Edge Function.
*/
alter table public.studio_workspaces add column if not exists entete jsonb not null default '{}'::jsonb;
alter table public.studio_workspaces add column if not exists logo_chemin text;

notify pgrst, 'reload schema';
