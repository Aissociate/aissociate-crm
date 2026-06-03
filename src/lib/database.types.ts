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
export type ContactType = 'prospect' | 'apprenant' | 'contact_entreprise' | 'contact_financeur';
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
  role: UserRole; telephone: string | null; actif: boolean;
};
export type Financeur = Timestamps & {
  id: string; code: string; nom: string; type: FinancementType;
  specificites: string | null; actif: boolean;
};
export type Entreprise = Timestamps & {
  id: string; raison_sociale: string; siret: string | null; naf: string | null;
  secteur: string | null; effectif: number | null; adresse: string | null;
  code_postal: string | null; ville: string | null; telephone: string | null;
  email: string | null; site_web: string | null; notes: string | null; owner_id: string | null;
};
export type Contact = Timestamps & {
  id: string; type: ContactType; civilite: string | null; nom: string; prenom: string | null;
  email: string | null; telephone: string | null; fonction: string | null;
  entreprise_id: string | null; financeur_id: string | null; owner_id: string | null;
  rgpd_consent: boolean; notes: string | null; external_id: string | null;
  metadata: Record<string, string> | null;
  // Fiche de suivi (qualification / commercial / conformité / commissions)
  statut_entreprise: string | null; ville: string | null; autres: string | null; effectif: string | null;
  besoin_resume: string | null; formation_envisagee: string | null; financement_envisage: string | null; interet: string | null;
  statut_prospect: string | null; responsable_id: string | null;
  date_fixee: string | null; eligibilite_verifiee: boolean; financement_demande: boolean;
  financement_valide: boolean; inscription_validee: boolean;
  date_formation: string | null; assiette_commission: number | null;
  commission_validee: boolean; commission_payee: boolean;
};
export type ContactAction = {
  id: string; contact_id: string; date_action: string; type: string; description: string;
  faite: boolean; auteur_id: string | null; created_at: string;
};
export type Opportunite = Timestamps & {
  id: string; titre: string; contact_id: string | null; entreprise_id: string | null;
  financeur_id: string | null; montant: number; stage: OpportuniteStage;
  probabilite: number; date_cloture_prev: string | null; owner_id: string | null; notes: string | null;
};
export type Formation = Timestamps & {
  id: string; intitule: string; objectifs: string | null; programme: string[];
  prerequis: string | null; public_vise: string | null; duree_heures: number;
  modalite: string; prix: number; actif: boolean;
};
export type PlanFormation = Timestamps & {
  id: string; nom: string; formation_id: string | null; contact_id: string | null;
  entreprise_id: string | null; financeur_id: string | null; objectifs: string | null;
  contenu: string[]; duree_heures: number; modalite: string; statut: PlanStatut;
  version: number; owner_id: string | null;
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
  contenu_texte: string | null; chat_direction: boolean; chat_conseiller: boolean; dossier: string | null;
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
export type PlanPdf = {
  id: string; plan_id: string | null; titre: string; apprenant: string | null;
  organisme: string | null; fichier_url: string | null; created_by: string | null; created_at: string;
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
      documents: TableShape<Document>;
      kanban_boards: TableShape<KanbanBoard>;
      kanban_colonnes: TableShape<KanbanColonne>;
      kanban_cartes: TableShape<KanbanCarte>;
      emails: TableShape<Email>;
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
      contact_actions: TableShape<ContactAction>;
      audit_log: TableShape<AuditLog>;
      parametres: TableShape<Parametre>;
    };
    Views: EmptyMap;
    Functions: EmptyMap;
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
