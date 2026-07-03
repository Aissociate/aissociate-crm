import type {
  QualiopiApplicable, QualiopiConformite, QualiopiDocStatut, QuestionnaireStatut,
} from './database.types';
import type { Tone } from '@/components/ui';

export const APPLICABLE_LABELS: Record<QualiopiApplicable, string> = {
  oui: 'Applicable',
  si_certifiante: 'Si certifiante',
  non_applicable: 'Non applicable',
};

export const CONFORMITE_LABELS: Record<QualiopiConformite, string> = {
  conforme: 'Conforme',
  a_completer: 'À compléter',
  non_applicable: 'Non applicable',
  a_verifier: 'À vérifier',
};

export const CONFORMITE_TONES: Record<QualiopiConformite, Tone> = {
  conforme: 'success',
  a_completer: 'warning',
  non_applicable: 'neutral',
  a_verifier: 'info',
};

export const DOC_STATUT_LABELS: Record<QualiopiDocStatut, string> = {
  a_generer: 'À générer',
  genere: 'Généré',
  envoye: 'Envoyé',
  signe: 'Signé',
  recu: 'Reçu',
  valide: 'Validé',
  non_applicable: 'Non applicable',
};

export const DOC_STATUT_TONES: Record<QualiopiDocStatut, Tone> = {
  a_generer: 'neutral',
  genere: 'info',
  envoye: 'warning',
  signe: 'brand',
  recu: 'warning',
  valide: 'success',
  non_applicable: 'neutral',
};

export const QUESTIONNAIRE_STATUT_LABELS: Record<QuestionnaireStatut, string> = {
  a_envoyer: 'À envoyer',
  envoye: 'Envoyé',
  relance: 'Relancé',
  repondu: 'Répondu',
  expire: 'Expiré',
};

export const QUESTIONNAIRE_STATUT_TONES: Record<QuestionnaireStatut, Tone> = {
  a_envoyer: 'neutral',
  envoye: 'warning',
  relance: 'warning',
  repondu: 'success',
  expire: 'danger',
};

export const MOMENT_LABELS: Record<string, string> = {
  debut: 'Début (positionnement)',
  fin: 'Fin (à chaud)',
  froid: 'À froid (3-6 mois)',
  autre: 'Ponctuel',
};

/** Types de documents générables automatiquement (dossier de formation). */
export const GENERABLE_DOC_TYPES = new Set([
  'convention', 'convocation', 'livret_accueil', 'attestation_fin',
  'certificat_realisation', 'emargement', 'livret_suivi',
]);

/** Un envoi de questionnaire correspond à ce type de doc-preuve. */
export const QUESTIONNAIRE_DOC_TYPES: Record<string, string> = {
  positionnement: 'positionnement',
  chaud: 'questionnaire_chaud',
  froid: 'questionnaire_froid',
};
