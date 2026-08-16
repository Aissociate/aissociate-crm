import { useState, useEffect } from 'react';
import { Mail, Send, Paperclip, MessageCircle, Upload, X, Loader as Loader2 } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button, Modal, Field } from '@/components/ui';
import { uploadFile } from '@/lib/storage';
import { fullName, prochaineHeureOuvrable } from '@/lib/utils';
import { buildSignatureHtml, signatureSummary, type SignatureCfg, type OrganismeInfo } from '@/lib/signature';
import { linkifyHtml } from '@/lib/linkify';
import { applyTemplateVars, templatesForCanal, DEFAULT_TEMPLATES, type MessageTemplate, type TemplateVars } from '@/lib/messageTemplates';
import type { Dossier, Document, Contact, EmailCanal } from '@/lib/database.types';

type SmtpCfg = { host?: string; user?: string; password?: string; from?: string };
type Attachment = { filename: string; url: string };

// Valeurs de pré-remplissage à l'ouverture (réinitialisées à chaque ouverture).
export type ComposeInitial = {
  canal?: EmailCanal;
  dest?: string;       // e-mails séparés par virgule, ou numéro WhatsApp
  sujet?: string;
  corps?: string;
  dossierId?: string;
  contactId?: string | null;  // pour rattacher le message au contact (table emails)
  draftId?: string | null;    // reprise d'un brouillon existant : on met à jour la ligne au lieu d'en créer une
  attachments?: Attachment[]; // PJ déjà associées au brouillon repris
};

