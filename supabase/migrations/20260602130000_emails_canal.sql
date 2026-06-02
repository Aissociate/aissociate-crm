/*
  # Canal de communication (e-mail / WhatsApp)

  La messagerie devient multi-canal : chaque message porte un `canal`.
    - 'email'    : e-mail SMTP/IMAP (défaut, comportement existant)
    - 'whatsapp' : message WhatsApp (envoi via lien wa.me, journalisé ici)

  Les conversations sont regroupées par interlocuteur côté application ; le
  canal permet de mêler e-mails et WhatsApp dans un même fil.
*/

alter table public.emails
  add column if not exists canal text not null default 'email';

create index if not exists idx_emails_canal on public.emails(canal);
