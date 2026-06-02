/*
  # Import des e-mails de prospection (app AGEFICE -> A(I)ssociate)
  26 e-mails sortants « Formation IA » envoyés depuis contact@aissociate.re.
  Chaque destinataire (prospect) est créé comme contact (type 'prospect') s'il
  n'existe pas, puis l'e-mail y est rattaché. owner_id = null => visible Direction.
  Corps converti HTML -> texte (convention 'corps' = texte dans l'app).
  Idempotent : dédup contacts par email, e-mails par message_id (= 'agefice:'+id).
  Source : D:/Projets/agefice-app/prisma/dev.db (messages_email, direction=sortant).
*/

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Amavassy', 'Dany', 'damavassy@trame.re', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'damavassy@trame.re');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['damavassy@trame.re'], 'Relance pièces formation', 'Bonjour Dany,

Nous vous remercions de votre inscription à la formation Intégrer avec sagesse l''IA dans votre entreprise (dossier AGF-202604-1152).

Afin de finaliser votre dossier de financement auprès de l''AGEFICE, nous vous demandons de nous transmettre les pièces suivantes :

• Extrait KBIS de votre SASU

• CFP (Contribution à la Formation Professionnelle) disponible sur le portail de l''URSSAF

• Copie de votre CNI (recto-verso)

Merci de nous adresser ces documents par retour de mail à votre plus brève convenance.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-22T09:49:50.108Z', '2026-04-22T09:49:50.108Z',
  (select id from public.contacts where lower(email) = 'damavassy@trame.re' order by created_at limit 1), null, 'agefice:cmo9urdm30002d8v679wqz9uv'
where not exists (select 1 from public.emails where message_id = 'agefice:cmo9urdm30002d8v679wqz9uv');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'meralli ballou', 'shanti', 'meralli.ballou.s@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'meralli.ballou.s@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['meralli.ballou.s@gmail.com'], 'Sans objet', 'Bonjour shanti,

Nous vous remercions de votre intérêt pour Aissociate.

Nous sommes spécialisés dans la gestion de formations professionnelles et serions ravis de vous accompagner dans vos projets de développement des compétences au sein de votre entreprise SMB.

N''hésitez pas à nous contacter si vous souhaitez discuter de vos besoins en formation ou si vous avez des questions. Nous serons à votre écoute pour vous proposer les solutions les mieux adaptées.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-22T11:21:03.380Z', '2026-04-22T11:21:03.380Z',
  (select id from public.contacts where lower(email) = 'meralli.ballou.s@gmail.com' order by created_at limit 1), null, 'agefice:cmo9yp6eb0005cwv6uxtdqvsb'
where not exists (select 1 from public.emails where message_id = 'agefice:cmo9yp6eb0005cwv6uxtdqvsb');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Ichane', 'Carole', 'lejaguar.direction@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'lejaguar.direction@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['lejaguar.direction@gmail.com'], 'Relance Documents formation IA', 'Bonjour Carole,

Nous vous contactons concernant votre dossier de formation AGF-202604-4351 intitulé Intégrer avec sagesse l''IA dans votre entreprise.

Pour finaliser votre inscription, nous avons besoin des documents suivants :

• KBIS

• CFP (Contribution à la Formation Professionnelle)

• CNI (Copie de la Carte Nationale d''Identité)

Merci de nous transmettre ces pièces dans les meilleurs délais afin de poursuivre le traitement de votre dossier.

N''hésitez pas à nous contacter si vous avez des questions.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-22T12:05:37.191Z', '2026-04-22T12:05:37.191Z',
  (select id from public.contacts where lower(email) = 'lejaguar.direction@gmail.com' order by created_at limit 1), null, 'agefice:cmoa0ahik000kcwv6dneqkuzo'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa0ahik000kcwv6dneqkuzo');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Bouillet', 'Alexis', 'pv@sunplex.fr', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'pv@sunplex.fr');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['pv@sunplex.fr'], 'formation IA', 'Bonjour Alexis,

Nous vous remercions de votre intérêt pour nos formations professionnelles financées par le CPF.

Nous avons bien reçu votre demande concernant la formation Création de contenus rédactionnels et visuels par l''IA générative. Nous vous proposons une date théorique de 20 mai pour cette session.

Afin de finaliser votre inscription, nous vous demandons de :

