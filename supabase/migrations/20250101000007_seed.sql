/*
  # 07 — Donnees de reference (seed idempotent)

  - financeurs : les 8 financeurs decrits au CDC 4.2 (specificites incluses)
  - workflows + etapes : un workflow type par financeur
  - formations : 2 exemples de catalogue
  - parametres : organisme, SMTP (placeholder)
  - kanban_boards : 1 board "Suivi des dossiers" avec colonnes

  Idempotent : reposable sans dupliquer (on conflict / not exists).
*/

-- FINANCEURS
insert into public.financeurs (code, nom, type, specificites) values
  ('CPF',  'CPF — Mon Compte Formation', 'cpf',
   'Devis dematerialise, delai legal de validation, suivi de la prise en charge, encaissement Caisse des Depots'),
  ('FT',   'France Travail (AIF, POEI, POEC)', 'france_travail',
   'Prescription, devis en charge, accord, conventions, attestations d''assiduite'),
  ('OPCO', 'OPCO', 'opco',
   'Demande de prise en charge, accord OPCO, conventions, facturation a l''OPCO'),
  ('CR',   'Conseil regional', 'conseil_regional',
   'Marche / subvention, conventions, justificatifs de presence'),
  ('PTP',  'Transition Pro (PTP)', 'transition_pro',
   'Dossier de transition, validation commission'),
  ('AGEFICE', 'AGEFICE', 'agefice',
   'Prise en charge dirigeants non salaries, pieces et plafonds specifiques'),
  ('ENT',  'Entreprise (plan de competences)', 'entreprise',
   'Convention de formation, devis, facturation directe'),
  ('PART', 'Particulier / autofinancement', 'particulier',
   'Contrat de formation, delai de retractation, echeancier de paiement')
on conflict (code) do nothing;

-- WORKFLOWS + ETAPES type par financeur
do $$
declare
  f record;
  wf_id uuid;
begin
  for f in select id, code from public.financeurs loop
    if not exists (select 1 from public.workflows where financeur_id = f.id) then
      insert into public.workflows (nom, financeur_id)
      values ('Workflow ' || f.code, f.id)
      returning id into wf_id;

      insert into public.workflow_etapes (workflow_id, ordre, libelle, description) values
        (wf_id, 1, 'Qualification du besoin', 'Recueil du besoin et eligibilite'),
        (wf_id, 2, 'Montage du dossier', 'Constitution des pieces et devis'),
        (wf_id, 3, 'Depot / demande de prise en charge', 'Transmission au financeur'),
        (wf_id, 4, 'Instruction', 'Suivi de l''instruction par le financeur'),
        (wf_id, 5, 'Accord de financement', 'Decision et convention'),
        (wf_id, 6, 'Realisation', 'Deroulement de la formation'),
        (wf_id, 7, 'Solde et facturation', 'Justificatifs, attestations, facturation'),
        (wf_id, 8, 'Cloture', 'Archivage et bilan');
    end if;
  end loop;
end $$;

-- FORMATIONS exemples
insert into public.formations (intitule, objectifs, programme, prerequis, public_vise, duree_heures, modalite, prix, actif)
select 'Bureautique & outils collaboratifs',
       'Maitriser les outils bureautiques et collaboratifs du quotidien',
       '["Traitement de texte","Tableur","Messagerie & agenda","Outils collaboratifs"]'::jsonb,
       'Aucun', 'Tout public', 35, 'presentiel', 1750, true
where not exists (select 1 from public.formations where intitule = 'Bureautique & outils collaboratifs');

insert into public.formations (intitule, objectifs, programme, prerequis, public_vise, duree_heures, modalite, prix, actif)
select 'Gestion d''entreprise pour dirigeants',
       'Piloter la gestion administrative et financiere de son activite',
       '["Comptabilite de base","Pilotage de tresorerie","Obligations sociales","Tableaux de bord"]'::jsonb,
       'Etre dirigeant ou en creation', 'Dirigeants TPE/PME', 21, 'distanciel', 1470, true
where not exists (select 1 from public.formations where intitule = 'Gestion d''entreprise pour dirigeants');

-- PARAMETRES
insert into public.parametres (cle, valeur, description) values
  ('organisme', '{"nom":"AIssociate","qualiopi":"814211-1","email":"contact@aissociate.fr"}'::jsonb,
   'Informations de l''organisme de formation'),
  ('smtp', '{"host":"","port":587,"secure":true,"user":"","from":""}'::jsonb,
   'Configuration SMTP sortant (CDC 4.7)')
on conflict (cle) do nothing;

-- KANBAN board par defaut
do $$
declare b_id uuid;
begin
  if not exists (select 1 from public.kanban_boards where nom = 'Suivi des dossiers') then
    insert into public.kanban_boards (nom, description) values
      ('Suivi des dossiers', 'Vue Kanban du pipeline de dossiers de formation')
      returning id into b_id;
    insert into public.kanban_colonnes (board_id, titre, ordre, couleur) values
      (b_id, 'A traiter', 1, '#64748b'),
      (b_id, 'En montage', 2, '#3375f5'),
      (b_id, 'Depose', 3, '#f59e0b'),
      (b_id, 'Accorde', 4, '#10b981'),
      (b_id, 'Cloture', 5, '#6366f1');
  end if;
end $$;
