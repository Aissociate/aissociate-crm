import type {
  UserRole, ContactType, DossierStatut, OpportuniteStage,
  PieceStatut, CandidatStatut, PlanStatut,
} from './database.types';
import type { Tone } from '@/components/ui';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  directeur_commercial: 'Directeur commercial',
  conseiller: 'Conseiller',
};

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  prospect: 'Prospect',
  contact: 'Contact',
  apprenant: 'Apprenant',
  contact_entreprise: 'Contact entreprise',
  contact_financeur: 'Contact financeur',
  formateur: 'Formateur / chargé de formation',
  encadrement: 'Encadrement',
};

export const DOSSIER_STATUT_LABELS: Record<DossierStatut, string> = {
  brouillon: 'Brouillon',
  montage: 'En montage',
  depose: 'Déposé',
  en_instruction: 'En instruction',
  accorde: 'Accordé',
  refuse: 'Refusé',
  en_cours: 'En cours',
  solde: 'Soldé',
  cloture: 'Clôturé',
};

// Tons sémantiques (cf. composant Badge) — un seul vocabulaire de couleurs, dark-mode-safe.
export const DOSSIER_STATUT_TONES: Record<DossierStatut, Tone> = {
  brouillon: 'neutral',
  montage: 'info',
  depose: 'warning',
  en_instruction: 'warning',
  accorde: 'success',
  refuse: 'danger',
  en_cours: 'brand',
  solde: 'success',
  cloture: 'neutral',
};

export const OPP_STAGE_LABELS: Record<OpportuniteStage, string> = {
  nouveau: 'Nouveau',
  qualifie: 'Qualifié',
  proposition: 'Proposition',
  negociation: 'Négociation',
  gagne: 'Gagné',
  perdu: 'Perdu',
};

export const OPP_STAGE_ORDER: OpportuniteStage[] = [
  'nouveau', 'qualifie', 'proposition', 'negociation', 'gagne', 'perdu',
];

export const PIECE_STATUT_LABELS: Record<PieceStatut, string> = {
  manquante: 'Manquante',
  recue: 'Reçue',
  validee: 'Validée',
  rejetee: 'Rejetée',
};

export const PIECE_STATUT_TONES: Record<PieceStatut, Tone> = {
  manquante: 'neutral',
  recue: 'warning',
  validee: 'success',
  rejetee: 'danger',
};

export const CANDIDAT_STATUT_LABELS: Record<CandidatStatut, string> = {
  recu: 'CV reçu',
  preselection: 'Présélection',
  entretien: 'Entretien',
  retenu: 'Retenu',
  refuse: 'Refusé',
  onboarding: 'Onboarding',
};

export const PLAN_STATUT_LABELS: Record<PlanStatut, string> = {
  brouillon: 'Brouillon',
  valide: 'Validé',
  envoye: 'Envoyé',
  archive: 'Archivé',
};

export const MODALITES = ['presentiel', 'distanciel', 'mixte', 'e-learning'] as const;