const digits = (s: string | null): string => (s ?? '').replace(/[^\d]/g, '');
const pad2 = (n: number) => String(n).padStart(2, '0');
// Date « YYYY-MM-DD » + heure « HH:MM » locales, pour journaliser une action.
const nowParts = () => {
  const d = new Date();
  return { date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`, heure: `${pad2(d.getHours())}:${pad2(d.getMinutes())}` };
};
const channelIcon = (c: EmailCanal, cls = 'h-4 w-4') => (c === 'whatsapp' ? <MessageCircle className={cls} /> : <Mail className={cls} />);

// Modale de composition e-mail / WhatsApp, partagée entre la Messagerie et la
// fiche contact. Envoi SMTP via la fonction « send-email », journalisation dans
// la table `emails` (mêmes règles que la Messagerie).
export default function ComposeMessageModal({
  open, onClose, onSent, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
  initial?: ComposeInitial;
}) {
  const { session, profile } = useAuth();
  const { data: dossiers } = useCollection<Dossier>('dossiers');
  const { data: contacts } = useCollection<Contact>('contacts');
  const { data: docs } = useCollection<Document>('documents');
  const availableDocs = docs.filter((d) => d.fichier_url);

  const [smtpFrom, setSmtpFrom] = useState<string | null>(null);
  const [organisme, setOrganisme] = useState<OrganismeInfo | null>(null);
  const [signatureCfg, setSignatureCfg] = useState<SignatureCfg | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  useEffect(() => {
    supabase.from('parametres').select('cle, valeur').in('cle', ['smtp', 'organisme', 'email_signature', 'message_templates']).then(({ data }) => {
      (data ?? []).forEach((row) => {
        if (row.cle === 'smtp') setSmtpFrom(((row.valeur ?? {}) as SmtpCfg).from ?? null);
        if (row.cle === 'organisme') setOrganisme((row.valeur ?? {}) as OrganismeInfo);
        if (row.cle === 'email_signature') setSignatureCfg((row.valeur ?? {}) as SignatureCfg);
        if (row.cle === 'message_templates') setTemplates(((row.valeur ?? {}) as { items?: MessageTemplate[] }).items ?? []);
      });
    });
  }, []);

  const [canal, setCanal] = useState<EmailCanal>('email');
  const [dest, setDest] = useState('');
  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');
  const [dossierId, setDossierId] = useState('');
  const [contactId, setContactId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [attachIds, setAttachIds] = useState<Set<string>>(new Set());
  const [extraAttachments, setExtraAttachments] = useState<Attachment[]>([]);
  const [uploadingAttach, setUploadingAttach] = useState(false);
  const [includeSig, setIncludeSig] = useState(true);
  const [saving, setSaving] = useState(false);

  // Réinitialisation à chaque ouverture, depuis les valeurs `initial`.
  useEffect(() => {
    if (!open) return;
    setCanal(initial?.canal ?? 'email');
    setDest(initial?.dest ?? '');
    setSujet(initial?.sujet ?? '');
    setCorps(initial?.corps ?? '');
    setDossierId(initial?.dossierId ?? '');
    setContactId(initial?.contactId ?? null);
    setDraftId(initial?.draftId ?? null);
    setAttachIds(new Set());
    setExtraAttachments(initial?.attachments ?? []);
    setIncludeSig(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleAttach = (id: string) => setAttachIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // PJ libre : téléversement vers le bucket public « documents », URL passée à send-email.
  const handleAttachUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = '';
    if (!files.length) return;
    setUploadingAttach(true);
    for (const file of files) {
      const { value, error } = await uploadFile('documents', file);
      if (error || !value) { alert(`Échec du téléversement de « ${file.name} » : ${error ?? 'inconnu'}`); continue; }
      setExtraAttachments((prev) => [...prev, { filename: file.name, url: value }]);
    }
    setUploadingAttach(false);
  };
  const removeExtraAttachment = (url: string) => setExtraAttachments((prev) => prev.filter((a) => a.url !== url));

  // Journalise l'envoi comme action RÉALISÉE sur le contact lié, pour que le
  // décompte « dernière interaction » (liste Contacts) reparte à zéro, et
  // programme la relance de suivi (ticket « création automatique d'actions »).
  // Pas de résumé IA ici : l'utilisateur vient d'écrire le message lui-même.
  const logInteraction = async (kind: 'email' | 'whatsapp') => {
    if (!contactId) return;
    const { date, heure } = nowParts();
    const suite = prochaineHeureOuvrable();
    await supabase.from('contact_actions').insert([
      {
        contact_id: contactId, date_action: date, heure_action: heure,
        type: kind === 'whatsapp' ? 'autre' : 'email',
        description: kind === 'whatsapp' ? 'WhatsApp envoyé' : `E-mail envoyé${sujet ? ` : ${sujet}` : ''}`,
        faite: true,
      },
      {
        contact_id: contactId, date_action: suite.date, heure_action: suite.heure,
        type: 'appel', faite: false,
        description: `Relance ASAP — vérifier la réponse à « ${sujet || (kind === 'whatsapp' ? 'WhatsApp' : 'message')} »`,
      },
    ]);
  };

  const send = async (statut: 'brouillon' | 'envoye') => {
    setSaving(true);
    const docAttachments = availableDocs.filter((d) => attachIds.has(d.id) && d.fichier_url).map((d) => ({ filename: d.titre, url: d.fichier_url! }));
    const attachments: Attachment[] = [...docAttachments, ...extraAttachments];

    if (canal === 'whatsapp') {
      const phone = digits(dest);
      if (!phone) { setSaving(false); alert('Numéro de téléphone requis pour WhatsApp.'); return; }
      // Ouverture de WhatsApp (web/app) pré-rempli, puis journalisation du message.
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(corps ?? '')}`, '_blank', 'noopener');
      const { error } = await supabase.from('emails').insert({
        destinataires: [dest], sujet: sujet || 'WhatsApp', corps, statut: 'envoye', canal: 'whatsapp',
        direction: 'sortant', expediteur: smtpFrom ?? profile?.email ?? null,
        contact_id: contactId, sent_at: new Date().toISOString(), owner_id: session?.user.id, attachments: [],
      });
      setSaving(false);
      if (error) { alert(error.message); return; }
      await logInteraction('whatsapp');
      onClose(); onSent?.();
      return;
    }

    const destinataires = dest.split(',').map((d) => d.trim()).filter(Boolean);
    let finalStatut = statut;
    if (statut === 'envoye') {
      const sigHtml = includeSig ? buildSignatureHtml(signatureCfg, organisme, profile) : '';
      // Le corps partait en texte nu : les URL restaient inertes chez le destinataire.
      const html = linkifyHtml(corps ?? '') + sigHtml;
      const { error: fnError } = await supabase.functions.invoke('send-email', {
        body: { to: destinataires, subject: sujet, html, text: corps, attachments },
      });
      if (fnError) {
        finalStatut = 'brouillon';
        alert('Envoi SMTP échoué. Vérifiez la configuration SMTP dans Paramètres.\nLe message a été enregistré en brouillon.');
      }
    }
    const row = {
      destinataires, sujet, corps, statut: finalStatut, attachments, canal: 'email' as const,
      expediteur: smtpFrom ?? profile?.email ?? null,
      dossier_id: dossierId || null, contact_id: contactId,
      sent_at: finalStatut === 'envoye' ? new Date().toISOString() : null,
      owner_id: session?.user.id,
    };
    // Reprise d'un brouillon : on met à jour la ligne existante plutôt que d'en
    // créer une seconde (sinon le brouillon initial restait orphelin).
    const { error } = draftId
      ? await supabase.from('emails').update(row).eq('id', draftId)
      : await supabase.from('emails').insert(row);
    setSaving(false);
    if (error) { alert(error.message); return; }
    if (finalStatut === 'envoye') await logInteraction('email');
    onClose(); onSent?.();
  };

  // ── Modèles de messages (réponses rapides) ──
  // Contexte pour les variables {{…}} : contact lié, sinon contact retrouvé par
  // l'adresse e-mail saisie. Variables vides si le contact est inconnu.
  const firstEmail = dest.split(',')[0]?.trim().toLowerCase() ?? '';
  const resolvedContact =
    contacts.find((c) => c.id === contactId) ??
    (firstEmail ? contacts.find((c) => (c.email ?? '').toLowerCase() === firstEmail) : undefined);
  const templateVars: TemplateVars = {
    prenom: resolvedContact?.prenom, nom: resolvedContact?.nom, civilite: resolvedContact?.civilite,
    fonction: resolvedContact?.fonction, formation: resolvedContact?.formation_envisagee,
    conseiller: profile ? fullName(profile.prenom, profile.nom) : '',
    organisme: organisme?.nom ?? '',
  };
  // Modèles configurés, ou modèles par défaut tant qu'aucun n'existe.
  const effectiveTemplates = templates.length ? templates : DEFAULT_TEMPLATES;
  const availableTemplates = templatesForCanal(effectiveTemplates, canal);
  const applyTemplate = (id: string) => {
    const t = effectiveTemplates.find((x) => x.id === id);
    if (!t) return;
    if (canal === 'email' && t.sujet) setSujet(applyTemplateVars(t.sujet, templateVars));
    setCorps(applyTemplateVars(t.corps, templateVars));
  };

  const waValid = canal === 'whatsapp' && !!digits(dest) && !!corps;
  const emailValid = canal === 'email' && !!sujet && !!dest;

  return (
    <Modal
      open={open} onClose={onClose} wide
      title={canal === 'whatsapp' ? 'Nouveau message WhatsApp' : draftId ? 'Reprendre le brouillon' : 'Nouveau message'}
      footer={
        canal === 'whatsapp'
          ? <Button onClick={() => send('envoye')} disabled={saving || !waValid}><MessageCircle className="h-4 w-4" /> Ouvrir WhatsApp</Button>
          : <>
              <Button variant="secondary" onClick={() => send('brouillon')} disabled={saving || !sujet}>Enregistrer brouillon</Button>
              <Button onClick={() => send('envoye')} disabled={saving || !emailValid}><Send className="h-4 w-4" /> Envoyer</Button>
            </>
      }
    >
      <div className="space-y-4">
        <div className="inline-flex rounded-lg border border-line p-0.5 text-sm">
          {(['email', 'whatsapp'] as EmailCanal[]).map((ch) => (
            <button key={ch} onClick={() => setCanal(ch)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition ${canal === ch ? (ch === 'whatsapp' ? 'bg-emerald-600 text-white' : 'bg-brand-600 text-white') : 'text-muted hover:text-fg'}`}>
              {channelIcon(ch, 'h-4 w-4')} {ch === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
            </button>
          ))}
        </div>

        {availableTemplates.length > 0 && (
          <Field label="Modèle de message" hint="Insère un message prédéfini (remplace le contenu actuel)">
            <select className="input" value="" onChange={(e) => { if (e.target.value) applyTemplate(e.target.value); e.target.selectedIndex = 0; }}>
              <option value="">— Choisir un modèle… —</option>
              {availableTemplates.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
          </Field>
        )}

        {canal === 'whatsapp' ? (
          <>
            <Field label="Numéro WhatsApp" hint="Format international, ex. 262692123456" required>
              <input className="input" value={dest} onChange={(e) => setDest(e.target.value)} placeholder="262692…" />
            </Field>
            <Field label="Message" required><textarea className="input" rows={6} value={corps} onChange={(e) => setCorps(e.target.value)} /></Field>
            <p className="text-xs text-muted">L'envoi ouvre WhatsApp pré-rempli ; le message est journalisé dans la conversation.</p>
          </>
        ) : (
          <>
            <Field label="Destinataires (e-mails séparés par des virgules)" required>
              <input className="input" value={dest} onChange={(e) => setDest(e.target.value)} list="compose-contacts-emails" />
              <datalist id="compose-contacts-emails">
                {contacts.filter((c) => c.email).map((c) => <option key={c.id} value={c.email!}>{c.prenom} {c.nom}</option>)}
              </datalist>
            </Field>
            <Field label="Dossier lié"><select className="input" value={dossierId} onChange={(e) => setDossierId(e.target.value)}>
              <option value="">—</option>
              {dossiers.map((d) => <option key={d.id} value={d.id}>{d.reference} — {d.intitule}</option>)}
            </select></Field>
            <Field label="Sujet" required><input className="input" value={sujet} onChange={(e) => setSujet(e.target.value)} /></Field>
            <Field label="Message"><textarea className="input" rows={6} value={corps} onChange={(e) => setCorps(e.target.value)} /></Field>
            <Field label="Pièces jointes" hint="Documents de l'espace documentaire">
              {availableDocs.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line p-3 text-sm text-muted">Aucun document disponible. Ajoutez des fichiers dans l'<strong>Espace documentaire</strong> pour pouvoir les joindre.</p>
              ) : (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
                  {availableDocs.map((d) => (
                    <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface-2">
                      <input type="checkbox" checked={attachIds.has(d.id)} onChange={() => toggleAttach(d.id)} />
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" />
                      <span className="truncate text-fg">{d.titre}</span>
                      {d.categorie && <span className="shrink-0 text-xs text-muted">· {d.categorie}</span>}
                    </label>
                  ))}
                </div>
              )}
              {attachIds.size > 0 && <p className="mt-1 text-xs text-muted">{attachIds.size} pièce(s) jointe(s) sélectionnée(s)</p>}
            </Field>

            {/* PJ libres : n'importe quel fichier depuis l'ordinateur */}
            <Field label="Joindre d'autres fichiers" hint="Depuis votre ordinateur (tout type de fichier)">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line bg-surface-2 px-3 py-2 text-sm text-muted transition hover:border-brand-400 hover:text-brand-600">
                {uploadingAttach ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploadingAttach ? 'Téléversement…' : 'Choisir un fichier…'}
                <input type="file" multiple className="hidden" onChange={handleAttachUpload} disabled={uploadingAttach} />
              </label>
              {extraAttachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {extraAttachments.map((a) => (
                    <div key={a.url} className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2 py-1 text-sm">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" />
                      <span className="truncate text-fg">{a.filename}</span>
                      <button type="button" onClick={() => removeExtraAttachment(a.url)} className="ml-auto rounded p-0.5 text-muted hover:text-red-600" title="Retirer">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Field>

            {/* Signature de mail */}
            <label className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-2.5 text-sm">
              <input type="checkbox" className="mt-0.5" checked={includeSig} onChange={(e) => setIncludeSig(e.target.checked)} />
              <span className="min-w-0">
                <span className="font-medium text-fg">Inclure la signature</span>
                <span className="mt-0.5 block truncate text-xs text-muted">{signatureSummary(signatureCfg, organisme)}</span>
              </span>
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}
