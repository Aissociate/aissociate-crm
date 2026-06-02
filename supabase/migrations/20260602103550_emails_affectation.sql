/*
  # 22 — Affectation des e-mails
*/
drop policy if exists emails_select_inbound on public.emails;
create index if not exists idx_emails_owner on public.emails(owner_id);
create index if not exists idx_emails_contact on public.emails(contact_id);
create index if not exists idx_emails_expediteur on public.emails(expediteur);
