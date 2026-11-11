-- GÉNÉRÉ par scripts/studio-demo-sql.mjs depuis supabase/seed/studio_demo.json — ne pas éditer à la main.
-- Espace de démonstration FICTIF du Studio IA (1 mois de fonctionnement).
begin;

insert into public.studio_workspaces (id, nom, offre, secteur, taille, contexte_entreprise, created_at)
values ('5d1e0000-0000-4000-8000-000000000001', 'Démo — Les Délices de Saint-Pierre', 'pro', 'Boulangerie-pâtisserie', '5-9', 'Activité : boulangerie-pâtisserie artisanale à Saint-Pierre (La Réunion), rue des Bons-Enfants.
Fondée en 2019 par Marie-Ange Hoarau. 6 salariés.
Clients cibles : habitants du centre-ville, actifs pressés le matin, familles pour les gâteaux de fête, comités d''entreprise pour les commandes groupées.
Offres principales : pains au levain, viennoiseries, gâteaux d''anniversaire sur commande, formule petit-déjeuner, bûches de Noël.
Ce qui nous différencie : farines et fruits locaux (letchi, passion, vanille Bourbon), label « Fait maison ».
Ton : vouvoiement, chaleureux.
Réseaux : Facebook (principal), Instagram.
Site web : delices-saint-pierre.re (fictif).', now() - interval '31 days' + interval '0 minutes')
on conflict (id) do nothing;

insert into public.studio_users (id, workspace_id, email, prenom, nom, role, created_at)
values ('5d1e0000-0000-4000-8000-000000000002', '5d1e0000-0000-4000-8000-000000000001', 'demo.delices@exemple.re', 'Marie-Ange', 'Hoarau', 'proprietaire', now() - interval '31 days' + interval '0 minutes')
on conflict (id) do nothing;

insert into public.studio_documents (id, workspace_id, titre, type, format, taille, contenu, actif, created_by, created_at)
values ('5d1e0000-0000-4000-8000-000000000101', '5d1e0000-0000-4000-8000-000000000001', 'Tarifs 2026', 'note', null, null, 'Baguette tradition : 1,30 €.
Formule petit-déjeuner (café + viennoiserie + jus de fruits pays) : 6,50 €, servie de 6 h à 10 h.
Gâteau d''anniversaire : 6 parts 24 €, 8 parts 32 €, 12 parts 45 €. Commande au moins 48 h à l''avance.
Tarif étudiant : -10 % le mardi sur présentation de la carte.
Comités d''entreprise : -15 % à partir de 50 viennoiseries.', true, '5d1e0000-0000-4000-8000-000000000002', now() - interval '29 days' + interval '0 minutes')
on conflict (id) do nothing;

insert into public.studio_documents (id, workspace_id, titre, type, format, taille, contenu, actif, created_by, created_at)
values ('5d1e0000-0000-4000-8000-000000000102', '5d1e0000-0000-4000-8000-000000000001', 'Charte de ton', 'note', null, null, 'Toujours vouvoyer. Ton chaleureux et simple. Une touche de créole est bienvenue (« Zot lé invité ! »). Deux émojis maximum par publication. Signature des posts : L''équipe des Délices 🥐. Ne jamais dénigrer la concurrence.', true, '5d1e0000-0000-4000-8000-000000000002', now() - interval '27 days' + interval '0 minutes')
on conflict (id) do nothing;

insert into public.studio_documents (id, workspace_id, titre, type, format, taille, contenu, actif, created_by, created_at)
values ('5d1e0000-0000-4000-8000-000000000103', '5d1e0000-0000-4000-8000-000000000001', 'Horaires et événements de décembre', 'note', null, null, 'Horaires : du mardi au dimanche, 6 h - 19 h. Fermé le lundi.
Marché de Noël de Saint-Pierre les 13 et 14 décembre : stand n° 12, dégustation de bûches.
Bûches de Noël en précommande jusqu''au 20 décembre. Bûche letchi-passion 8 parts : 38 €. Bûche vanille Bourbon-chocolat 8 parts : 36 €.
Ouverture exceptionnelle le lundi 22 décembre.', true, '5d1e0000-0000-4000-8000-000000000002', now() - interval '10 days' + interval '0 minutes')
on conflict (id) do nothing;

insert into public.studio_documents (id, workspace_id, titre, type, format, taille, contenu, actif, created_by, created_at)
values ('5d1e0000-0000-4000-8000-000000000104', '5d1e0000-0000-4000-8000-000000000001', 'Plaquette commerciale.pdf', 'fichier', 'pdf', 184320, 'Les Délices de Saint-Pierre — l''artisanat réunionnais depuis 2019. Pétrissage lent, levain naturel, farine de nos partenaires. Nos fruits viennent des producteurs du Sud sauvage. Commandes pour entreprises : plateaux petit-déjeuner, buffets, cadeaux de fin d''année. Contact pro : commandes@delices-saint-pierre.re (fictif).', true, '5d1e0000-0000-4000-8000-000000000002', now() - interval '28 days' + interval '0 minutes')
on conflict (id) do nothing;

insert into public.studio_documents (id, workspace_id, titre, type, format, taille, contenu, actif, created_by, created_at)
values ('5d1e0000-0000-4000-8000-000000000105', '5d1e0000-0000-4000-8000-000000000001', 'Ancienne carte 2025 (archivée)', 'note', null, null, 'Baguette tradition : 1,10 €. Formule petit-déjeuner : 5,90 €. NE PLUS UTILISER.', false, '5d1e0000-0000-4000-8000-000000000002', now() - interval '30 days' + interval '0 minutes')
on conflict (id) do nothing;

insert into public.studio_conversations (id, workspace_id, user_id, agent_id, titre, created_at, updated_at)
values ('5d1e0000-0000-4000-8000-000000000201', '5d1e0000-0000-4000-8000-000000000001', '5d1e0000-0000-4000-8000-000000000002', 'hugo', 'Générer un post — lancement de la formule petit-déjeuner', now() - interval '25 days' + interval '0 minutes', now() - interval '25 days' + interval '5 minutes')
on conflict (id) do nothing;

insert into public.studio_messages (id, conversation_id, workspace_id, agent_id, role, content, retour, epingle, created_at)
values (gen_random_uuid(), '5d1e0000-0000-4000-8000-000000000201', '5d1e0000-0000-4000-8000-000000000001', 'hugo', 'user', '**Générer un post**
- De quoi parle votre post ? : lancement de notre formule petit-déjeuner
- Réseau : Facebook', null, false, now() - interval '25 days' + interval '1 minutes')
;

insert into public.studio_messages (id, conversation_id, workspace_id, agent_id, role, content, retour, epingle, created_at)
values ('5d1e0000-0000-4000-8000-000000000301', '5d1e0000-0000-4000-8000-000000000201', '5d1e0000-0000-4000-8000-000000000001', 'hugo', 'assistant', '☕ Nouveau aux Délices de Saint-Pierre : la formule petit-déjeuner !
Café, viennoiserie maison et jus de fruits pays pour 6,50 €, de 6 h à 10 h. De quoi bien commencer la journée avant le travail.
Zot lé invité ! Passez nous voir rue des Bons-Enfants.
L''équipe des Délices 🥐
#SaintPierre #LaReunion #FaitMaison', 1, true, now() - interval '25 days' + interval '2 minutes')
on conflict (id) do nothing;

insert into public.studio_conversations (id, workspace_id, user_id, agent_id, titre, created_at, updated_at)
values ('5d1e0000-0000-4000-8000-000000000202', '5d1e0000-0000-4000-8000-000000000001', '5d1e0000-0000-4000-8000-000000000002', 'lea', 'Rédiger un e-mail — fournisseur de farine', now() - interval '20 days' + interval '0 minutes', now() - interval '20 days' + interval '5 minutes')
on conflict (id) do nothing;

insert into public.studio_messages (id, conversation_id, workspace_id, agent_id, role, content, retour, epingle, created_at)
values (gen_random_uuid(), '5d1e0000-0000-4000-8000-000000000202', '5d1e0000-0000-4000-8000-000000000001', 'lea', 'user', 'Écris un e-mail à notre minoterie pour décaler la livraison de jeudi à vendredi.', null, false, now() - interval '20 days' + interval '1 minutes')
;

insert into public.studio_messages (id, conversation_id, workspace_id, agent_id, role, content, retour, epingle, created_at)
values ('5d1e0000-0000-4000-8000-000000000302', '5d1e0000-0000-4000-8000-000000000202', '5d1e0000-0000-4000-8000-000000000001', 'lea', 'assistant', 'Objet : Décalage de la livraison de jeudi

Bonjour,
Pourriez-vous décaler notre livraison de farine de jeudi à vendredi matin ? Merci d''avance pour votre souplesse.
Bien cordialement,
Marie-Ange Hoarau — Les Délices de Saint-Pierre', 1, false, now() - interval '20 days' + interval '2 minutes')
on conflict (id) do nothing;

insert into public.studio_conversations (id, workspace_id, user_id, agent_id, titre, created_at, updated_at)
values ('5d1e0000-0000-4000-8000-000000000203', '5d1e0000-0000-4000-8000-000000000001', '5d1e0000-0000-4000-8000-000000000002', 'sam', 'Séquence de prospection — comités d''entreprise', now() - interval '12 days' + interval '0 minutes', now() - interval '12 days' + interval '5 minutes')
on conflict (id) do nothing;

insert into public.studio_messages (id, conversation_id, workspace_id, agent_id, role, content, retour, epingle, created_at)
values (gen_random_uuid(), '5d1e0000-0000-4000-8000-000000000203', '5d1e0000-0000-4000-8000-000000000001', 'sam', 'user', '**Séquence de prospection**
- Cible : comités d''entreprise du Sud
- Canal : E-mail
- Offre : plateaux petit-déjeuner', null, false, now() - interval '12 days' + interval '1 minutes')
;

insert into public.studio_messages (id, conversation_id, workspace_id, agent_id, role, content, retour, epingle, created_at)
values ('5d1e0000-0000-4000-8000-000000000303', '5d1e0000-0000-4000-8000-000000000203', '5d1e0000-0000-4000-8000-000000000001', 'sam', 'assistant', 'J0 — Objet : Des petits-déjeuners maison pour vos équipes
Bonjour [Prénom], les Délices de Saint-Pierre livrent des plateaux petit-déjeuner faits maison pour vos réunions. -15 % dès 50 viennoiseries. Un essai pour votre prochain séminaire ?

J+4 — Relance courte avec photo d''un plateau.

J+10 — Dernier message : proposition de dégustation gratuite au bureau.', 1, true, now() - interval '12 days' + interval '2 minutes')
on conflict (id) do nothing;

insert into public.studio_conversations (id, workspace_id, user_id, agent_id, titre, created_at, updated_at)
values ('5d1e0000-0000-4000-8000-000000000204', '5d1e0000-0000-4000-8000-000000000001', '5d1e0000-0000-4000-8000-000000000002', 'hugo', 'Calendrier éditorial — décembre', now() - interval '5 days' + interval '0 minutes', now() - interval '5 days' + interval '5 minutes')
on conflict (id) do nothing;

insert into public.studio_messages (id, conversation_id, workspace_id, agent_id, role, content, retour, epingle, created_at)
values (gen_random_uuid(), '5d1e0000-0000-4000-8000-000000000204', '5d1e0000-0000-4000-8000-000000000001', 'hugo', 'user', '**Calendrier éditorial**
- Mois concerné : décembre
- Rythme : 3 posts / semaine', null, false, now() - interval '5 days' + interval '1 minutes')
;

insert into public.studio_messages (id, conversation_id, workspace_id, agent_id, role, content, retour, epingle, created_at)
values ('5d1e0000-0000-4000-8000-000000000304', '5d1e0000-0000-4000-8000-000000000204', '5d1e0000-0000-4000-8000-000000000001', 'hugo', 'assistant', '| Date | Réseau | Thème |
|---|---|---|
| 2 déc. | Facebook | Ouverture des précommandes de bûches |
| 9 déc. | Instagram | Coulisses : la bûche letchi-passion |
| 12 déc. | Facebook | Rendez-vous au Marché de Noël (stand 12) |
| 18 déc. | Facebook | Dernier rappel précommandes (jusqu''au 20) |', 1, true, now() - interval '5 days' + interval '2 minutes')
on conflict (id) do nothing;

insert into public.studio_conversations (id, workspace_id, user_id, agent_id, titre, created_at, updated_at)
values ('5d1e0000-0000-4000-8000-000000000205', '5d1e0000-0000-4000-8000-000000000001', '5d1e0000-0000-4000-8000-000000000002', 'mael', 'Relance d''impayé — CE Sucrerie du Gol', now() - interval '3 days' + interval '0 minutes', now() - interval '3 days' + interval '5 minutes')
on conflict (id) do nothing;

insert into public.studio_messages (id, conversation_id, workspace_id, agent_id, role, content, retour, epingle, created_at)
values (gen_random_uuid(), '5d1e0000-0000-4000-8000-000000000205', '5d1e0000-0000-4000-8000-000000000001', 'mael', 'user', '**Relance d''impayé**
- Client : CE Sucrerie du Gol
- Facture : F-2026-118, 420 €, échue le 31/10
- Niveau : 1re relance amiable', null, false, now() - interval '3 days' + interval '1 minutes')
;

insert into public.studio_messages (id, conversation_id, workspace_id, agent_id, role, content, retour, epingle, created_at)
values ('5d1e0000-0000-4000-8000-000000000305', '5d1e0000-0000-4000-8000-000000000205', '5d1e0000-0000-4000-8000-000000000001', 'mael', 'assistant', 'Objet : Facture F-2026-118 — rappel
Bonjour, sauf erreur de notre part, la facture F-2026-118 de 420 € échue le 31/10 reste impayée…', -1, false, now() - interval '3 days' + interval '2 minutes')
on conflict (id) do nothing;

insert into public.studio_connecteurs (workspace_id, type, statut, infos, notes_admin, demande_par)
values ('5d1e0000-0000-4000-8000-000000000001', 'facebook', 'connecte', '{"page":"https://facebook.com/delicessaintpierre"}'::jsonb, 'Page reliée le 20/10 (démo).', '5d1e0000-0000-4000-8000-000000000002')
on conflict (workspace_id, type) do nothing;

insert into public.studio_connecteurs (workspace_id, type, statut, infos, notes_admin, demande_par)
values ('5d1e0000-0000-4000-8000-000000000001', 'instagram', 'demande', '{"compte":"@delices.saintpierre"}'::jsonb, '', '5d1e0000-0000-4000-8000-000000000002')
on conflict (workspace_id, type) do nothing;

commit;
