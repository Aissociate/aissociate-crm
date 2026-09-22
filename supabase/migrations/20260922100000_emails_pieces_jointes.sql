/*
  # Pièces jointes des e-mails reçus

  La relève IMAP (Edge Function `fetch-emails`) n'enregistrait que le texte des
  messages : les pièces jointes reçues étaient perdues. Elles sont désormais
  déposées dans le bucket privé `emails` (chemin `entrants/<id du mail>/…`) et
  référencées dans `emails.attachments` sous la forme
  { filename, url: <chemin>, bucket: 'emails', taille, type }.
  L'URL de téléchargement est signée à l'ouverture, côté CRM.

  Écriture réservée au service (la relève) ; lecture pour les utilisateurs
  connectés, qui en ont besoin pour signer l'URL ou copier la pièce vers le
  coffre-fort d'un contact.
*/

insert into storage.buckets (id, name, public)
values ('emails', 'emails', false)
on conflict (id) do nothing;

drop policy if exists emails_storage_select on storage.objects;
create policy emails_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'emails');