1. Confirmer votre participation ainsi que celle de votre deuxième participant

2. Accéder à la plateforme CPF en utilisant le lien suivant pour vous enregistrer :

https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/93454251500010_RS6776-collectif/93454251500010_1800lareunion?contexteFormation=ACTIVITE_PROFESSIONNELLE

3. Consulter le programme détaillé en pièce jointe

N''hésitez pas à nous contacter si vous avez besoin de précisions supplémentaires.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-22T14:10:44.278Z', '2026-04-22T14:10:44.278Z',
  (select id from public.contacts where lower(email) = 'pv@sunplex.fr' order by created_at limit 1), null, 'agefice:cmoa4re100006bov67wfoqc15'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa4re100006bov67wfoqc15');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Petiaye', 'Johnny', 'johnny@petiaye.run', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'johnny@petiaye.run');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['johnny@petiaye.run'], 'Formation IA', 'Bonjour Johnny,

Nous vous remercions de votre intérêt pour nos formations professionnelles. Nous sommes ravis de vous accueillir chez Aissociate.

Nous vous confirmons que la formation « Création de contenus rédactionnels et visuels par l''IA générative » correspond à votre demande.

Modalités de financement :

Cette formation peut être financée via votre compte CPF et/ou sur fonds propres.

Dates théoriques :

La formation est prévue autour du 20 mai dans l''est.

Le programme détaillé est joint à cet email pour votre consultation.

Pour vous enregistrer sur la plateforme CPF :

Cliquez ici pour accéder à la formation

N''hésitez pas à nous contacter si vous avez besoin de précisions supplémentaires.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-22T14:14:25.238Z', '2026-04-22T14:14:25.238Z',
  (select id from public.contacts where lower(email) = 'johnny@petiaye.run' order by created_at limit 1), null, 'agefice:cmoa4w4ih000bbov634szatez'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa4w4ih000bbov634szatez');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Hoareau', 'Philippe', 'hoareau.philippe@wanadoo.fr', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'hoareau.philippe@wanadoo.fr');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['hoareau.philippe@wanadoo.fr'], 'Formation IA', 'Bonjour Philippe,

Suite à notre échange, je vous contacte pour vous proposer une offre de formation adaptée à votre équipe de la Pharmacie de la Rivière.

Chez Aissociate, nous accompagnons les professionnels de santé dans leurs besoins en montée en compétences. Nous proposons un catalogue complet de formations répondant aux enjeux actuels de votre secteur.

Nous avons notamment réalisé une formation en Intelligence Artificielle pour le réseau de pharmaciens Ôté Pharma, ce qui nous permet de comprendre finement les spécificités métier de votre activité. Cette expérience est un atout pour concevoir des formations vraiment pertinentes.

Je vous propose une offre sur mesure de 2 jours pour vos salariés. Nous pourrions explorer ensemble vos besoins spécifiques et construire un programme adapté.

Serais-je disponible pour un appel ou un échange en début de semaine prochaine afin de discuter de ce projet ?

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-22T14:19:45.542Z', '2026-04-22T14:19:45.542Z',
  (select id from public.contacts where lower(email) = 'hoareau.philippe@wanadoo.fr' order by created_at limit 1), null, 'agefice:cmoa52znv000gbov6y6b5a0lf'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa52znv000gbov6y6b5a0lf');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Samourgompoullé', 'Geneviève', 'sittirani@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'sittirani@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['sittirani@gmail.com'], 'Formation IA', 'Bonjour Geneviève,

Nous vous remercions de votre intérêt pour nos formations professionnelles.

Nous vous proposons de découvrir notre formation « Création de contenus rédactionnels et visuels par l''IA générative », particulièrement adaptée à votre activité de commerciale indépendante.

Vous pouvez vous enregistrer directement sur votre Compte Formation CPF en cliquant sur le lien suivant :

Accéder à la formation CPF

Si vous avez des questions ou souhaitez explorer d''autres options de financement (AGEFICE notamment), n''hésitez pas à nous contacter.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-22T14:22:39.434Z', '2026-04-22T14:22:39.434Z',
  (select id from public.contacts where lower(email) = 'sittirani@gmail.com' order by created_at limit 1), null, 'agefice:cmoa56pu5000kbov6woz9v09k'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa56pu5000kbov6woz9v09k');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Boutry', 'Charlotte', 'charlotte.boutry@groupegesco.fr', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'charlotte.boutry@groupegesco.fr');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['charlotte.boutry@groupegesco.fr'], 'Formation IA', 'Bonjour Charlotte,

