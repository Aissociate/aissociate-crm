// @ts-nocheck
export type UserRole = 'ADMIN_SAAS' | 'ADMIN_OF' | 'GESTIONNAIRE' | 'FORMATEUR' | 'STAGIAIRE';

export type TemplateStatus = 'DRAFT' | 'PUBLISHED';

export type DocType = 'QUOTE' | 'CONVENTION' | 'CONVOCATION' | 'ATTESTATION' | 'QUESTIONNAIRE' | 'EMAIL' | 'OTHER';

export type SessionModality = 'PRESENTIEL' | 'DISTANCIEL' | 'HYBRIDE';

export type QuestionnaireType = 'HOT' | 'COLD' | 'CUSTOM';

export type EmailPurpose = 'HOT_INVITE' | 'COLD_INVITE' | 'REMINDER' | 'CONVOCATION' | 'CUSTOM';

export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED';

export type TaskType = 'EMAIL_SEND' | 'REMINDER' | 'PDF_GENERATION' | 'EXPORT';

export type TaskStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export type ActorType = 'HUMAN' | 'SYSTEM';

export interface Tenant {
  id: string;
  name: string;
  siret?: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  settings_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UserQualiopi {
  id: string;
  tenant_id?: string;
  role: UserRole;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  auth_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Trainee {
  id: string;
  tenant_id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  meta_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Training {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  duration_days: number;
  version: string;
  program_document_id?: string;
  program_document?: DocumentOriginal;
  meta_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  tenant_id: string;
  training_id: string;
  start_date: string;
  end_date: string;
  modality: SessionModality;
  trainer_name?: string;
  location?: string;
  max_capacity?: number;
  meta_json: Record<string, any>;
  created_at: string;
  updated_at: string;
  training?: Training;
}

export interface SessionTrainee {
  id: string;
  session_id: string;
  trainee_id: string;
  enrolled_at: string;
  status: string;
}

export interface DocumentOriginal {
  id: string;
  tenant_id: string;
  filename: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  doc_type: DocType;
  extracted_text?: string;
  uploaded_by?: string;
  created_at: string;
}

export interface Template {
  id: string;
  tenant_id: string;
  name: string;
  doc_type: DocType;
  status: TemplateStatus;
  version: string;
  template_json: Record<string, any>;
  preview_html?: string;
  created_by?: string;
  validated_by?: string;
  validated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GeneratedDocument {
  id: string;
  tenant_id: string;
  template_id?: string;
  session_id?: string;
  trainee_id?: string;
  file_url: string;
  file_size?: number;
  generated_data: Record<string, any>;
  created_at: string;
}

export interface QuestionnaireTemplate {
  id: string;
  tenant_id: string;
  name: string;
  type: QuestionnaireType;
  status: TemplateStatus;
  version: string;
  schema_json: QuestionnaireSchema;
  created_by?: string;
  validated_by?: string;
  validated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireSchema {
  title: string;
  description?: string;
  sections: QuestionnaireSection[];
}

export interface QuestionnaireSection {
  title: string;
  questions: QuestionnaireQuestion[];
}

export interface QuestionnaireQuestion {
  id: string;
  type: 'likert' | 'text' | 'yesno' | 'multiple_choice';
  question: string;
  required: boolean;
  scale?: number;
  multiline?: boolean;
  options?: string[];
  conditional?: {
    dependsOn: string;
    showIf: any;
  };
}

export interface QuestionnaireLink {
  id: string;
  tenant_id: string;
  questionnaire_template_id: string;
  session_id: string;
  trainee_id: string;
  token: string;
  expires_at?: string;
  sent_at?: string;
  opened_at?: string;
  created_at: string;
}

export interface QuestionnaireResponse {
  id: string;
  tenant_id: string;
  questionnaire_link_id: string;
  answers_json: Record<string, any>;
  submitted_at: string;
}

export interface EmailTemplate {
  id: string;
  tenant_id: string;
  name: string;
  purpose: EmailPurpose;
  subject: string;
  body: string;
  status: TemplateStatus;
  version: string;
  created_at: string;
  updated_at: string;
}

export interface EmailSendLog {
  id: string;
  tenant_id: string;
  to_email: string;
  subject: string;
  body_snapshot: string;
  provider_msg_id?: string;
  status: EmailStatus;
  error?: string;
  session_id?: string;
  trainee_id?: string;
  created_at: string;
  sent_at?: string;
}

export interface Task {
  id: string;
  tenant_id: string;
  type: TaskType;
  payload_json: Record<string, any>;
  status: TaskStatus;
  run_at: string;
  executed_at?: string;
  error?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id?: string;
  actor_user_id?: string;
  actor_type: ActorType;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata_json: Record<string, any>;
  created_at: string;
}

export interface AIAnalysisResult {
  doc_type: DocType;
  fields_detected: Array<{
    key: string;
    label: string;
    guessedType: string;
    example?: string;
    confidence: number;
  }>;
  sections: Array<{
    title: string;
    contentSnippet: string;
  }>;
  placeholders: Array<{
    placeholder: string;
    mappedTo: string;
    required: boolean;
  }>;
  missing_fields: Array<{
    key: string;
    reason: string;
  }>;
  suggested_template: {
    format: string;
    html: string;
    rules: any[];
  };
}
