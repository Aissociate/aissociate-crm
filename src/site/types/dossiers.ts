// @ts-nocheck
export interface Dossier {
  id: string;
  company: string;
  contact_first_name: string;
  contact_last_name: string;
  contact_function: string;
  phone: string;
  email: string;
  sector: string;
  size: string;
  fixer_id: string;
  closer_id: string | null;
  status: DossierStatus;
  source: string;
  product_type: 'marche_public' | 'formations_ia';
  created_at: string;
  last_activity: string;
  initial_call_date: string | null;
  prospect_response: boolean | null;
  rdv_date: string | null;
  show_up: boolean | null;
  fixer_notes: string;
  call_duration_minutes: number;
  cpf_amount: number;
  complementary_funding_type: string;
  complementary_funding_amount: number;
  financing_mode: string;
  personal_funding_amount: number;
  rdv_closer_date: string | null;
  decision: string | null;
  objections: string;
  lead_quality: number | null;
  next_step_date: string | null;
  next_step_action: string;
  closer_notes: string;
  cart_value: number;
  related_clients_count: number;
  formation_done: boolean;
  formation_end_date: string | null;
  expected_payment_date: string | null;
  paid: boolean;
  amount: number;
  dispute: boolean;
  dispute_reason: string;
  is_rappel: boolean;
  rappel_date: string | null;
  rappel_notes: string;
  quote_sent: boolean;
  quote_sent_date: string | null;
  quote_accepted: boolean;
  quote_accepted_date: string | null;
  payment_requested: boolean;
  payment_requested_date: string | null;
  payment_received: boolean;
  payment_received_date: string | null;
  updated_at: string;
}

export type DossierStatus =
  | 'à_contacter'
  | 'contacté_pas_réponse'
  | 'contacté_conversation'
  | 'rdv_closer_planifié'
  | 'rdv_closer_tenu'
  | 'décision_oui'
  | 'décision_non'
  | 'formation_planifiée'
  | 'formation_réalisée'
  | 'attente_encaissement'
  | 'encaissé'
  | 'litige';

export const DOSSIER_STATUSES: { value: DossierStatus; label: string; color: string }[] = [
  { value: 'à_contacter', label: 'À contacter', color: 'bg-slate-100 text-slate-700' },
  { value: 'contacté_pas_réponse', label: 'Contacté - pas de réponse', color: 'bg-amber-100 text-amber-700' },
  { value: 'contacté_conversation', label: 'Contacté - conversation', color: 'bg-blue-100 text-blue-700' },
  { value: 'rdv_closer_planifié', label: 'RDV closer planifié', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'rdv_closer_tenu', label: 'RDV closer tenu', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'décision_oui', label: 'Décision : Oui', color: 'bg-green-100 text-green-700' },
  { value: 'décision_non', label: 'Décision : Non', color: 'bg-red-100 text-red-700' },
  { value: 'formation_planifiée', label: 'Formation planifiée', color: 'bg-purple-100 text-purple-700' },
  { value: 'formation_réalisée', label: 'Formation réalisée', color: 'bg-violet-100 text-violet-700' },
  { value: 'attente_encaissement', label: 'En attente encaissement (J+30)', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'encaissé', label: 'Encaissé ✓', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'litige', label: 'Litige ⛔', color: 'bg-red-200 text-red-800' },
];

export const SOURCES = [
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'recommandation', label: 'Recommandation' },
  { value: 'other', label: 'Autre' },
];

export const COMPLEMENTARY_FUNDING_TYPES = [
  { value: '', label: 'Aucun' },
  { value: 'pole_emploi', label: 'Pôle Emploi' },
  { value: 'opco', label: 'OPCO' },
  { value: 'agefice', label: 'AGEFICE' },
  { value: 'autre', label: 'Autre' },
];

export const FINANCING_MODES = [
  { value: '', label: 'Non défini' },
  { value: 'cpf', label: 'CPF' },
  { value: 'opco', label: 'OPCO' },
  { value: 'pole_emploi', label: 'Pôle Emploi' },
  { value: 'employeur', label: 'Employeur' },
  { value: 'personnel', label: 'Personnel' },
  { value: 'mixte', label: 'Mixte' },
  { value: 'autre', label: 'Autre' },
];

export const DECISIONS = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
  { value: 'plus_tard', label: 'Plus tard' },
];

export interface Objective {
  id: string;
  profile_id: string;
  month: string;
  year: number;
  clients_paid_target: number;
  show_up_rate_target: number;
  quality_score_target: number;
  closing_rate_target: number;
  created_at: string;
  updated_at: string;
}