Merci de votre intérêt pour nos formations professionnelles. Nous sommes ravis de vous accompagner dans le développement des compétences de votre équipe.

Concernant la formation Création de contenus rédactionnels et visuels par l''IA générative, nous vous proposons un parcours sur deux jours aux alentours du 20 mai. Avant de finaliser les modalités, nous aurions besoin de quelques précisions :

1. Confirmation du nombre de participants : Pouvez-vous confirmer que vous souhaitez inscrire 2 participants ?

2. Inscription via CPF : Nous vous invitons à procéder à l''enregistrement de vos participants via le lien CPF suivant :

https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/93454251500010_RS6776-collectif/93454251500010_1800lareunion?contexteFormation=ACTIVITE_PROFESSIONNELLE

3. Lieu de formation : Nous définirons le lieu exact selon vos préférences et disponibilités.

Vous trouverez en pièce jointe notre catalogue de formations pour découvrir l''ensemble de nos offres.

N''hésitez pas à nous contacter pour toute question ou précision supplémentaire.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-22T14:27:20.467Z', '2026-04-22T14:27:20.467Z',
  (select id from public.contacts where lower(email) = 'charlotte.boutry@groupegesco.fr' order by created_at limit 1), null, 'agefice:cmoa5cqom000obov6vwvlm0pm'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa5cqom000obov6vwvlm0pm');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Lorion', 'David', 'dlorion@buffi.re', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'dlorion@buffi.re');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['dlorion@buffi.re'], 'Formation IA', 'Bonjour David,

Nous vous remercions de votre intérêt pour nos formations professionnelles. Nous avons bien noté votre demande concernant une formation en Création de contenus rédactionnels et visuels par l''IA générative.

Afin de finaliser l''organisation de cette formation, nous aurions besoin de quelques précisions :

1. Nombre de participants

Pouvez-vous confirmer le nombre exact de participants que vous souhaitez inscrire à cette formation ?

2. Modalités de suivi

Nous notons que la formation devrait se dérouler en interne sur votre site. Pouvez-vous confirmer cette modalité et nous indiquer les détails logistiques ?

3. Prise en charge CPF

Pour les participants souhaitant utiliser leur Compte Personnel de Formation (CPF), veuillez les inviter à s''enregistrer via le lien suivant :

https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/93454251500010_RS6776-collectif/93454251500010_1800lareunion?contexteFormation=ACTIVITE_PROFESSIONNELLE

4. Calendrier

Pouvez-vous confirmer que la date théorique de fin mai vous convient pour le démarrage de cette formation ?

Nous restons à votre disposition pour toute question.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-22T14:30:30.111Z', '2026-04-22T14:30:30.111Z',
  (select id from public.contacts where lower(email) = 'dlorion@buffi.re' order by created_at limit 1), null, 'agefice:cmoa5gt0i000ubov6e8l65v6r'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa5gt0i000ubov6e8l65v6r');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'tam', 'thiam', 'thiamjudex@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'thiamjudex@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['thiamjudex@gmail.com'], 'Formation IA', 'Bonjour thiam,

Nous vous remercions de votre intérêt pour nos formations professionnelles. Suite à votre demande, nous vous proposons une formation de 2 jours sur la Création de contenus rédactionnels et visuels par l''IA générative, avec pour objectif la maîtrise de l''assistant administratif en sortie de formation.

Informations clés :

- Durée : 2 jours

- Nombre de participants : 2 personnes

- Date théorique : Fin mai

- Financement : CPF

Pour vous enregistrer et accéder à la formation via votre compte CPF, veuillez utiliser le lien suivant :

https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/93454251500010_RS6776-collectif/93454251500010_1800lareunion?contexteFormation=ACTIVITE_PROFESSIONNELLE

Nous vous prions de confirmer :

- Le nombre exact de participants

- Votre accord pour le financement par CPF

Le catalogue complet de nos formations est joint à cet email.

Nous restons à votre disposition pour toute question.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-22T14:33:06.041Z', '2026-04-22T14:33:06.041Z',
  (select id from public.contacts where lower(email) = 'thiamjudex@gmail.com' order by created_at limit 1), null, 'agefice:cmoa5k5bw000ybov6e5vsxmmh'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa5k5bw000ybov6e5vsxmmh');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Chelmy', 'Didier', 'didierc.invest@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'didierc.invest@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['didierc.invest@gmail.com'], 'Formation IA', 'Bonjour Didier,

