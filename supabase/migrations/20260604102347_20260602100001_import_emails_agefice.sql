/*
  # Import des e-mails de prospection AGEFICE -> AIssociate
  26 e-mails sortants Formation IA envoyes depuis contact@aissociate.re.
  Chaque destinataire (prospect) est cree comme contact (type prospect) s'il
  n'existe pas, puis l'e-mail y est rattache. owner_id = null => visible Direction.
  Idempotent : dedup contacts par email, e-mails par message_id.
*/

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Amavassy', 'Dany', 'damavassy@trame.re', 'Importe depuis app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'damavassy@trame.re');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['damavassy@trame.re'], 'Relance pieces formation', 'Bonjour Dany, nous vous remercions de votre inscription a la formation.', '2026-04-22T09:49:50.108Z', '2026-04-22T09:49:50.108Z',
  (select id from public.contacts where lower(email) = 'damavassy@trame.re' order by created_at limit 1), null, 'agefice:cmo9urdm30002d8v679wqz9uv'
where not exists (select 1 from public.emails where message_id = 'agefice:cmo9urdm30002d8v679wqz9uv');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'meralli ballou', 'shanti', 'meralli.ballou.s@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'meralli.ballou.s@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['meralli.ballou.s@gmail.com'], 'Sans objet', 'Bonjour shanti, nous vous remercions de votre interet pour Aissociate.', '2026-04-22T11:21:03.380Z', '2026-04-22T11:21:03.380Z',
  (select id from public.contacts where lower(email) = 'meralli.ballou.s@gmail.com' order by created_at limit 1), null, 'agefice:cmo9yp6eb0005cwv6uxtdqvsb'
where not exists (select 1 from public.emails where message_id = 'agefice:cmo9yp6eb0005cwv6uxtdqvsb');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Ichane', 'Carole', 'lejaguar.direction@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'lejaguar.direction@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['lejaguar.direction@gmail.com'], 'Relance Documents formation IA', 'Bonjour Carole, nous vous contactons concernant votre dossier de formation.', '2026-04-22T12:05:37.191Z', '2026-04-22T12:05:37.191Z',
  (select id from public.contacts where lower(email) = 'lejaguar.direction@gmail.com' order by created_at limit 1), null, 'agefice:cmoa0ahik000kcwv6dneqkuzo'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa0ahik000kcwv6dneqkuzo');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Bouillet', 'Alexis', 'pv@sunplex.fr', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'pv@sunplex.fr');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['pv@sunplex.fr'], 'formation IA', 'Bonjour Alexis, nous vous remercions de votre interet pour nos formations.', '2026-04-22T14:10:44.278Z', '2026-04-22T14:10:44.278Z',
  (select id from public.contacts where lower(email) = 'pv@sunplex.fr' order by created_at limit 1), null, 'agefice:cmoa4re100006bov67wfoqc15'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa4re100006bov67wfoqc15');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Petiaye', 'Johnny', 'johnny@petiaye.run', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'johnny@petiaye.run');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['johnny@petiaye.run'], 'Formation IA', 'Bonjour Johnny, nous vous remercions de votre interet pour nos formations.', '2026-04-22T14:14:25.238Z', '2026-04-22T14:14:25.238Z',
  (select id from public.contacts where lower(email) = 'johnny@petiaye.run' order by created_at limit 1), null, 'agefice:cmoa4w4ih000bbov634szatez'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa4w4ih000bbov634szatez');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Hoareau', 'Philippe', 'hoareau.philippe@wanadoo.fr', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'hoareau.philippe@wanadoo.fr');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['hoareau.philippe@wanadoo.fr'], 'Formation IA', 'Bonjour Philippe, suite a notre echange, je vous contacte pour vous proposer une offre de formation.', '2026-04-22T14:19:45.542Z', '2026-04-22T14:19:45.542Z',
  (select id from public.contacts where lower(email) = 'hoareau.philippe@wanadoo.fr' order by created_at limit 1), null, 'agefice:cmoa52znv000gbov6y6b5a0lf'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa52znv000gbov6y6b5a0lf');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Samourgompouelle', 'Genevieve', 'sittirani@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'sittirani@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['sittirani@gmail.com'], 'Formation IA', 'Bonjour Genevieve, nous vous remercions de votre interet pour nos formations.', '2026-04-22T14:22:39.434Z', '2026-04-22T14:22:39.434Z',
  (select id from public.contacts where lower(email) = 'sittirani@gmail.com' order by created_at limit 1), null, 'agefice:cmoa56pu5000kbov6woz9v09k'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa56pu5000kbov6woz9v09k');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Boutry', 'Charlotte', 'charlotte.boutry@groupegesco.fr', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'charlotte.boutry@groupegesco.fr');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['charlotte.boutry@groupegesco.fr'], 'Formation IA', 'Bonjour Charlotte, merci de votre interet pour nos formations.', '2026-04-22T14:27:20.467Z', '2026-04-22T14:27:20.467Z',
  (select id from public.contacts where lower(email) = 'charlotte.boutry@groupegesco.fr' order by created_at limit 1), null, 'agefice:cmoa5cqom000obov6vwvlm0pm'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa5cqom000obov6vwvlm0pm');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Lorion', 'David', 'dlorion@buffi.re', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'dlorion@buffi.re');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['dlorion@buffi.re'], 'Formation IA', 'Bonjour David, nous vous remercions de vos precisions.', '2026-04-22T14:30:30.111Z', '2026-04-22T14:30:30.111Z',
  (select id from public.contacts where lower(email) = 'dlorion@buffi.re' order by created_at limit 1), null, 'agefice:cmoa5gt0i000ubov6e8l65v6r'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa5gt0i000ubov6e8l65v6r');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'tam', 'thiam', 'thiamjudex@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'thiamjudex@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['thiamjudex@gmail.com'], 'Formation IA', 'Bonjour thiam, nous vous remercions de votre interet.', '2026-04-22T14:33:06.041Z', '2026-04-22T14:33:06.041Z',
  (select id from public.contacts where lower(email) = 'thiamjudex@gmail.com' order by created_at limit 1), null, 'agefice:cmoa5k5bw000ybov6e5vsxmmh'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa5k5bw000ybov6e5vsxmmh');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Chelmy', 'Didier', 'didierc.invest@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'didierc.invest@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['didierc.invest@gmail.com'], 'Formation IA', 'Bonjour Didier, nous vous remercions de votre interet pour nos formations.', '2026-04-22T14:36:24.134Z', '2026-04-22T14:36:24.134Z',
  (select id from public.contacts where lower(email) = 'didierc.invest@gmail.com' order by created_at limit 1), null, 'agefice:cmoa5oe6i0013bov6nytdcsu7'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa5oe6i0013bov6nytdcsu7');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Dumont', 'Bruno', 'bruno.dumont974@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'bruno.dumont974@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['bruno.dumont974@gmail.com'], 'Formation IA', 'Bonjour Bruno, nous vous remercions de votre interet.', '2026-04-22T14:38:03.945Z', '2026-04-22T14:38:03.945Z',
  (select id from public.contacts where lower(email) = 'bruno.dumont974@gmail.com' order by created_at limit 1), null, 'agefice:cmoa5qj710018bov6k4ba4ae2'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa5qj710018bov6k4ba4ae2');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Laroque', '-', 'sasastyl.concept@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'sasastyl.concept@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['sasastyl.concept@gmail.com'], 'Formation IA', 'Bonjour, merci de votre interet pour la formation.', '2026-04-23T18:01:35.675Z', '2026-04-23T18:01:35.675Z',
  (select id from public.contacts where lower(email) = 'sasastyl.concept@gmail.com' order by created_at limit 1), null, 'agefice:cmobsg4i0000o5ov6ok0bnpja'
