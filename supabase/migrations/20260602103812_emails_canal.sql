/*
  # Canal de communication (email / whatsapp)
  Ajoute colonne canal + index sur la table emails.
*/
alter table public.emails
  add column if not exists canal text not null default 'email';

create index if not exists idx_emails_canal on public.emails(canal);