Nous vous remercions de votre intérêt pour nos formations professionnelles.

Nous avons le plaisir de vous confirmer la formation Création de contenus rédactionnels et visuels par l''IA générative.

Cette formation peut être financée via votre compte CPF. Vous pouvez vous enregistrer directement en cliquant sur le lien suivant :

Accès à la formation CPF

Vous trouverez en pièce jointe notre catalogue détaillé ainsi que les informations relatives à cette formation.

La date théorique envisagée est le 20 mai au Port. Nous vous demandons de nous confirmer votre participation à votre plus brève convenance.

N''hésitez pas à nous contacter pour toute question ou besoin de précision.

Cordialement,

Aissociate

contact@aissociate.re

```', '2026-04-22T14:36:24.134Z', '2026-04-22T14:36:24.134Z',
  (select id from public.contacts where lower(email) = 'didierc.invest@gmail.com' order by created_at limit 1), null, 'agefice:cmoa5oe6i0013bov6nytdcsu7'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa5oe6i0013bov6nytdcsu7');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Dumont', 'Bruno', 'bruno.dumont974@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'bruno.dumont974@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['bruno.dumont974@gmail.com'], 'Formation IA', 'Bonjour Bruno,

Nous vous remercions de votre intérêt pour nos formations professionnelles. Nous avons bien noté votre demande concernant une formation CPF prévue théoriquement le 20 mai au port.

Afin de finaliser votre inscription, nous aurions besoin de quelques informations :

1. Confirmation du nombre de participants

Vous aviez mentionné 3 participants possibles. Pourriez-vous confirmer le nombre exact de personnes qui suivront cette formation ?

2. Financement par CPF

Nous vous confirmons que cette formation peut être financée via votre Compte Personnel de Formation (CPF). Pour vous enregistrer, veuillez consulter le lien suivant :

https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/93454251500010_RS6776-collectif/93454251500010_1800lareunion?contexteFormation=ACTIVITE_PROFESSIONNELLE

Vous trouverez également en pièce jointe notre catalogue détaillé.

N''hésitez pas à nous contacter si vous avez besoin de précisions supplémentaires.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-22T14:38:03.945Z', '2026-04-22T14:38:03.945Z',
  (select id from public.contacts where lower(email) = 'bruno.dumont974@gmail.com' order by created_at limit 1), null, 'agefice:cmoa5qj710018bov6k4ba4ae2'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoa5qj710018bov6k4ba4ae2');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Laroque', '—', 'sasastyl.concept@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'sasastyl.concept@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['sasastyl.concept@gmail.com'], 'Formation IA', 'Bonjour —,

Merci de votre intérêt pour la formation « Création de contenus rédactionnels et visuels par l''usage responsable de l''intelligence artificielle générative ».

Nous avons bien noté votre demande pour une session à Saint-Pierre en juin. Nous vous confirmons que cette formation est disponible à cette période.

Afin de finaliser votre inscription via votre compte CPF, veuillez consulter le lien suivant :

https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/93454251500010_RS6776-collectif/93454251500010_1800lareunion?contexteFormation=ACTIVITE_PROFESSIONNELLE

Nous vous invitons à vérifier le montant disponible sur votre compte formation et à consulter notre catalogue pour tous les détails relatifs à cette formation.

N''hésitez pas à nous contacter si vous avez besoin de précisions supplémentaires.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-23T18:01:35.675Z', '2026-04-23T18:01:35.675Z',
  (select id from public.contacts where lower(email) = 'sasastyl.concept@gmail.com' order by created_at limit 1), null, 'agefice:cmobsg4i0000o5ov6ok0bnpja'
where not exists (select 1 from public.emails where message_id = 'agefice:cmobsg4i0000o5ov6ok0bnpja');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Brigit', 'Raphael', 'raphaelmussard9@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'raphaelmussard9@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['raphaelmussard9@gmail.com'], 'Formation IA', 'Bonjour Raphael,

Merci de votre intérêt pour la formation Création de contenus rédactionnels et visuels par l''usage responsable de l''intelligence artificielle générative.

Nous sommes ravis de vous accompagner dans ce parcours de formation CPF. Avant de finaliser votre inscription, nous vous proposons de :

1. Vérifier votre compte CPF

Rendez-vous sur votre compte formation pour consulter vos droits disponibles.

2. Confirmer les modalités de formation

Nous envisageons un démarrage en juin à Saint-Pierre. Nous vous recontacterons rapidement pour confirmer la date exacte de début.

3. Consulter le programme détaillé

Vous trouverez en pièce jointe le programme complet de la formation.

N''hésitez pas à nous contacter si vous avez des questions ou besoin de précisions supplémentaires.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-23T18:46:38.913Z', '2026-04-23T18:46:38.913Z',
  (select id from public.contacts where lower(email) = 'raphaelmussard9@gmail.com' order by created_at limit 1), null, 'agefice:cmobu22bq000t5ov6aszdecsx'
where not exists (select 1 from public.emails where message_id = 'agefice:cmobu22bq000t5ov6aszdecsx');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Jean-baptiste Ep Ramsamy', 'Elodie', 'elodiejeanb@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'elodiejeanb@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['elodiejeanb@gmail.com'], 'Formation IA', '```html
Bonjour Elodie,

