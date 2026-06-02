/*
  # Pièces jointes des e-mails
  Ajoute une colonne attachments (JSON) sur la table emails.
*/
alter table public.emails
  add column if not exists attachments jsonb not null default '[]'::jsonb;
