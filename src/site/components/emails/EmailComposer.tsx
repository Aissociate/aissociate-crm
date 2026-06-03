// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, X, FileText, ChevronDown, Loader2, AlertCircle, Reply } from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
}

interface EmailComposerProps {
  userId: string;
  userRole: string;
  prefillTo?: string;
  prefillName?: string;
  prefillCompanyId?: string;
  prefillContactId?: string;
  onSent?: () => void;
  onClose?: () => void;
}

export default function EmailComposer({
  userId,
  userRole,
  prefillTo = '',
  prefillName = '',
  prefillCompanyId,
  prefillContactId,
  onSent,
  onClose,
}: EmailComposerProps) {
  const [toEmail, setToEmail] = useState(prefillTo);
  const [toName, setToName] = useState(prefillName);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [fromName, setFromName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadUserEmail();
  }, []);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('crm_email_templates')
      .select('id, name, subject, body_html, body_text')
      .order('name');
    if (data) setTemplates(data);
  };

  const loadUserEmail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) setUserEmail(user.email);
  };

  const applyTemplate = (tpl: EmailTemplate) => {
    setSubject(tpl.subject);
    setBodyHtml(tpl.body_html);
    setShowTemplates(false);
  };

  const handleSend = async () => {
    if (!toEmail || !subject || !bodyHtml) {
      setError('Destinataire, sujet et contenu sont requis');
      return;
    }
    setError('');
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session expiree, reconnectez-vous');
        setSending(false);
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to_email: toEmail,
          to_name: toName,
          subject,
          body_html: bodyHtml,
          body_text: bodyHtml.replace(/<[^>]*>/g, ''),
          from_name: fromName || undefined,
          company_id: prefillCompanyId || undefined,
          contact_id: prefillContactId || undefined,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Erreur lors de l'envoi");
        setSending(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSent?.();
      }, 1500);
    } catch (err) {
      setError("Erreur reseau lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const insertVariable = (variable: string) => {
    setBodyHtml(prev => prev + `{{${variable}}}`);
  };

  const variables = [
    { key: 'prenom', label: 'Prenom' },
    { key: 'nom', label: 'Nom' },
    { key: 'entreprise', label: 'Entreprise' },
  ];

  if (success) {
    return (
      <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center">
        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Send className="w-5 h-5 text-emerald-600" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Email envoye</h3>
        <p className="text-sm text-slate-500">Votre email a ete envoye a {toEmail}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-sm font-semibold text-slate-800">Nouvel email</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Modeles
              <ChevronDown className="w-3 h-3" />
            </button>
            {showTemplates && templates.length > 0 && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-50 py-1 max-h-60 overflow-y-auto">
                {templates.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors"
                  >
                    <p className="font-medium text-slate-800">{tpl.name}</p>
                    <p className="text-slate-400 truncate mt-0.5">{tpl.subject}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Destinataire *</label>
            <input
              type="email"
              value={toEmail}
              onChange={e => setToEmail(e.target.value)}
              placeholder="email@exemple.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Nom du destinataire</label>
            <input
              type="text"
              value={toName}
              onChange={e => setToName(e.target.value)}
              placeholder="Jean Dupont"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Nom d'expediteur (optionnel)</label>
          <input
            type="text"
            value={fromName}
            onChange={e => setFromName(e.target.value)}
            placeholder="Votre nom ou laisser vide"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Objet *</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Objet de votre email"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-medium text-slate-500">Contenu *</label>
            <div className="flex items-center gap-1">
              {variables.map(v => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  className="px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                >
                  {'{{'}{v.label}{'}}'}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={bodyHtml}
            onChange={e => setBodyHtml(e.target.value)}
            placeholder="Contenu de votre email (HTML supporte)..."
            rows={10}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow resize-y"
          />
        </div>

        {userEmail && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
            <Reply className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <p className="text-[11px] text-slate-500">
              Les reponses seront envoyees a <span className="font-medium text-slate-700">{userEmail}</span>
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-slate-400">
            Envoye depuis {userRole}@lemarchepublic.fr
          </p>
          <button
            onClick={handleSend}
            disabled={sending || !toEmail || !subject || !bodyHtml}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sending ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}