Merci de votre intérêt pour la formation Création de contenus rédactionnels et visuels par l''usage responsable de l''intelligence artificielle générative.

Nous avons bien noté votre souhait de suivre cette formation en juin à Saint-Pierre. Avant de finaliser votre inscription, nous vous proposons de :

1. Vérifier votre solde CPF

Vous pouvez consulter vos droits de formation directement sur votre compte CPF en cliquant sur le lien suivant :

Accéder à la formation CPF

2. Nous contacter pour les modalités de financement

Si votre solde CPF est insuffisant ou si vous souhaitez explorer d''autres options de financement (AGEFICE ou autre), n''hésitez pas à nous recontacter. Nous vous aiderons à trouver la solution la plus adaptée à votre situation.

Nous restons à votre disposition pour toute question.

Cordialement,

Aissociate

contact@aissociate.re

```', '2026-04-23T19:00:37.702Z', '2026-04-23T19:00:37.702Z',
  (select id from public.contacts where lower(email) = 'elodiejeanb@gmail.com' order by created_at limit 1), null, 'agefice:cmobuk1jd000z5ov656zfeq5d'
where not exists (select 1 from public.emails where message_id = 'agefice:cmobuk1jd000z5ov656zfeq5d');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Michael', 'Rard', 'michael.rard@orange.fr', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'michael.rard@orange.fr');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['michael.rard@orange.fr'], 'Formation IA', 'Bonjour Michael,

Merci de votre intérêt pour la formation Création de contenus rédactionnels et visuels par l''usage responsable de l''intelligence artificielle générative.

Nous serions ravis de vous accompagner dans ce projet. Avant de poursuivre, nous avons besoin de vérifier quelques points :

1. Vérification de votre solde CPF

Vous pouvez consulter votre compte formation directement via ce lien :

Accéder à Mon Compte Formation

2. Financement Agefice

Si votre solde CPF est insuffisant, nous pouvons explorer une prise en charge via Agefice pour une formation sur mesure de 10 jours avec co-construction d''outils, prévue en juin dans le sud.

Pouvez-vous nous confirmer votre préférence et nous transmettre votre solde CPF actuel ?

Nous vous enverrons également notre catalogue complet des formations pour vous permettre d''explorer l''ensemble de nos offres.

Cordialement,

Aissociate

contact@aissociate.re

```', '2026-04-23T19:05:17.363Z', '2026-04-23T19:05:17.363Z',
  (select id from public.contacts where lower(email) = 'michael.rard@orange.fr' order by created_at limit 1), null, 'agefice:cmobuq1bq00145ov6eaaemsec'
where not exists (select 1 from public.emails where message_id = 'agefice:cmobuq1bq00145ov6eaaemsec');

insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['dlorion@buffi.re'], 'Formation IA', 'Bonjour David,

Nous vous remercions de vos précisions. Nous sommes ravis de confirmer l''organisation de la formation Création de contenus rédactionnels et visuels par l''usage responsable de l''intelligence artificielle générative pour vos 4 participants.

Nous vous proposons de programmer cette formation les 20 et 21 mai (deux jours) sur votre site à Saint-Paul. Cette date vous convient-elle ?

