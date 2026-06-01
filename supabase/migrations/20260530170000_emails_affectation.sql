/*
  # 22 — Affectation des e-mails (règle métier messagerie)

  Règle : un e-mail est rattaché à un contact (apprenant/prospect) et visible
  par le conseiller affecté ; la direction (admin/directeur_commercial) voit
  tout. Un e-mail non rattaché (owner_id null) n'est donc visible que par la
  direction — ce qui réalise « affecter à la direction » par défaut.

  Correctif : la policy `emails_select_inbound` rendait TOUS les e-mails
  entrants visibles à tous les utilisateurs. On la supprime : les entrants
  suivent désormais la règle owner/manager (policy `emails_select`).
*/

drop policy if exists emails_select_inbound on public.emails;

-- (rappel) emails_select : is_manager() OR owner_id = auth.uid()  -> direction voit tout,
-- conseiller voit ses e-mails affectés. emails_write : idem.

create index if not exists idx_emails_owner on public.emails(owner_id);
create index if not exists idx_emails_contact on public.emails(contact_id);
create index if not exists idx_emails_expediteur on public.emails(expediteur);