export interface Bonus {
  id: string;
  profile_id: string;
  tier_1_clients: number;
  tier_1_amount: number;
  tier_2_clients: number;
  tier_2_amount: number;
  tier_3_clients: number;
  tier_3_amount: number;
  min_show_up_rate: number;
  min_quality_score: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  profile_id: string;
  type: string;
  title: string;
  message: string;
  dossier_id: string | null;
  read: boolean;
  created_at: string;
}

export interface FixerKPIs {
  responseRate: number;
  showUpRate: number;
  conversionToRDV: number;
  conversionToEncaissement: number;
  avgQuality: number;
  clientsPaid: number;
  rdvPlanned: number;
  rdvHeld: number;
}

export interface FixerKPITargets {
  id: string;
  profile_id: string | null;
  call_duration_hours: number;
  calls_per_hour: number;
  calls_per_day: number;
  calls_per_week: number;
  pickup_rate: number;
  rdv_rate: number;
  show_rate: number;
  prospects_per_call: number;
  monthly_prospects: number;
  avg_lead_quality: number;
  created_at: string;
  updated_at: string;
}

export interface CloserKPIs {
  closingRate: number;
  rdvPerClient: number;
  avgAmount: number;
  disputeRate: number;
  clientsPaid: number;
  rdvHeld: number;
  avgQuality: number;
}

export function getStatusLabel(status: DossierStatus): string {
  return DOSSIER_STATUSES.find(s => s.value === status)?.label || status;
}

export function getStatusColor(status: DossierStatus): string {
  return DOSSIER_STATUSES.find(s => s.value === status)?.color || 'bg-slate-100 text-slate-700';
}

export function getEditableStatusesByRole(role: 'fixer' | 'closer' | 'admin'): DossierStatus[] {
  if (role === 'admin') {
    return DOSSIER_STATUSES.map(s => s.value);
  }

  if (role === 'fixer') {
    return [
      'à_contacter',
      'contacté_pas_réponse',
      'contacté_conversation',
      'rdv_closer_planifié'
    ];
  }

  if (role === 'closer') {
    return [
      'rdv_closer_planifié',
      'rdv_closer_tenu',
      'décision_oui',
      'décision_non',
      'formation_planifiée'
    ];
  }

  return [];
}

export function canEditStatus(role: 'fixer' | 'closer' | 'admin', status: DossierStatus): boolean {
  const editableStatuses = getEditableStatusesByRole(role);
  return editableStatuses.includes(status);
}

export function getFullName(dossier: Dossier): string {
  return `${dossier.contact_first_name} ${dossier.contact_last_name}`.trim();
}

export interface RelatedContact {
  id: string;
  dossier_id: string;
  first_name: string;
  last_name: string;
  function: string;
  phone: string;
  email: string;
  relationship: string;
  notes: string;
  status: string;
  created_at: string;
  created_by: string | null;
}

export const CONTACT_STATUSES = [
  { value: 'à_contacter', label: 'À contacter' },
  { value: 'contacté', label: 'Contacté' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'client', label: 'Client' },
];

export interface CrmCompany {
  id: string;
  raison_social: string;
  activite: string;
  adresse: string;
  city: string;
  postal_code: string;
  description: string;
  commentaires: string;
  imported_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmContact {
  id: string;
  company_id: string;
  nom: string;
  prenom: string;
  email: string;
  commentaires: string;
  created_at: string;
}

export interface CrmPhone {
  id: string;
  contact_id: string;
  phone_number: string;
  label: string;
  created_at: string;
}

export const CRM_FIELD_DEFINITIONS = [
  { key: 'raison_social', label: 'Raison sociale', group: 'company', required: true },
  { key: 'activite', label: 'Activite', group: 'company', required: false },
  { key: 'adresse', label: 'Adresse', group: 'company', required: false },
  { key: 'city', label: 'Ville', group: 'company', required: false },
  { key: 'postal_code', label: 'Code postal', group: 'company', required: false },
  { key: 'description', label: 'Description', group: 'company', required: false },
  { key: 'commentaires', label: 'Commentaires', group: 'company', required: false },
  { key: 'nom', label: 'Nom', group: 'contact', required: false },
  { key: 'prenom', label: 'Prenom', group: 'contact', required: false },
  { key: 'tel_0', label: 'Telephone 1', group: 'phone', required: false },
  { key: 'tel_1', label: 'Telephone 2', group: 'phone', required: false },
  { key: 'tel_2', label: 'Telephone 3', group: 'phone', required: false },
  { key: 'tel_3', label: 'Telephone 4', group: 'phone', required: false },
] as const;

export type CrmFieldKey = typeof CRM_FIELD_DEFINITIONS[number]['key'];