Concernant le financement par CPF, nous vous demandons de confirmer que tous les 4 participants souhaitent utiliser cette modalité de prise en charge. Si c''est le cas, chacun d''entre eux devra s''enregistrer via le lien suivant :

https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/93454251500010_RS6776-collectif/93454251500010_1800lareunion?contexteFormation=ACTIVITE_PROFESSIONNELLE

Pourriez-vous nous confirmer cette information au plus tôt afin que nous puissions finaliser les démarches administratives ?

Nous restons à votre entière disposition pour toute question.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-23T19:58:27.905Z', '2026-04-23T19:58:27.905Z',
  (select id from public.contacts where lower(email) = 'dlorion@buffi.re' order by created_at limit 1), null, 'agefice:cmobwmf5v0001jsv6kl3alu8o'
where not exists (select 1 from public.emails where message_id = 'agefice:cmobwmf5v0001jsv6kl3alu8o');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Cadet', 'Laurent', 'laurentgtc@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'laurentgtc@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['laurentgtc@gmail.com'], 'Formation IA', 'Bonjour Laurent,

Merci de votre intérêt pour la formation Création de contenus rédactionnels et visuels par l''usage responsable de l''intelligence artificielle générative.

Nous sommes ravis de vous accompagner dans ce projet de développement professionnel. Avant de finaliser votre inscription, nous vous invitons à :

1. Vérifier votre solde CPF sur votre compte personnel formation

2. Vous enregistrer à la formation via le lien suivant :

https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/93454251500010_RS6776-collectif/93454251500010_1800lareunion?contexteFormation=ACTIVITE_PROFESSIONNELLE

Une session est actuellement en cours de finalisation pour début juin. Nous vous confirmerons rapidement les dates précises et les modalités pratiques.

N''hésitez pas à nous contacter si vous avez besoin de précisions ou d''assistance dans votre démarche.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-28T21:01:59.359Z', '2026-04-28T21:01:59.359Z',
  (select id from public.contacts where lower(email) = 'laurentgtc@gmail.com' order by created_at limit 1), null, 'agefice:cmoj43dfo00078ov62tzpv5ve'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj43dfo00078ov62tzpv5ve');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'jacqueline', 'ariapoutri', 'image.future@hotmail.fr', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'image.future@hotmail.fr');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['image.future@hotmail.fr'], 'Formation IA', 'Bonjour Jacqueline,

Nous vous remercions de votre intérêt pour la formation Création de contenus rédactionnels et visuels par l''usage responsable de l''intelligence artificielle générative.

Nous sommes ravis de vous accompagner dans cette démarche de montée en compétences. Cette formation vous permettra de développer vos capacités à créer des contenus de qualité tout en utilisant l''IA générative de manière responsable et efficace.

Pour vous enregistrer et consulter le programme détaillé de la formation, veuillez accéder à votre compte CPF via le lien suivant :

https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/93454251500010_RS6776-collectif/93454251500010_1800lareunion?contexteFormation=ACTIVITE_PROFESSIONNELLE

N''hésitez pas à nous contacter si vous avez besoin de précisions supplémentaires ou si vous rencontrez des difficultés lors de votre inscription.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-28T21:06:20.954Z', '2026-04-28T21:06:20.954Z',
  (select id from public.contacts where lower(email) = 'image.future@hotmail.fr' order by created_at limit 1), null, 'agefice:cmoj48za5000k8ov6ta4m0msx'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj48za5000k8ov6ta4m0msx');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Lakazeduc', '—', 'lakazeduc.974@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'lakazeduc.974@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['lakazeduc.974@gmail.com'], 'formation IA', 'Bonjour,

Nous vous remercions de votre intérêt pour la formation « Création de contenus rédactionnels et visuels par l''usage responsable de l''intelligence artificielle générative ».

Nous vous confirmons que cette formation est validée pour la session du 20 mai. Pour finaliser votre inscription et initier votre dossier de formation, nous vous invitons à vous enregistrer sur votre compte CPF via le lien suivant :

https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/93454251500010_RS6776-collectif/93454251500010_1800lareunion?contexteFormation=ACTIVITE_PROFESSIONNELLE

N''hésitez pas à nous contacter si vous avez besoin de précisions concernant le montant CPF ou toute autre information relative à cette formation.

