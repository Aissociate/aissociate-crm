// @ts-nocheck
import { supabase } from './supabase';
import type {
  Tenant,
  UserQualiopi,
  Trainee,
  Training,
  Session,
  SessionTrainee,
  Template,
  QuestionnaireTemplate,
  QuestionnaireLink,
  QuestionnaireResponse,
  EmailTemplate,
  EmailSendLog,
  Task,
  AuditLog,
  DocumentOriginal
} from '../types/qualiopi';

export class QualiopiClient {
  private async logAudit(
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Record<string, any>
  ) {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('audit_logs').insert({
      actor_user_id: user?.id,
      actor_type: 'HUMAN',
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata_json: metadata || {}
    });
  }

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('users_qualiopi')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    return data as UserQualiopi | null;
  }

  async getCurrentTenant() {
    const user = await this.getCurrentUser();
    if (!user?.tenant_id) return null;

    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', user.tenant_id)
      .maybeSingle();

    return data as Tenant | null;
  }

  async getTrainees() {
    const { data, error } = await supabase
      .from('trainees')
      .select('*')
      .order('last_name', { ascending: true });

    if (error) throw error;
    return data as Trainee[];
  }

  async createTrainee(trainee: Omit<Trainee, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) {
    const tenant = await this.getCurrentTenant();
    if (!tenant) throw new Error('No tenant found');

    const { data, error } = await supabase
      .from('trainees')
      .insert({ ...trainee, tenant_id: tenant.id })
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('CREATE', 'trainee', data.id, { trainee });

    return data as Trainee;
  }

  async updateTrainee(id: string, updates: Partial<Trainee>) {
    const { data, error } = await supabase
      .from('trainees')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('UPDATE', 'trainee', id, { updates });

    return data as Trainee;
  }

  async getTrainings() {
    const { data, error } = await supabase
      .from('trainings')
      .select(`
        *,
        program_document:document_originals(*)
      `)
      .order('title', { ascending: true });

    if (error) throw error;
    return data as Training[];
  }

  async createTraining(training: Omit<Training, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) {
    const tenant = await this.getCurrentTenant();
    if (!tenant) throw new Error('No tenant found');

    const { data, error } = await supabase
      .from('trainings')
      .insert({ ...training, tenant_id: tenant.id })
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('CREATE', 'training', data.id, { training });

    return data as Training;
  }

  async deleteTraining(id: string) {
    const { error } = await supabase
      .from('trainings')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await this.logAudit('DELETE', 'training', id);
  }

  async getSessions() {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        training:trainings(*)
      `)
      .order('start_date', { ascending: false });

    if (error) throw error;
    return data as Session[];
  }

  async getSession(id: string) {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        training:trainings(*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as Session | null;
  }

  async createSession(session: Omit<Session, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) {
    const tenant = await this.getCurrentTenant();
    if (!tenant) throw new Error('No tenant found');

    const { data, error } = await supabase
      .from('sessions')
      .insert({ ...session, tenant_id: tenant.id })
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('CREATE', 'session', data.id, { session });

    return data as Session;
  }

  async getSessionTrainees(sessionId: string) {
    const { data, error } = await supabase
      .from('session_trainees')
      .select(`
        *,
        trainee:trainees(*)
      `)
      .eq('session_id', sessionId);

    if (error) throw error;
    return data;
  }

  async addTraineeToSession(sessionId: string, traineeId: string) {
    const { data, error } = await supabase
      .from('session_trainees')
      .insert({ session_id: sessionId, trainee_id: traineeId })
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('ADD_TRAINEE_TO_SESSION', 'session', sessionId, { traineeId });

    return data as SessionTrainee;
  }

  async removeTraineeFromSession(sessionId: string, traineeId: string) {
    const { error } = await supabase
      .from('session_trainees')
      .delete()
      .eq('session_id', sessionId)
      .eq('trainee_id', traineeId);

    if (error) throw error;

    await this.logAudit('REMOVE_TRAINEE_FROM_SESSION', 'session', sessionId, { traineeId });
  }

  async getTemplates(docType?: string) {
    let query = supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (docType) {
      query = query.eq('doc_type', docType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Template[];
  }

  async createTemplate(template: Omit<Template, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) {
    const tenant = await this.getCurrentTenant();
    const user = await this.getCurrentUser();
    if (!tenant) throw new Error('No tenant found');

    const { data, error } = await supabase
      .from('templates')
      .insert({
        ...template,
        tenant_id: tenant.id,
        created_by: user?.id
      })
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('CREATE', 'template', data.id, { template });

    return data as Template;
  }

  async publishTemplate(id: string) {
    const user = await this.getCurrentUser();

    const { data, error } = await supabase
      .from('templates')
      .update({
        status: 'PUBLISHED',
        validated_by: user?.id,
        validated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('PUBLISH', 'template', id);

    return data as Template;
  }

  async uploadDocument(file: File, docType: string) {
    const tenant = await this.getCurrentTenant();
    const user = await this.getCurrentUser();
    if (!tenant) throw new Error('No tenant found');

    const fileName = `${tenant.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('qualiopi-documents')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('qualiopi-documents')
      .getPublicUrl(fileName);

    const { data, error } = await supabase
      .from('document_originals')
      .insert({
        tenant_id: tenant.id,
        filename: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
        doc_type: docType,
        uploaded_by: user?.id
      })
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('UPLOAD', 'document_original', data.id, { filename: file.name });

    return data as DocumentOriginal;
  }

  async getQuestionnaireTemplates() {
    const { data, error } = await supabase
      .from('questionnaire_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as QuestionnaireTemplate[];
  }

  async createQuestionnaireTemplate(template: Omit<QuestionnaireTemplate, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) {
    const tenant = await this.getCurrentTenant();
    const user = await this.getCurrentUser();
    if (!tenant) throw new Error('No tenant found');

    const { data, error } = await supabase
      .from('questionnaire_templates')
      .insert({
        ...template,
        tenant_id: tenant.id,
        created_by: user?.id
      })
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('CREATE', 'questionnaire_template', data.id);

    return data as QuestionnaireTemplate;
  }

  async createQuestionnaireLink(
    questionnaireTemplateId: string,
    sessionId: string,
    traineeId: string
  ) {
    const tenant = await this.getCurrentTenant();
    if (!tenant) throw new Error('No tenant found');

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    const { data, error } = await supabase
      .from('questionnaire_links')
      .insert({
        tenant_id: tenant.id,
        questionnaire_template_id: questionnaireTemplateId,
        session_id: sessionId,
        trainee_id: traineeId,
        token,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('CREATE', 'questionnaire_link', data.id, {
      questionnaireTemplateId,
      sessionId,
      traineeId
    });

    return data as QuestionnaireLink;
  }

  async getQuestionnaireByToken(token: string) {
    const { data: link, error: linkError } = await supabase
      .from('questionnaire_links')
      .select(`
        *,
        questionnaire_template:questionnaire_templates(*),
        session:sessions(*),
        trainee:trainees(*)
      `)
      .eq('token', token)
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link) return null;

    const { data: response } = await supabase
      .from('questionnaire_responses')
      .select('*')
      .eq('questionnaire_link_id', link.id)
      .maybeSingle();

    return { link, response };
  }

  async submitQuestionnaireResponse(linkId: string, answers: Record<string, any>) {
    const { data: link } = await supabase
      .from('questionnaire_links')
      .select('tenant_id')
      .eq('id', linkId)
      .maybeSingle();

    if (!link) throw new Error('Link not found');

    const { data, error } = await supabase
      .from('questionnaire_responses')
      .insert({
        tenant_id: link.tenant_id,
        questionnaire_link_id: linkId,
        answers_json: answers
      })
      .select()
      .single();

    if (error) throw error;

    return data as QuestionnaireResponse;
  }

  async getEmailTemplates() {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('purpose', { ascending: true });

    if (error) throw error;
    return data as EmailTemplate[];
  }

  async getEmailLogs(sessionId?: string) {
    let query = supabase
      .from('email_send_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as EmailSendLog[];
  }

  async getTasks(status?: string) {
    let query = supabase
      .from('tasks')
      .select('*')
      .order('run_at', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Task[];
  }

  async getAuditLogs(limit = 100) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as AuditLog[];
  }
}

export const qualiopiClient = new QualiopiClient();
