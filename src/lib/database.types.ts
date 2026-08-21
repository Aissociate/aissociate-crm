/**
 * Types de la base Supabase (rediges a la main, alignes sur supabase/migrations).
 * Astuce : `npx supabase gen types typescript` peut regenerer ce fichier
 * une fois le projet Supabase lie dans Bolt.
 *
 * NB : on utilise des `type` (pas des `interface`) pour que chaque Row soit
 * assignable a `Record<string, unknown>` (contrainte GenericTable de postgrest-js).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'admin' | 'directeur_commercial' | 'conseiller';
export type ContactType = 'prospect' | 'contact' | 'apprenant' | 'contact_entreprise' | 'contact_financeur' | 'formateur' | 'encadrement';
export type FinancementType =
  | 'cpf' | 'opco' | 'france_travail' | 'pole_emploi' | 'conseil_regional'
  | 'transition_pro' | 'agefice' | 'entreprise' | 'particulier' | 'autre';
export type OpportuniteStage = 'nouveau' | 'qualifie' | 'proposition' | 'negociation' | 'gagne' | 'perdu';
export type DossierStatut =
  | 'brouillon' | 'montage' | 'depose' | 'en_instruction'
  | 'accorde' | 'refuse' | 'en_cours' | 'solde' | 'cloture';
export type PieceStatut = 'manquante' | 'recue' | 'validee' | 'rejetee';
export type CandidatStatut = 'recu' | 'preselection' | 'entretien' | 'retenu' | 'refuse' | 'onboarding';
export type PlanStatut = 'brouillon' | 'valide' | 'envoye' | 'archive';

type Timestamps = { created_at: string; updated_at: string };

export type Profile = Timestamps & {
  id: string; email: string; nom: string; prenom: string;
  role: UserRole; telephone: string | null; actif: boolean; approved: boolean;
  is_admin: boolean; statut_conseiller: string | null; date_recrutement: string | null;
  signature: string | null; notes: string | null;
};
export type Financeur = Timestamps & {
  id: string; code: string; nom: string; type: FinancementType;
  specificites: string | null; actif: boolean;
};
export type Entreprise = Timestamps & {
  id: string; raison_sociale: string; siret: string | null; naf: string | null;
  /** Code de la convention collective applicable (4 chiffres). */
  idcc: string | null;
  secteur: string | null; effectif: number | null; adresse: string | null;
  code_postal: string | null; ville: string | null; telephone: string | null;
  email: string | null; site_web: string | null; notes: string | null; owner_id: string | null;
  statut_juridique: string | null;
};
export type Contact = Timestamps & {
  id: string; type: ContactType; civilite: string | null; nom: string; prenom: string | null;
  email: string | null; telephone: string | null; fonction: string | null;
  /** Adresses complémentaires (autres services de l'organisation) + leur libellé. */
  email2: string | null; email2_libelle: string | null;
  email3: string | null; email3_libelle: string | null;
  entreprise_id: string | null; financeur_id: string | null; owner_id: string | null;
  rgpd_consent: boolean; notes: string | null; external_id: string | null;
  metadata: Record<string, string> | null;
  // Fiche de suivi (qualification / commercial / conformité / commissions)
  statut_entreprise: string | null; siret: string | null; ville: string | null; autres: string | null; effectif: string | null;
  besoin_resume: string | null; formation_envisagee: string | null; financement_envisage: string | null; interet: string | null;
  statut_prospect: string | null; responsable_id: string | null; tags: string[];
  date_fixee: string | null; eligibilite_verifiee: boolean; financement_demande: boolean;
  financement_valide: boolean; inscription_validee: boolean;
  date_formation: string | null; assiette_commission: number | null;
  commission_validee: boolean; commission_payee: boolean;
  // Newsletter : désinscription (lien public à jeton)
  newsletter_unsubscribed: boolean; unsubscribe_token: string;
};
export type ContactDocument = {
  id: string; contact_id: string; titre: string; categorie: string | null;
  fichier_url: string; created_by: string | null; created_at: string;
};
export type ConseillerDocument = {
  id: string; conseiller_id: string; titre: string; categorie: string | null;
  fichier_url: string; created_by: string | null; created_at: string;
};
export type CandidatDocument = {
  id: string; candidat_id: string; titre: string; categorie: string | null;
  fichier_url: string; created_by: string | null; created_at: string;
};
export type ImportBatch = {
  id: string; source: string; count: number; contact_ids: string[];
  created_by: string | null; created_at: string; undone: boolean; undone_at: string | null;
};
export type Newsletter = {
  id: string; sujet: string; contenu_html: string; image_url: string | null;
  periode_debut: string | null; periode_fin: string | null;
  statut: 'brouillon' | 'en_cours' | 'envoye'; recipients_count: number;
  created_by: string | null; created_at: string; sent_at: string | null;
};
export type NewsletterQueue = {
  id: string; newsletter_id: string; email: string;
  status: 'pending' | 'sent' | 'failed'; error: string | null;
  retry_count: number; created_at: string; sent_at: string | null;
};
export type ContactAction = {
  id: string; contact_id: string; date_action: string; heure_action: string | null; type: string; description: string;
  faite: boolean; auteur_id: string | null; created_at: string;
};
export type Opportunite = Timestamps & {
  id: string; titre: string; contact_id: string | null; entreprise_id: string | null;
  financeur_id: string | null; montant: number; stage: OpportuniteStage;
  probabilite: number; date_cloture_prev: string | null; date_cloture: string | null;
  owner_id: string | null; notes: string | null;
};
export type Formation = Timestamps & {
  id: string; intitule: string; objectifs: string | null; programme: string[];
  prerequis: string | null; public_vise: string | null; duree_heures: number;
  modalite: string; prix: number; actif: boolean;
  reference: string | null; prix_intra: number | null; certifiante: boolean | null;
  code_certification: string | null; slug: string | null;
};
export type PlanFormation = Timestamps & {
  id: string; nom: string; formation_id: string | null; contact_id: string | null;
  entreprise_id: string | null; financeur_id: string | null; objectifs: string | null;
  contenu: string[]; duree_heures: number; modalite: string; statut: PlanStatut;
  version: number; owner_id: string | null; dossier_id: string | null;
  dates_session: string | null;
};
export type Workflow = Timestamps & {
  id: string; nom: string; financeur_id: string | null; actif: boolean;
};
export type WorkflowEtape = {
  id: string; workflow_id: string; ordre: number; libelle: string;
  description: string | null; created_at: string;
};
export type Dossier = Timestamps & {
  id: string; reference: string; intitule: string; contact_id: string | null;
  entreprise_id: string | null; financeur_id: string | null; formation_id: string | null;
  plan_id: string | null; workflow_id: string | null; statut: DossierStatut;
  etape_courante: number; montant_demande: number; montant_accorde: number;
  date_debut: string | null; date_fin: string | null; date_depot: string | null;
  owner_id: string | null; notes: string | null;
};
export type DossierPiece = Timestamps & {
  id: string; dossier_id: string; libelle: string; obligatoire: boolean;
  statut: PieceStatut; fichier_url: string | null; version: number; commentaire: string | null;
};
export type Document = Timestamps & {
  id: string; titre: string; categorie: string; description: string | null;
  fichier_url: string | null; version: number; statut: string;
  parent_id: string | null; tags: string[]; owner_id: string | null;
  contenu_texte: string | null; chat_direction: boolean; chat_conseiller: boolean;
  dossier: string | null; dossier_id: string | null;
  date_validite: string | null;
};
export type KanbanBoard = Timestamps & {
  id: string; nom: string; description: string | null; owner_id: string | null;
};
export type KanbanColonne = {
  id: string; board_id: string; titre: string; ordre: number; couleur: string; created_at: string;
};
export type KanbanCarte = Timestamps & {
  id: string; colonne_id: string; titre: string; description: string | null;
  assignee_id: string | null; dossier_id: string | null; ordre: number; echeance: string | null;
};
export type EmailDirection = 'sortant' | 'entrant';
export type EmailCanal = 'email' | 'whatsapp';
export type EmailAttachment = { filename: string; url: string };
export type Email = {
  id: string; dossier_id: string | null; contact_id: string | null; expediteur: string | null;
  destinataires: string[]; sujet: string; corps: string | null; statut: string;
  sent_at: string | null; owner_id: string | null; created_at: string;
  direction: EmailDirection; message_id: string | null; lu: boolean;
  attachments: EmailAttachment[] | null; canal: EmailCanal;
};
export type PieceVersion = {
  id: string; piece_id: string; version: number; fichier_url: string | null;
  commentaire: string | null; created_by: string | null; created_at: string;
};
export type OffreRecrutement = Timestamps & {
  id: string; titre: string; description: string | null; profil: string | null;
  lieu: string | null; statut: string; owner_id: string | null;
};
export type Candidat = Timestamps & {
  id: string; offre_id: string | null; nom: string; prenom: string | null; email: string | null;
  telephone: string | null; cv_url: string | null; statut: CandidatStatut;
  score: number | null; notes: string | null; rgpd_consent: boolean; external_id: string | null;
  metadata: Record<string, string> | null;
  // Processus de recrutement (grille métier)
  ville: string | null; statut_entreprise: string | null; siret: string | null;
  document_identite: boolean; profil_details: string | null;
  historique: string | null; prochaine_action: string | null; date_prochaine_action: string | null;
  note_experience: number | null; note_conversation: number | null; note_autonomie: number | null;
  note_comprehension: number | null; note_motivation: number | null; score_total: number;
  avis: string | null;
  contract_etape1: boolean; contract_etape2: boolean; contract_etape3: boolean; contract_etape4: boolean;
};
export type Formateur = Timestamps & {
  id: string; nom: string; prenom: string | null; email: string | null; telephone: string | null;
  specialites: string | null; statut: string; notes: string | null;
};
export type FormateurDocument = {
  id: string; formateur_id: string; titre: string; categorie: string;
  fichier_url: string | null; version: number; created_by: string | null; created_at: string;
};
export type SessionFormation = Timestamps & {
  id: string; titre: string; formation_id: string | null; dossier_id: string | null;
  date_debut: string; date_fin: string | null; lieu: string | null; modalite: string;
  formateur: string | null; formateur_id: string | null; couleur: string; notes: string | null;
  created_by: string | null;
};
/** Nature d'un document produit depuis un plan (détermine la pièce du dossier). */
export type PlanPdfKind = 'plan' | 'demande' | 'convention' | 'emargement' | 'attestation';
export type PlanPdf = {
  id: string; plan_id: string | null; titre: string; apprenant: string | null;
  organisme: string | null; fichier_url: string | null; created_by: string | null; created_at: string;
  kind: PlanPdfKind;
};
export type ConversationClose = { cle: string; closed_at: string; closed_by: string | null };