where not exists (select 1 from public.emails where message_id = 'agefice:cmobsg4i0000o5ov6ok0bnpja');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Brigit', 'Raphael', 'raphaelmussard9@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'raphaelmussard9@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['raphaelmussard9@gmail.com'], 'Formation IA', 'Bonjour Raphael, merci de votre interet pour la formation.', '2026-04-23T18:46:38.913Z', '2026-04-23T18:46:38.913Z',
  (select id from public.contacts where lower(email) = 'raphaelmussard9@gmail.com' order by created_at limit 1), null, 'agefice:cmobu22bq000t5ov6aszdecsx'
where not exists (select 1 from public.emails where message_id = 'agefice:cmobu22bq000t5ov6aszdecsx');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Jean-baptiste Ep Ramsamy', 'Elodie', 'elodiejeanb@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'elodiejeanb@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['elodiejeanb@gmail.com'], 'Formation IA', 'Bonjour Elodie, merci de votre interet pour la formation.', '2026-04-23T19:00:37.702Z', '2026-04-23T19:00:37.702Z',
  (select id from public.contacts where lower(email) = 'elodiejeanb@gmail.com' order by created_at limit 1), null, 'agefice:cmobuk1jd000z5ov656zfeq5d'
where not exists (select 1 from public.emails where message_id = 'agefice:cmobuk1jd000z5ov656zfeq5d');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Michael', 'Rard', 'michael.rard@orange.fr', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'michael.rard@orange.fr');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['michael.rard@orange.fr'], 'Formation IA', 'Bonjour Michael, merci de votre interet pour la formation.', '2026-04-23T19:05:17.363Z', '2026-04-23T19:05:17.363Z',
  (select id from public.contacts where lower(email) = 'michael.rard@orange.fr' order by created_at limit 1), null, 'agefice:cmobuq1bq00145ov6eaaemsec'
where not exists (select 1 from public.emails where message_id = 'agefice:cmobuq1bq00145ov6eaaemsec');

insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['dlorion@buffi.re'], 'Formation IA', 'Bonjour David, nous vous remercions de vos precisions.', '2026-04-23T19:58:27.905Z', '2026-04-23T19:58:27.905Z',
  (select id from public.contacts where lower(email) = 'dlorion@buffi.re' order by created_at limit 1), null, 'agefice:cmobwmf5v0001jsv6kl3alu8o'
