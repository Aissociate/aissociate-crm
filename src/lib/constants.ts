import type {
  UserRole, ContactType, DossierStatut, OpportuniteStage,
  PieceStatut, CandidatStatut, PlanStatut,
} from './database.types';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  directeur_commercial: 'Directeur commercial',
  conseiller: 'Conseiller',
};

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  prospect: 'Prospect',
  apprenant: 'Apprenant',
  contact_entreprise: 'Contact entreprise',
  contact_financeur: 'Contact financeur',
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

export const DOSSIER_STATUT_COLORS: Record<DossierStatut, string> = {
  brouillon: 'bg-slate-100 text-slate-700',
  montage: 'bg-blue-100 text-blue-700',
  depose: 'bg-amber-100 text-amber-700',
  en_instruction: 'bg-amber-100 text-amber-700',
  accorde: 'bg-emerald-100 text-emerald-700',
  refuse: 'bg-red-100 text-red-700',
  en_cours: 'bg-indigo-100 text-indigo-700',
  solde: 'bg-teal-100 text-teal-700',
  cloture: 'bg-slate-200 text-slate-600',
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

export const PIECE_STATUT_COLORS: Record<PieceStatut, string> = {
  manquante: 'bg-slate-100 text-slate-600',
  recue: 'bg-amber-100 text-amber-700',
  validee: 'bg-emerald-100 text-emerald-700',
  rejetee: 'bg-red-100 text-red-700',
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