/** Conversation enregistrée depuis la page mobile (/mobile). */
export type ConversationStatut = 'en_cours' | 'a_traiter' | 'traitement' | 'traitee' | 'erreur';
export type ConversationSegment = {
  index: number; path: string; duree: number; taille: number; mime: string;
};
export type ConversationAnalyse = {
  resume: string; points_cles: string[]; besoin_resume: string;
  formation_envisagee: string; financement_envisage: string; interet: string;
  objections: string[]; engagements: string[];
  prochaine_action: { description: string; delai_jours: number };
};
export type Conversation = Timestamps & {
  id: string; contact_id: string | null; telephone: string; titre: string | null;
  auteur_id: string | null; source: 'micro' | 'import'; statut: ConversationStatut;
  demarree_at: string; duree_secondes: number; segments: ConversationSegment[];
  transcription: string | null; resume: string | null;
  /** `compte_rendu` et non `analyse` : ANALYSE est un mot réservé de PostgreSQL. */
  compte_rendu: ConversationAnalyse | null;
  action_id: string | null; erreur: string | null;
};

/** Demande de signature électronique d'un document (lien tokenisé + code). */
export type SignatureStatut = 'en_attente' | 'signee' | 'annulee';
export type Signature = {
  id: string; token: string; libelle: string; bucket: string; fichier_url: string;
  plan_pdf_id: string | null; devis_id: string | null; dossier_id: string | null;
  contact_id: string | null; signataire_nom: string; signataire_email: string;
  code_envoye_at: string | null; code_expire_at: string | null; tentatives: number;
  statut: SignatureStatut; signe_at: string | null; signature_nom: string | null;
  fichier_signe_url: string | null; hash_avant: string | null; hash_apres: string | null;
  ip: string | null; user_agent: string | null;
  expire_at: string; created_by: string | null; created_at: string;
};
export type DemiJournee = 'matin' | 'apres_midi';
export type EmargementCreneau = {
  id: string; session_id: string; date: string; demi_journee: DemiJournee;
  heures: number; created_at: string;
};
export type EmargementAcces = {
  id: string; token: string; session_id: string; participant_id: string;
  code_envoye_at: string | null; code_expire_at: string | null; tentatives: number;
  expire_at: string; created_at: string;
};
export type EmargementSignature = {
  id: string; creneau_id: string; participant_id: string;
  statut: 'present' | 'absent' | 'excuse'; mode: 'code' | 'declaratif';
  signe_at: string; code_at: string | null; declare_par: string | null;
  motif: string | null; ip: string | null; user_agent: string | null;
};
/** Document libre rattaché à un dossier (hors pièces justificatives du financeur). */
export type DossierDocument = {
  id: string; dossier_id: string; titre: string; description: string | null;
  fichier_url: string | null; created_by: string | null; created_at: string;
};
export type BlogCategory ={ id: string; name: string; slug: string; description: string | null; color: string | null; icon: string | null; created_at: string; updated_at: string };
export type BlogArticle = {
  id: string; title: string; slug: string; excerpt: string; content: string;
  category_id: string | null; image_url: string | null; author: string | null; read_time: number | null;
  seo_title: string | null; seo_description: string | null; seo_keywords: string | null;
  published: boolean; published_at: string | null; ai_model_used: string | null; generation_prompt: string | null;
  views_count: number | null; created_at: string; updated_at: string;
};
export type DevisStatut = 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire';
export type Devis = Timestamps & {
  id: string; numero: string; contact_id: string | null; entreprise_id: string | null;
  financeur_id: string | null; dossier_id: string | null;
  date_emission: string; date_validite: string | null; statut: DevisStatut;
  tva_taux: number; tva_exoneree: boolean; total_ht: number; total_tva: number; total_ttc: number;
  objet: string | null; conditions: string | null; notes: string | null; fichier_url: string | null; owner_id: string | null;
};
export type DevisLigne = {
  id: string; devis_id: string; designation: string; description: string | null;
  quantite: number; unite: string; prix_unitaire_ht: number; ordre: number; created_at: string;
};
export type ParticipantStatut = 'inscrit' | 'present' | 'absent' | 'annule';
export type SessionParticipant = {
  id: string; session_id: string; contact_id: string | null; nom: string; prenom: string | null;
  email: string | null; statut: ParticipantStatut; created_at: string;
};
export type TicketType = 'bug' | 'proposition';
export type TicketStatut = 'ouvert' | 'en_cours' | 'resolu' | 'refuse';
export type TicketPriorite = 'faible' | 'normale' | 'haute' | 'critique';

