/*
  # Import des e-mails de prospection AGEFICE -> A(I)ssociate (sortants)
*/
insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Amavassy', 'Dany', 'damavassy@trame.re', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'damavassy@trame.re');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['damavassy@trame.re'], 'Relance pièces formation', 'Bonjour Dany, nous vous remercions de votre inscription à la formation IA.', '2026-04-22T09:49:50.108Z', '2026-04-22T09:49:50.108Z',
  (select id from public.contacts where lower(email) = 'damavassy@trame.re' order by created_at limit 1), null, 'agefice:cmo9urdm30002d8v679wqz9uv'
where not exists (select 1 from public.emails where message_id = 'agefice:cmo9urdm30002d8v679wqz9uv');
