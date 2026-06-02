/*
  # Import des RETOURS (réponses entrantes) — app AGEFICE -> A(I)ssociate
  3 e-mails reçus en réponse aux envois de prospection « Formation IA ».
  Rattachés à leur contact (par e-mail), canal = email, date d'origine conservée.
  Idempotent : dédup par message_id ('agefice:'+id). Contenu nettoyé en texte
  (décodage quoted-printable, parties MIME et historique cité retirés).
  Source : D:/Projets/agefice-app/prisma/dev.db (messages_email, direction=entrant).
*/

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Amavassy', 'Dany', 'damavassy@trame.re', 'Importé depuis l''app AGEFICE (réponse prospection)'
where not exists (select 1 from public.contacts where lower(email) = 'damavassy@trame.re');
insert into public.emails (direction, statut, canal, lu, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'entrant', 'recu', 'email', true, 'damavassy@trame.re', array['contact@aissociate.re'], 'Relance pièces formation', 'Bonjour, merci pour votre message. Je vous fais parvenir les documents demandés cette semaine. Cordialement, Dany', '2026-04-22T09:38:55.674Z', '2026-04-22T09:38:55.674Z',
  (select id from public.contacts where lower(email) = 'damavassy@trame.re' order by created_at limit 1),
  (select coalesce(responsable_id, owner_id) from public.contacts where lower(email) = 'damavassy@trame.re' order by created_at limit 1),
  'agefice:cmo9v1u7u0003d8v6u53w84i5'
where not exists (select 1 from public.emails where message_id = 'agefice:cmo9v1u7u0003d8v6u53w84i5');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'meralli ballou', 'shanti', 'meralli.ballou.s@gmail.com', 'Importé depuis l''app AGEFICE (réponse prospection)'
where not exists (select 1 from public.contacts where lower(email) = 'meralli.ballou.s@gmail.com');
insert into public.emails (direction, statut, canal, lu, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'entrant', 'recu', 'email', true, 'meralli.ballou.s@gmail.com', array['contact@aissociate.re'], 'Re: Sans objet', 'non merci', '2026-04-22T11:22:03.617Z', '2026-04-22T11:22:03.617Z',
  (select id from public.contacts where lower(email) = 'meralli.ballou.s@gmail.com' order by created_at limit 1),
  (select coalesce(responsable_id, owner_id) from public.contacts where lower(email) = 'meralli.ballou.s@gmail.com' order by created_at limit 1),
  'agefice:cmo9yqgv50006cwv6ve2zs3wb'
where not exists (select 1 from public.emails where message_id = 'agefice:cmo9yqgv50006cwv6ve2zs3wb');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Lorion', 'David', 'dlorion@buffi.re', 'Importé depuis l''app AGEFICE (réponse prospection)'
where not exists (select 1 from public.contacts where lower(email) = 'dlorion@buffi.re');
insert into public.emails (direction, statut, canal, lu, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'entrant', 'recu', 'email', true, 'dlorion@buffi.re', array['contact@aissociate.re'], 'RE: Formation IA', 'Bonjour,

Nous serons 4 participants

Je vous confirme que nous pouvons accueillir la formation chez nous en interne nous avons une salle de dispo.

Je vous confirme fin mai pour une programmation.

LORION David

Managing director

[Image]

Société d’Aménagement et Travaux Publics

Portable :            (+)262 - (0)692 43 02 06

Standard :            (+)262 - (0)262 43 02 02

Fax :                    (+)262 - (0)262 43 02 12

Adresse Physique :         7, Avenue du GRAND PITON - ZA CAMBAIE - 97460 SAINT PAUL

Adresse Postale :            Sarl BUFFI – SATP -  CS 21012 -  97864 SAINT PAUL CEDEX

P  Adoptez l''éco attitude Afin de contribuer au respect de l''environnement, n''imprimez ce mail que si c''est vraiment nécessaire', '2026-04-22T16:30:16.439Z', '2026-04-22T16:30:16.439Z',
  (select id from public.contacts where lower(email) = 'dlorion@buffi.re' order by created_at limit 1),
  (select coalesce(responsable_id, owner_id) from public.contacts where lower(email) = 'dlorion@buffi.re' order by created_at limit 1),
  'agefice:cmoa9qu0n003ebov6m5m5cnuq'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa9qu0n003ebov6m5m5cnuq');