export type Ticket = Timestamps & {
  id: string; type: TicketType; titre: string; description: string;
  statut: TicketStatut; priorite: TicketPriorite | null;
  created_by: string; admin_note: string | null; screenshot_url: string | null;
};
export type TicketVote = {
  ticket_id: string; user_id: string; created_at: string;
};

export type AuditLog = {
  id: string; user_id: string | null; action: string; entite: string;
  entite_id: string | null; details: Record<string, unknown> | null; created_at: string;
};
export type Parametre = {
  id: string; cle: string; valeur: Record<string, unknown> | null;
  description: string | null; updated_at: string;
};
export type ContactRequest = {
  id: string; first_name: string | null; last_name: string | null; email: string | null;
  phone: string | null; company: string | null; request_type: string | null; message: string | null;
  source: string | null; status: string; contact_id: string | null; created_at: string;
};
export type PageView = {
  id: string; path: string; visitor_id: string | null; referrer: string | null; created_at: string;
};

// ─── Module Qualiopi (justificatifs & preuves d'audit) ───────────────────────
export type QualiopiApplicable = 'oui' | 'si_certifiante' | 'non_applicable';
export type QualiopiNiveau = 'organisme' | 'dossier' | 'mixte';
export type QualiopiConformite = 'conforme' | 'a_completer' | 'non_applicable' | 'a_verifier';
export type QualiopiDocStatut = 'a_generer' | 'genere' | 'envoye' | 'signe' | 'recu' | 'valide' | 'non_applicable';
export type QuestionnaireStatut = 'a_envoyer' | 'envoye' | 'relance' | 'repondu' | 'expire';