where not exists (select 1 from public.emails where message_id = 'agefice:cmobwmf5v0001jsv6kl3alu8o');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Cadet', 'Laurent', 'laurentgtc@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'laurentgtc@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['laurentgtc@gmail.com'], 'Formation IA', 'Bonjour Laurent, merci de votre interet.', '2026-04-28T21:01:59.359Z', '2026-04-28T21:01:59.359Z',
  (select id from public.contacts where lower(email) = 'laurentgtc@gmail.com' order by created_at limit 1), null, 'agefice:cmoj43dfo00078ov62tzpv5ve'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj43dfo00078ov62tzpv5ve');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'jacqueline', 'ariapoutri', 'image.future@hotmail.fr', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'image.future@hotmail.fr');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['image.future@hotmail.fr'], 'Formation IA', 'Bonjour Jacqueline, nous vous remercions de votre interet.', '2026-04-28T21:06:20.954Z', '2026-04-28T21:06:20.954Z',
  (select id from public.contacts where lower(email) = 'image.future@hotmail.fr' order by created_at limit 1), null, 'agefice:cmoj48za5000k8ov6ta4m0msx'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj48za5000k8ov6ta4m0msx');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Lakazeduc', '-', 'lakazeduc.974@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'lakazeduc.974@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['lakazeduc.974@gmail.com'], 'formation IA', 'Bonjour, nous vous confirmons que votre formation est validee.', '2026-04-28T21:31:48.550Z', '2026-04-28T21:31:48.550Z',
  (select id from public.contacts where lower(email) = 'lakazeduc.974@gmail.com' order by created_at limit 1), null, 'agefice:cmoj55pzg00198ov6vqlq1hdv'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj55pzg00198ov6vqlq1hdv');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Reynaud', 'Barbara', 'conseilreunion974@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'conseilreunion974@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['conseilreunion974@gmail.com'], 'Formation IA ', 'Bonjour Barbara, nous vous remercions de votre interet.', '2026-04-28T21:36:38.082Z', '2026-04-28T21:36:38.082Z',
  (select id from public.contacts where lower(email) = 'conseilreunion974@gmail.com' order by created_at limit 1), null, 'agefice:cmoj5bxdy001f8ov6p5ak3o0g'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj5bxdy001f8ov6p5ak3o0g');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Y', 'Philippe', 'ysf.phil@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'ysf.phil@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['Ysf.phil@gmail.com'], 'Formation IA', 'Bonjour Philippe, nous vous remercions de votre interet.', '2026-04-28T21:38:07.350Z', '2026-04-28T21:38:07.350Z',
  (select id from public.contacts where lower(email) = 'ysf.phil@gmail.com' order by created_at limit 1), null, 'agefice:cmoj5du9l001i8ov68k62shki'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj5du9l001i8ov68k62shki');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Nourdine', 'Chaadiat', 'nchaadiat@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'nchaadiat@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['nchaadiat@gmail.com'], 'Formation IA', 'Bonjour Chaadiat, merci de votre interet.', '2026-04-28T21:45:30.399Z', '2026-04-28T21:45:30.399Z',
  (select id from public.contacts where lower(email) = 'nchaadiat@gmail.com' order by created_at limit 1), null, 'agefice:cmoj5nc4i001p8ov60fyi7eok'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj5nc4i001p8ov60fyi7eok');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'David', 'Payet', 'neotechno.ingenierie@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'neotechno.ingenierie@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['neotechno.ingenierie@gmail.com'], 'Formation IA', 'Bonjour Payet, merci de votre interet pour la formation.', '2026-04-28T21:50:58.876Z', '2026-04-28T21:50:58.876Z',
  (select id from public.contacts where lower(email) = 'neotechno.ingenierie@gmail.com' order by created_at limit 1), null, 'agefice:cmoj5udkw001u8ov6ienuji70'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj5udkw001u8ov6ienuji70');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Baronne', 'Melvin', 'directionbrandingstudio@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'directionbrandingstudio@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['directionbrandingstudio@gmail.com'], 'Formation IA', 'Bonjour Melvin, merci de votre interet pour la formation.', '2026-04-28T21:53:48.469Z', '2026-04-28T21:53:48.469Z',
  (select id from public.contacts where lower(email) = 'directionbrandingstudio@gmail.com' order by created_at limit 1), null, 'agefice:cmoj5y0ft001z8ov6gm8j0e4z'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj5y0ft001z8ov6gm8j0e4z');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Edith', '-', 'edith.hoair@gmail.com', 'Importe depuis app AGEFICE'
where not exists (select 1 from public.contacts where lower(email) = 'edith.hoair@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['edith.hoair@gmail.com'], 'Formation IA', 'Bonjour Edith, merci de votre interet pour la formation.', '2026-04-28T22:04:14.427Z', '2026-04-28T22:04:14.427Z',
  (select id from public.contacts where lower(email) = 'edith.hoair@gmail.com' order by created_at limit 1), null, 'agefice:cmoj6bffi00338ov63ueqhbjj'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj6bffi00338ov63ueqhbjj');
