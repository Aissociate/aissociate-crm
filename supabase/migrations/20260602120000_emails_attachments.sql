/*
  # Pièces jointes des e-mails

  Stocke, sur chaque e-mail, la liste des pièces jointes envoyées (issues de
  l'espace documentaire) afin de pouvoir les revoir dans le fil après coup.
  Format : tableau JSON d'objets { "filename": "...", "url": "..." }.
*/

alter table public.emails
  add column if not exists attachments jsonb not null default '[]'::jsonb;