export type QualiopiCritere = { numero: number; libelle: string };
export type QualiopiIndicateur = {
  numero: number; critere: number; intitule: string;
  applicable: QualiopiApplicable; niveau: QualiopiNiveau;
  preuves_attendues: string | null; nouvel_entrant: boolean;
  statut: QualiopiConformite; commentaire: string | null; updated_at: string;
};
export type QualiopiPreuveDocument = {
  id: string; indicateur_numero: number; document_id: string; created_at: string;
};
export type QualiopiDossierDoc = Timestamps & {
  id: string; session_id: string; participant_id: string | null;
  indicateur_numero: number | null; type_doc: string; libelle: string;
  statut: QualiopiDocStatut; obligatoire: boolean;
  fichier_url: string | null; genere_at: string | null;
};
export type QuestionnaireModele = {
  code: string; titre: string; description: string | null; moment: string;
  schema: Json; actif: boolean; updated_at: string;
};
export type QuestionnaireEnvoi = {
  id: string; modele_code: string; session_id: string | null;
  participant_id: string | null; contact_id: string | null;
  destinataire_nom: string | null; destinataire_email: string | null;
  token: string; statut: QuestionnaireStatut;
  sent_at: string | null; relance_at: string | null; responded_at: string | null;
  owner_id: string | null; created_at: string;
};
export type QuestionnaireReponse = {
  id: string; envoi_id: string; reponses: Json; note_globale: number | null;
  commentaire: string | null; created_at: string;
};
export type QualiopiModeleDoc = Timestamps & {
  type_doc: string; titre: string; fichier_url: string | null; actif: boolean;
};