Nous restons à votre disposition pour accompagner votre parcours de formation.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-28T21:31:48.550Z', '2026-04-28T21:31:48.550Z',
  (select id from public.contacts where lower(email) = 'lakazeduc.974@gmail.com' order by created_at limit 1), null, 'agefice:cmoj55pzg00198ov6vqlq1hdv'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj55pzg00198ov6vqlq1hdv');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Reynaud', 'Barbara', 'conseilreunion974@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'conseilreunion974@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['conseilreunion974@gmail.com'], 'Formation IA ', 'Bonjour Barbara,

Nous vous remercions de votre intérêt pour nos formations professionnelles. Nous sommes ravis de vous accompagner dans le développement de vos compétences.

Nous vous contactons concernant la formation « Déployer l''Intelligence Artificielle dans son entreprise : de la stratégie à l''opérationnel », financée par l''AGEFICE. Nous souhaiterions confirmer avec vous les modalités de financement et la date envisagée de suivi (fin mai).

Nous vous proposons également de consulter notre catalogue complet des formations afin de découvrir d''autres programmes adaptés à vos besoins en gestion administrative, création de formations et gestion des réseaux sociaux.

Pourriez-vous nous confirmer :

• Votre choix concernant le mode de financement

• La date précise souhaitée pour débuter la formation

Nous restons à votre entière disposition pour répondre à vos questions.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-28T21:36:38.082Z', '2026-04-28T21:36:38.082Z',
  (select id from public.contacts where lower(email) = 'conseilreunion974@gmail.com' order by created_at limit 1), null, 'agefice:cmoj5bxdy001f8ov6p5ak3o0g'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj5bxdy001f8ov6p5ak3o0g');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Y', 'Philippe', 'Ysf.phil@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'ysf.phil@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['Ysf.phil@gmail.com'], 'Formation IA', 'Bonjour Philippe,

Nous vous remercions de votre intérêt pour notre formation « Création de contenus rédactionnels et visuels par l''usage responsable de l''intelligence artificielle générative ».

Nous avons bien noté votre souhait de suivre cette formation aux dates des 2 et 3 juin à Saint-Pierre, avec un objectif centré sur la gestion administrative et la gestion des mails.

Avant de finaliser votre inscription, nous vous invitons à :

1. Vérifier votre solde CPF

Connectez-vous à votre compte formation pour consulter vos droits disponibles.

2. Vous enregistrer sur la plateforme

Vous pouvez accéder à la formation via ce lien : https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/93454251500010_RS6776-collectif/93454251500010_1800lareunion?contexteFormation=ACTIVITE_PROFESSIONNELLE

N''hésitez pas à nous contacter si vous avez besoin d''assistance ou si vous souhaitez consulter notre catalogue complet de formations.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-28T21:38:07.350Z', '2026-04-28T21:38:07.350Z',
  (select id from public.contacts where lower(email) = 'ysf.phil@gmail.com' order by created_at limit 1), null, 'agefice:cmoj5du9l001i8ov68k62shki'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj5du9l001i8ov68k62shki');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Nourdine', 'Chaadiat', 'nchaadiat@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'nchaadiat@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['nchaadiat@gmail.com'], 'Formation IA', 'Bonjour Chaadiat,

Merci de votre intérêt pour notre formation Création de contenus rédactionnels et visuels par l''usage responsable de l''intelligence artificielle générative.

Nous sommes ravis de vous accompagner dans votre parcours de formation. Voici les informations essentielles :

Session disponible :

2-3 juin à Saint Pierre

Certification à l''issue de la formation

Financement CPF :

Vous pouvez vous enregistrer directement sur votre compte formation via le lien suivant :

Accéder à la formation sur Mon Compte Formation

Vous trouverez en pièce jointe notre catalogue complet pour découvrir toutes nos formations et choisir celle qui correspond au mieux à vos besoins.

N''hésitez pas à nous contacter si vous avez besoin de précisions supplémentaires.

Cordialement,

Aissociate

contact@aissociate.re

