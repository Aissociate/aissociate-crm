/*
  # Messagerie partagée — visibilité des e-mails rattachés

  Règle retenue : tout e-mail RATTACHÉ (à un contact), ENVOYÉ (sortant) ou
  provenant d'un INTERLOCUTEUR CONNU est visible par TOUS les utilisateurs
  authentifiés. Seuls les ORPHELINS restent réservés à l'admin.
*/
drop policy if exists emails_select on public.emails;
create policy emails_select on public.emails for select to authenticated
using (
  is_admin()
  or owner_id = auth.uid()
  or contact_id is not null
  or direction = 'sortant'
  or public.email_sender_matched(expediteur)
);