type TableShape<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type EmptyMap = Record<string, never>;

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<Profile>;
      financeurs: TableShape<Financeur>;
      entreprises: TableShape<Entreprise>;
      contacts: TableShape<Contact>;
      opportunites: TableShape<Opportunite>;
      formations: TableShape<Formation>;
      plans_formation: TableShape<PlanFormation>;
      workflows: TableShape<Workflow>;
      workflow_etapes: TableShape<WorkflowEtape>;
      dossiers: TableShape<Dossier>;
      dossier_pieces: TableShape<DossierPiece>;
      dossier_documents: TableShape<DossierDocument>;
      documents: TableShape<Document>;
      kanban_boards: TableShape<KanbanBoard>;
      kanban_colonnes: TableShape<KanbanColonne>;
      kanban_cartes: TableShape<KanbanCarte>;
      emails: TableShape<Email>;
      conversations_closes: TableShape<ConversationClose>;
      conversations: TableShape<Conversation>;
      signatures: TableShape<Signature>;
      emargement_creneaux: TableShape<EmargementCreneau>;
      emargement_acces: TableShape<EmargementAcces>;
      emargement_signatures: TableShape<EmargementSignature>;
      piece_versions: TableShape<PieceVersion>;
      offres_recrutement: TableShape<OffreRecrutement>;
      candidats: TableShape<Candidat>;
      sessions_formation: TableShape<SessionFormation>;
      session_participants: TableShape<SessionParticipant>;
      tickets: TableShape<Ticket>;
      ticket_votes: TableShape<TicketVote>;
      formateurs: TableShape<Formateur>;
      formateur_documents: TableShape<FormateurDocument>;
      plan_pdfs: TableShape<PlanPdf>;
      devis: TableShape<Devis>;
      devis_lignes: TableShape<DevisLigne>;
      blog_articles: TableShape<BlogArticle>;
      blog_categories: TableShape<BlogCategory>;
      contact_actions: TableShape<ContactAction>;
      contact_documents: TableShape<ContactDocument>;
      conseiller_documents: TableShape<ConseillerDocument>;
      candidat_documents: TableShape<CandidatDocument>;
      import_batches: TableShape<ImportBatch>;
      newsletters: TableShape<Newsletter>;
      newsletter_queue: TableShape<NewsletterQueue>;
      audit_log: TableShape<AuditLog>;
      parametres: TableShape<Parametre>;
      contact_requests: TableShape<ContactRequest>;
      page_views: TableShape<PageView>;
      qualiopi_criteres: TableShape<QualiopiCritere>;
      qualiopi_indicateurs: TableShape<QualiopiIndicateur>;
      qualiopi_preuve_document: TableShape<QualiopiPreuveDocument>;
      qualiopi_dossier_docs: TableShape<QualiopiDossierDoc>;
      questionnaire_modeles: TableShape<QuestionnaireModele>;
      questionnaire_envois: TableShape<QuestionnaireEnvoi>;
      questionnaire_reponses: TableShape<QuestionnaireReponse>;
      qualiopi_modeles_doc: TableShape<QualiopiModeleDoc>;
    };
    Views: EmptyMap;
    Functions: {
      qualiopi_prepare_session: { Args: { p_session: string }; Returns: undefined };
    };
    Enums: {
      user_role: UserRole;
      contact_type: ContactType;
      financement_type: FinancementType;
      opportunite_stage: OpportuniteStage;
      dossier_statut: DossierStatut;
      devis_statut: DevisStatut;
      piece_statut: PieceStatut;
      candidat_statut: CandidatStatut;
      plan_statut: PlanStatut;
    };
    CompositeTypes: EmptyMap;
  };
};