```', '2026-04-28T21:45:30.399Z', '2026-04-28T21:45:30.399Z',
  (select id from public.contacts where lower(email) = 'nchaadiat@gmail.com' order by created_at limit 1), null, 'agefice:cmoj5nc4i001p8ov60fyi7eok'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj5nc4i001p8ov60fyi7eok');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'David', 'Payet', 'neotechno.ingenierie@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'neotechno.ingenierie@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['neotechno.ingenierie@gmail.com'], 'Formation IA', 'Bonjour Payet,

Merci de votre intérêt pour la formation « Intégrer avec sagesse l''IA dans votre entreprise ».

Nous sommes ravis de vous accompagner dans ce projet de formation. Afin de finaliser votre dossier d''inscription, nous vous demandons de nous transmettre les documents suivants :

Documents à fournir :

• Extrait KBIS de votre entreprise (neotechno)

• Document CFP disponible sur le site de l''URSSAF

• Copie de votre CNI

Nous vous enverrons également notre catalogue de formations en pièce jointe.

Concernant les dates, nous avons noté votre préférence pour début juin avec une disponibilité idéale en jeudi/vendredi. Pouvez-vous nous confirmer vos disponibilités précises afin que nous organisions au mieux votre formation ?

N''hésitez pas à nous contacter si vous avez des questions.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-28T21:50:58.876Z', '2026-04-28T21:50:58.876Z',
  (select id from public.contacts where lower(email) = 'neotechno.ingenierie@gmail.com' order by created_at limit 1), null, 'agefice:cmoj5udkw001u8ov6ienuji70'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj5udkw001u8ov6ienuji70');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Baronne', 'Melvin', 'directionbrandingstudio@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'directionbrandingstudio@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['directionbrandingstudio@gmail.com'], 'Formation IA', 'Bonjour Melvin,

Merci de votre intérêt pour la formation Intégrer avec sagesse l''IA dans votre entreprise. Nous sommes ravis de pouvoir vous accompagner dans cette démarche.

Afin de finaliser votre inscription et de constituer votre dossier AGEFICE, nous vous demandons de nous transmettre les documents suivants :

Documents à fournir :

• KBIS de votre entreprise

• Attestation CFP (disponible sur le site de l''URSSAF)

• Copie de votre CNI

• Cahier des charges (à nous envoyer dans les 10 jours)

Vous trouverez également en pièce jointe notre catalogue de formations.

N''hésitez pas à nous contacter si vous avez des questions ou besoin de précisions.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-28T21:53:48.469Z', '2026-04-28T21:53:48.469Z',
  (select id from public.contacts where lower(email) = 'directionbrandingstudio@gmail.com' order by created_at limit 1), null, 'agefice:cmoj5y0ft001z8ov6gm8j0e4z'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj5y0ft001z8ov6gm8j0e4z');

insert into public.contacts (type, nom, prenom, email, notes)
select 'prospect', 'Edith', '—', 'edith.hoair@gmail.com', 'Importé depuis l''app AGEFICE (prospection Formation IA)'
where not exists (select 1 from public.contacts where lower(email) = 'edith.hoair@gmail.com');
insert into public.emails (direction, statut, expediteur, destinataires, sujet, corps, sent_at, created_at, contact_id, owner_id, message_id)
select 'sortant', 'envoye', 'formation@aissociate.re', array['edith.hoair@gmail.com'], 'Formation IA', 'Bonjour Edith,

Merci de votre intérêt pour la formation Création de contenus rédactionnels et visuels par l''usage responsable de l''intelligence artificielle générative.

Nous avons bien noté votre motivation pour la session prévue à Saint-Pierre les 2 et 3 juin. Cette formation est particulièrement adaptée aux professionnels du secteur agricole et touristique comme votre établissement.

Concernant le financement, plusieurs options s''offrent à vous :

• Mobilisation de votre compte CPF (formation éligible)

• Financement via VIVEA en complément

• Prise en charge personnelle avec tarif préférentiel de 1 300 € (au lieu de 1 650 €)

Nous vous proposons de consulter notre catalogue détaillé et de vous rapprocher de VIVEA pour étudier les modalités de financement les plus avantageuses pour votre situation.

N''hésitez pas à nous contacter si vous avez besoin de précisions supplémentaires.

Cordialement,

Aissociate

contact@aissociate.re', '2026-04-28T22:04:14.427Z', '2026-04-28T22:04:14.427Z',
  (select id from public.contacts where lower(email) = 'edith.hoair@gmail.com' order by created_at limit 1), null, 'agefice:cmoj6bffi00338ov63ueqhbjj'
where not exists (select 1 from public.emails where message_id = 'agefice:cmoj6bffi00338ov63ueqhbjj');

