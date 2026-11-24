// Paramètres — forme des réglages enregistrés dans la table `parametres` (une clé par bloc).

export type Organisme = {
  nom?: string; qualiopi?: string; email?: string; telephone?: string; adresse?: string;
  code_postal?: string; ville?: string; siret?: string; nda?: string; tva_intra?: string;
  forme_juridique?: string; capital?: string; logo_url?: string; signature_url?: string; naf?: string; pays?: string;
};
export type Smtp = { host?: string; port?: number; secure?: boolean; user?: string; from?: string; password?: string };
export type Imap = { host?: string; port?: number; user?: string; password?: string };
export type Ai = { provider?: string; model?: string; model_plan?: string; model_resume?: string; model_agent?: string; model_stt?: string; openrouter_key?: string; plan_prompt?: string };
export type MailActionsCfg = { enabled?: boolean; resume_ia?: boolean; max_par_passage?: number };
export type AgeficeCfg = {
  demande_url?: string; prefet_region?: string;
  responsable_civilite?: string; responsable_nom?: string; responsable_prenom?: string;
  responsable_qualite?: string; responsable_tel?: string; responsable_email?: string;
};
export type Droits = {
  documents?: boolean; contacts?: boolean; dossiers?: boolean; formations?: boolean;
  pipeline?: boolean; entreprises?: boolean; devis?: boolean; agenda?: boolean;
  recrutement?: boolean; leads?: boolean; finances?: boolean; scope?: string;
};
export type Chatbot = { prompt_direction?: string; prompt_conseiller?: string; droits?: { conseiller?: Droits; direction?: Droits } };
export type Blog = {
  prompt?: string; themes?: string[]; auto_publish?: boolean; use_web?: boolean;
  rss_feeds?: string[]; seo_keywords?: string[]; image_model?: string;
  image_provider?: 'openrouter' | 'kie'; kie_api_key?: string;
  kie_quality?: 'basic' | 'high'; kie_aspect_ratio?: string;
};

export const KIE_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16', '2:3', '3:2', '21:9'];
export type LinkedinCfg = { enabled?: boolean; client_id?: string; client_secret?: string; access_token?: string; org_urn?: string; org_name?: string; expires_at?: string; refresh_token?: string; refresh_expires_at?: string; connected_at?: string };
export const LINKEDIN_REDIRECT_URI = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/linkedin-oauth`;
export type MetaAds = {
  enabled?: boolean; ad_account_id?: string; access_token?: string; api_version?: string;
  // Import direct des prospects des formulaires (Edge Function meta-leads)
  leads_page_id?: string; leads_page_token?: string; leads_form_ids?: string;
};
export type NewsletterCfg = { auto_send?: boolean; rgpd_only?: boolean; sender_name?: string; intro?: string };
export type BrevoCfg = { api_key?: string; sender_email?: string; sender_name?: string; daily_limit?: number };
// SignatureCfg importé depuis @/lib/signature

// Domaines de contexte de l'assistant IA. `defaut` = accès si la case n'a
// jamais été touchée (aligné sur l'Edge Function chatbot) ; recrutement et
// leads sont réservés à la direction quoi qu'il arrive.
export const DROIT_LABELS: { key: keyof Droits; label: string; directionOnly?: boolean; defautConseiller?: boolean }[] = [
  { key: 'documents', label: 'Base documentaire', defautConseiller: true },
  { key: 'contacts', label: 'Contacts', defautConseiller: true },
  { key: 'entreprises', label: 'Entreprises', defautConseiller: true },
  { key: 'pipeline', label: 'Pipeline (opportunités)', defautConseiller: true },
  { key: 'dossiers', label: 'Dossiers', defautConseiller: true },
  { key: 'devis', label: 'Devis', defautConseiller: true },
  { key: 'formations', label: 'Catalogue formations', defautConseiller: true },
  { key: 'agenda', label: 'Sessions & formateurs', defautConseiller: true },
  { key: 'recrutement', label: 'Recrutement', directionOnly: true },
  { key: 'leads', label: 'Leads du site', directionOnly: true },
  { key: 'finances', label: 'Informations financières', defautConseiller: false },
];

/** Ce dont chaque carte a besoin pour enregistrer son bloc et afficher « Enregistré ✓ ». */
export type Sauvegarde = {
  persist: (cle: string, valeur: Record<string, unknown>) => Promise<void>;
  /** Clé en cours d'enregistrement. */
  saving: string | null;
  /** Clé qui vient d'être enregistrée (affichée 2 secondes). */
  savedMsg: string | null;
};
