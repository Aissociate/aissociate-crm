/*
  # Messagerie partagée — visibilité des e-mails rattachés

  Problème : les e-mails importés (et tout e-mail non affecté à un conseiller,
  owner_id null) n'étaient visibles que par l'admin/la direction. Les conseillers
  ne voyaient donc « nulle part » les conversations importées.

  Règle retenue : tout e-mail RATTACHÉ (à un contact), ENVOYÉ (sortant) ou
  provenant d'un INTERLOCUTEUR CONNU (contact/formateur/candidat) est visible par
  TOUS les utilisateurs authentifiés. Seuls les ORPHELINS (entrant d'un inconnu,
  non affecté) restent réservés à l'admin (règle métier conservée).

  Note : la policy d'écriture (emails_write) reste inchangée — l'édition/suppression
  demeure réservée au propriétaire, à la direction et à l'admin.
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
