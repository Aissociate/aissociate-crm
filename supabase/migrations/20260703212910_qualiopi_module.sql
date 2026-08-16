/*
  # 40 — Module Qualiopi (justificatifs & preuves d'audit)

  Objectif : centraliser toute la preuve de conformité au Référentiel National
  Qualité (RNQ, 7 critères / 32 indicateurs) et permettre l'extraction d'un ZIP
  complet lors de l'audit annuel.

  Deux niveaux de preuve :
    A. ORGANISME (socle) — procédures, registres, fiches de poste, veilles…
       Réutilise la table `documents` + table de liaison `qualiopi_preuve_document`.
    B. DOSSIER DE FORMATION — preuves générées par session / par apprenant
       (convention, convocation, émargement, livrets, attestations, questionnaires).
       Rattachées à `sessions_formation` / `session_participants`.

  Tables : qualiopi_criteres, qualiopi_indicateurs, qualiopi_preuve_document,
           qualiopi_dossier_docs, questionnaire_modeles, questionnaire_envois,
           questionnaire_reponses.

  Sécurité : RLS activée. Lecture = authentifiés ; écriture config = is_manager().
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.qualiopi_applicable as enum ('oui','si_certifiante','non_applicable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.qualiopi_niveau as enum ('organisme','dossier','mixte');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.qualiopi_conformite as enum ('conforme','a_completer','non_applicable','a_verifier');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.qualiopi_doc_statut as enum ('a_generer','genere','envoye','signe','recu','valide','non_applicable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.questionnaire_statut as enum ('a_envoyer','envoye','relance','repondu','expire');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RÉFÉRENTIEL (config seedée)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.qualiopi_criteres (
  numero  integer primary key,
  libelle text not null
);
alter table public.qualiopi_criteres enable row level security;

create table if not exists public.qualiopi_indicateurs (
  numero            integer primary key,
  critere           integer not null references public.qualiopi_criteres(numero) on delete cascade,
  intitule          text not null,
  applicable        public.qualiopi_applicable not null default 'oui',
  niveau            public.qualiopi_niveau not null default 'organisme',
  preuves_attendues text,
  nouvel_entrant    boolean not null default false,
  statut            public.qualiopi_conformite not null default 'a_completer',
  commentaire       text,
  updated_at        timestamptz not null default now()
);
drop trigger if exists trg_q_indic_updated on public.qualiopi_indicateurs;
create trigger trg_q_indic_updated before update on public.qualiopi_indicateurs
  for each row execute function public.set_updated_at();
alter table public.qualiopi_indicateurs enable row level security;

-- Preuves ORGANISME : liaison indicateur <-> document (n..n)
create table if not exists public.qualiopi_preuve_document (
  id                uuid primary key default gen_random_uuid(),
  indicateur_numero integer not null references public.qualiopi_indicateurs(numero) on delete cascade,
  document_id       uuid not null references public.documents(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (indicateur_numero, document_id)
);
create index if not exists idx_q_preuve_indic on public.qualiopi_preuve_document(indicateur_numero);
alter table public.qualiopi_preuve_document enable row level security;

-- Colonne de péremption pour les preuves périodiques (veilles 23/24/25…)
alter table public.documents add column if not exists date_validite date;

-- ─────────────────────────────────────────────────────────────────────────────
-- DOSSIER DE FORMATION (niveau B)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.qualiopi_dossier_docs (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.sessions_formation(id) on delete cascade,
  participant_id    uuid references public.session_participants(id) on delete cascade,
  indicateur_numero integer references public.qualiopi_indicateurs(numero) on delete set null,
  type_doc          text not null,
  libelle           text not null,
  statut            public.qualiopi_doc_statut not null default 'a_generer',
  obligatoire       boolean not null default true,
  fichier_url       text,
  genere_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
drop trigger if exists trg_q_dossier_docs_updated on public.qualiopi_dossier_docs;
create trigger trg_q_dossier_docs_updated before update on public.qualiopi_dossier_docs
  for each row execute function public.set_updated_at();
create index if not exists idx_q_ddocs_session on public.qualiopi_dossier_docs(session_id);
create index if not exists idx_q_ddocs_participant on public.qualiopi_dossier_docs(participant_id);
-- Idempotence : un type de doc par session (collectif) ou par participant.
create unique index if not exists uq_q_ddocs_collectif
  on public.qualiopi_dossier_docs(session_id, type_doc) where participant_id is null;
create unique index if not exists uq_q_ddocs_individuel
  on public.qualiopi_dossier_docs(session_id, participant_id, type_doc) where participant_id is not null;
alter table public.qualiopi_dossier_docs enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- QUESTIONNAIRES
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.questionnaire_modeles (
  code        text primary key,
  titre       text not null,
  description text,
  moment      text not null default 'autre',   -- debut | fin | froid | autre
  schema      jsonb not null default '[]'::jsonb,
  actif       boolean not null default true,
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_q_modeles_updated on public.questionnaire_modeles;
create trigger trg_q_modeles_updated before update on public.questionnaire_modeles
  for each row execute function public.set_updated_at();
alter table public.questionnaire_modeles enable row level security;

create table if not exists public.questionnaire_envois (
  id               uuid primary key default gen_random_uuid(),
  modele_code      text not null references public.questionnaire_modeles(code) on delete cascade,
  session_id       uuid references public.sessions_formation(id) on delete cascade,
  participant_id   uuid references public.session_participants(id) on delete set null,
  contact_id       uuid references public.contacts(id) on delete set null,
  destinataire_nom text,
  destinataire_email text,
  token            text not null unique default encode(gen_random_bytes(16), 'hex'),
  statut           public.questionnaire_statut not null default 'a_envoyer',
  sent_at          timestamptz,
  relance_at       timestamptz,
  responded_at     timestamptz,
  owner_id         uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists idx_q_envois_session on public.questionnaire_envois(session_id);
create index if not exists idx_q_envois_statut on public.questionnaire_envois(statut);
create unique index if not exists uq_q_envois_session_part_modele
  on public.questionnaire_envois(session_id, participant_id, modele_code)
  where session_id is not null and participant_id is not null;
alter table public.questionnaire_envois enable row level security;

create table if not exists public.questionnaire_reponses (
  id           uuid primary key default gen_random_uuid(),
  envoi_id     uuid not null references public.questionnaire_envois(id) on delete cascade unique,
  reponses     jsonb not null default '{}'::jsonb,
  note_globale numeric(4,1),
  commentaire  text,
  created_at   timestamptz not null default now()
);
alter table public.questionnaire_reponses enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
-- Config (référentiel + modèles) : lecture tous, écriture managers.
drop policy if exists q_criteres_sel on public.qualiopi_criteres;
create policy q_criteres_sel on public.qualiopi_criteres for select to authenticated using (true);
drop policy if exists q_criteres_wr on public.qualiopi_criteres;
create policy q_criteres_wr on public.qualiopi_criteres for all to authenticated using (is_manager()) with check (is_manager());

drop policy if exists q_indic_sel on public.qualiopi_indicateurs;
create policy q_indic_sel on public.qualiopi_indicateurs for select to authenticated using (true);
drop policy if exists q_indic_wr on public.qualiopi_indicateurs;
create policy q_indic_wr on public.qualiopi_indicateurs for all to authenticated using (true) with check (true);

drop policy if exists q_modeles_sel on public.questionnaire_modeles;
create policy q_modeles_sel on public.questionnaire_modeles for select to authenticated using (true);
drop policy if exists q_modeles_wr on public.questionnaire_modeles;
create policy q_modeles_wr on public.questionnaire_modeles for all to authenticated using (is_manager()) with check (is_manager());

-- Opérationnel : tous les authentifiés (cohérent avec sessions_formation).
drop policy if exists q_preuvedoc_all on public.qualiopi_preuve_document;
create policy q_preuvedoc_all on public.qualiopi_preuve_document for all to authenticated using (true) with check (true);

drop policy if exists q_ddocs_all on public.qualiopi_dossier_docs;
create policy q_ddocs_all on public.qualiopi_dossier_docs for all to authenticated using (true) with check (true);

drop policy if exists q_envois_all on public.questionnaire_envois;
create policy q_envois_all on public.questionnaire_envois for all to authenticated using (true) with check (true);

drop policy if exists q_reponses_all on public.questionnaire_reponses;
create policy q_reponses_all on public.questionnaire_reponses for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- BUCKET privé « qualiopi »
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('qualiopi', 'qualiopi', false)
on conflict (id) do nothing;

drop policy if exists "qualiopi_storage_rw" on storage.objects;
create policy "qualiopi_storage_rw" on storage.objects for all to authenticated
  using (bucket_id = 'qualiopi') with check (bucket_id = 'qualiopi');

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED — 7 critères
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.qualiopi_criteres (numero, libelle) values
  (1, 'Information du public sur les prestations'),
  (2, 'Identification des objectifs et adaptation au public'),
  (3, 'Adaptation aux publics : accueil, accompagnement, suivi, évaluation'),
  (4, 'Adéquation des moyens pédagogiques, techniques et d''encadrement'),
  (5, 'Qualification et développement des connaissances des personnels'),
  (6, 'Inscription dans son environnement professionnel'),
  (7, 'Recueil et prise en compte des appréciations et réclamations')
on conflict (numero) do update set libelle = excluded.libelle;

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED — 32 indicateurs (dérivé de « liste éléments qualiopi.xlsx »)
--   applicable : oui | si_certifiante | non_applicable
--   niveau     : organisme | dossier | mixte
--   Les indicateurs 13-16 & 20 (apprentissage/CFA) sont hors périmètre par défaut.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.qualiopi_indicateurs
  (numero, critere, intitule, applicable, niveau, nouvel_entrant, preuves_attendues) values
  (1, 1, 'Information du public sur les prestations, délais et résultats', 'oui', 'organisme', true,  'Programme, CGU, exemple de devis, procédure PSH, informations publiques (site).'),
  (2, 1, 'Diffusion des indicateurs de résultats', 'oui', 'organisme', true,  'Tableau d''indicateurs de résultats publié (taux de satisfaction, d''assiduité…).'),
  (3, 1, 'Résultats des certifications professionnelles', 'si_certifiante', 'organisme', true,  'Tableau des taux d''obtention de la certification.'),
  (4, 2, 'Analyse du besoin du bénéficiaire', 'oui', 'dossier', false, 'Questionnaire / grille d''analyse du besoin, tableau de synthèse.'),
  (5, 2, 'Définition des objectifs opérationnels de la prestation', 'oui', 'dossier', false, 'Convention de formation avec objectifs opérationnels et évaluables.'),
  (6, 2, 'Adaptation des contenus et modalités pédagogiques', 'oui', 'mixte', false, 'Procédure d''adaptation, déroulé pédagogique, support, émargement.'),
  (7, 2, 'Adéquation des contenus aux exigences de la certification', 'si_certifiante', 'organisme', false, 'Tableau de correspondance référentiel de certification / contenu.'),
  (8, 2, 'Positionnement et évaluation à l''entrée', 'oui', 'dossier', true,  'Test / questionnaire de positionnement à l''entrée en formation.'),
  (9, 3, 'Information des bénéficiaires sur le déroulement', 'oui', 'dossier', true,  'Livret d''accueil, convocation, règlement intérieur, CGU.'),
  (10, 3, 'Adaptation de l''accompagnement et information sur les modalités', 'oui', 'dossier', false, 'Livret de suivi pédagogique individualisé.'),
  (11, 3, 'Évaluation de l''atteinte des objectifs', 'oui', 'dossier', true,  'Procédure et outils d''évaluation des acquis, comptes rendus.'),
  (12, 3, 'Engagement des bénéficiaires et prévention des ruptures', 'oui', 'dossier', true,  'Fiche de suivi de l''engagement des bénéficiaires (émargement, relances).'),
  (13, 3, 'Coordination des acteurs (alternance / apprentissage)', 'non_applicable', 'organisme', false, 'Spécifique CFA / apprentissage — hors périmètre.'),
  (14, 3, 'Accompagnement socio-professionnel (apprentissage)', 'non_applicable', 'organisme', false, 'Spécifique CFA / apprentissage — hors périmètre.'),
  (15, 3, 'Information sur les droits et devoirs des apprentis', 'non_applicable', 'organisme', false, 'Spécifique CFA / apprentissage — hors périmètre.'),
  (16, 3, 'Présentation des apprentis aux épreuves de certification', 'non_applicable', 'organisme', false, 'Spécifique CFA / apprentissage — hors périmètre.'),
  (17, 4, 'Moyens humains, techniques et environnement adaptés', 'oui', 'organisme', true,  'Livret d''accueil formateur, contrat de location de salle, moyens matériels.'),
  (18, 4, 'Coordination des intervenants', 'oui', 'organisme', false, 'Procédure de coordination des intervenants.'),
  (19, 4, 'Ressources pédagogiques et appropriation par les personnels', 'oui', 'organisme', true,  'Ressources pédagogiques mises à disposition, procédure d''appropriation.'),
  (20, 4, 'Personnels dédiés (conseil de perfectionnement — apprentissage)', 'non_applicable', 'organisme', false, 'Spécifique CFA / apprentissage — hors périmètre.'),
  (21, 5, 'Détermination et mobilisation des compétences des intervenants', 'oui', 'organisme', false, 'Dossier de compétences de l''intervenant (CV, diplômes, N° NDA).'),
  (22, 5, 'Développement des compétences des personnels', 'oui', 'organisme', false, 'Tableau de suivi des actions de développement des compétences.'),
  (23, 6, 'Veille légale et réglementaire', 'oui', 'organisme', false, 'Procédure de veille + registre de veille légale et réglementaire.'),
  (24, 6, 'Veille sur les évolutions métiers et compétences', 'oui', 'organisme', true,  'Relevé de veille métier et compétences (preuves d''exploitation).'),
  (25, 6, 'Veille pédagogique et technologique', 'oui', 'organisme', true,  'Registre de veille pédagogique et technologique.'),
  (26, 6, 'Mobilisation des ressources / réseaux handicap', 'oui', 'organisme', false, 'Modalités de mobilisation, liste de partenaires, preuves d''exploitation.'),
  (27, 6, 'Sous-traitance et portage salarial', 'oui', 'organisme', false, 'Note de périmètre sous-traitance (ou contrats de sous-traitance).'),
  (28, 6, 'Réseau de partenaires et formation en situation de travail', 'oui', 'organisme', false, 'Note de périmètre réseau partenaires / FEST.'),
  (29, 7, 'Actions favorisant l''insertion ou la poursuite de parcours', 'oui', 'mixte', false, 'Dispositif d''actions, registre de suivi, attestations de compétences.'),
  (30, 7, 'Recueil des appréciations des parties prenantes', 'oui', 'mixte', false, 'Questionnaires (chaud, froid, donneur d''ordre, formateur, financeur) + synthèse.'),
  (31, 7, 'Traitement des réclamations et difficultés', 'oui', 'organisme', false, 'Procédure de gestion des réclamations + registre des réclamations.'),
  (32, 7, 'Amélioration continue', 'oui', 'organisme', false, 'Plan d''amélioration continue.')
on conflict (numero) do update set
  critere = excluded.critere,
  intitule = excluded.intitule,
  preuves_attendues = excluded.preuves_attendues;
-- Note : on ne réécrase PAS applicable/niveau/statut/commentaire en cas de ré-exécution
-- pour préserver les choix de l'utilisateur.

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED — modèles de questionnaires (schéma éditable ensuite dans l'UI)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.questionnaire_modeles (code, titre, description, moment, schema) values
  ('positionnement', 'Questionnaire de positionnement (entrée)',
   'Analyse du besoin et positionnement avant l''entrée en formation.', 'debut',
   '[
     {"id":"attentes","label":"Quelles sont vos attentes vis-à-vis de cette formation ?","type":"textarea","required":true},
     {"id":"niveau","label":"Comment évaluez-vous votre niveau actuel sur le sujet ?","type":"radio","options":["Débutant","Intermédiaire","Avancé"],"required":true},
     {"id":"objectifs","label":"Quels objectifs professionnels souhaitez-vous atteindre ?","type":"textarea","required":true},
     {"id":"prerequis","label":"Disposez-vous des prérequis annoncés ?","type":"radio","options":["Oui","Partiellement","Non"],"required":true},
     {"id":"handicap","label":"Êtes-vous en situation de handicap nécessitant une adaptation ?","type":"radio","options":["Non","Oui"],"required":true},
     {"id":"handicap_detail","label":"Si oui, précisez le besoin d''adaptation (matériel, rythme, accessibilité…)","type":"textarea","required":false}
   ]'::jsonb),
  ('chaud', 'Questionnaire de satisfaction à chaud (fin de formation)',
   'Recueil de la satisfaction immédiate en fin de formation.', 'fin',
   '[
     {"id":"organisation","label":"Satisfaction sur l''organisation (accueil, logistique, planning)","type":"echelle","echelle":5,"required":true},
     {"id":"contenu","label":"Satisfaction sur le contenu et les supports","type":"echelle","echelle":5,"required":true},
     {"id":"formateur","label":"Satisfaction sur l''animation du formateur","type":"echelle","echelle":5,"required":true},
     {"id":"objectifs","label":"Les objectifs de la formation ont-ils été atteints ?","type":"echelle","echelle":5,"required":true},
     {"id":"recommandation","label":"Recommanderiez-vous cette formation ? (0 à 10)","type":"nps","required":true},
     {"id":"points_forts","label":"Points forts de la formation","type":"textarea","required":false},
     {"id":"ameliorations","label":"Axes d''amélioration","type":"textarea","required":false}
   ]'::jsonb),
  ('froid', 'Questionnaire à froid (3 à 6 mois après)',
   'Mesure de l''impact et de la mise en pratique à distance.', 'froid',
   '[
     {"id":"mise_en_pratique","label":"Avez-vous pu mettre en pratique les acquis de la formation ?","type":"radio","options":["Oui, pleinement","Partiellement","Non"],"required":true},
     {"id":"impact","label":"Quel impact la formation a-t-elle eu sur votre activité ?","type":"textarea","required":true},
     {"id":"satisfaction_globale","label":"Satisfaction globale avec le recul","type":"echelle","echelle":5,"required":true},
     {"id":"besoins","label":"Avez-vous des besoins de formation complémentaires ?","type":"textarea","required":false}
   ]'::jsonb),
  ('donneur_ordre', 'Questionnaire donneur d''ordre / entreprise',
   'Recueil de l''appréciation de l''entreprise cliente.', 'autre',
   '[
     {"id":"adequation","label":"La formation a-t-elle répondu au besoin de l''entreprise ?","type":"echelle","echelle":5,"required":true},
     {"id":"montee_competences","label":"Constatez-vous une montée en compétences du/des salarié(s) ?","type":"echelle","echelle":5,"required":true},
     {"id":"relation","label":"Satisfaction sur la relation commerciale et le suivi","type":"echelle","echelle":5,"required":true},
     {"id":"commentaire","label":"Commentaire libre","type":"textarea","required":false}
   ]'::jsonb),
  ('formateur', 'Questionnaire formateur',
   'Retour du formateur sur le déroulement de l''action.', 'autre',
   '[
     {"id":"conditions","label":"Les conditions matérielles étaient-elles adaptées ?","type":"echelle","echelle":5,"required":true},
     {"id":"groupe","label":"Niveau et engagement du groupe","type":"echelle","echelle":5,"required":true},
     {"id":"atteinte","label":"Les objectifs pédagogiques ont-ils été atteints ?","type":"radio","options":["Oui","Partiellement","Non"],"required":true},
     {"id":"suggestions","label":"Suggestions d''amélioration","type":"textarea","required":false}
   ]'::jsonb),
  ('financeur', 'Questionnaire financeur',
   'Recueil de l''appréciation du financeur (OPCO, etc.).', 'autre',
   '[
     {"id":"conformite","label":"La prestation était-elle conforme au dossier financé ?","type":"echelle","echelle":5,"required":true},
     {"id":"reactivite","label":"Réactivité et qualité des échanges administratifs","type":"echelle","echelle":5,"required":true},
     {"id":"commentaire","label":"Commentaire libre","type":"textarea","required":false}
   ]'::jsonb)
on conflict (code) do update set
  titre = excluded.titre, description = excluded.description, moment = excluded.moment;
-- schema NON réécrasé en ré-exécution pour préserver les personnalisations.
