import { useState } from 'react';
import { Plus, Mail, Send, Trash2, Info, Inbox, RefreshCw } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner, EmptyState, Badge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { Email, Contact, Dossier, EmailDirection } from '@/lib/database.types';

export default function Messagerie() {
  const { session, profile } = useAuth();
  const { data, loading, refresh } = useCollection<Email>('emails', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const contacts = useCollection<Contact>('contacts');
  const dossiers = useCollection<Dossier>('dossiers');

  const [tab, setTab] = useState<EmailDirection>('sortant');
  const [syncing, setSyncing] = useState(false);
  const [open, setOpen] = useState(false);
  const [dest, setDest] = useState('');
  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');
  const [dossierId, setDossierId] = useState('');
  const [saving, setSaving] = useState(false);

  const compose = () => { setDest(''); setSujet(''); setCorps(''); setDossierId(''); setOpen(true); };

  const send = async (statut: 'brouillon' | 'envoye') => {
    setSaving(true);
    const destinataires = dest.split(',').map((d) => d.trim()).filter(Boolean);
    let finalStatut = statut;

    // Envoi réel via l'Edge Function SMTP (CDC 4.7). En cas d'échec (fonction non
    // déployée / SMTP non configuré), on conserve le message en brouillon.
    if (statut === 'envoye') {
      const { error: fnError } = await supabase.functions.invoke('send-email', {
        body: { to: destinataires, subject: sujet, html: (corps ?? '').replace(/\n/g, '<br>'), text: corps },
      });
      if (fnError) {
        finalStatut = 'brouillon';
        alert(
          'Envoi SMTP indisponible (Edge Function "send-email" non déployée ou secrets SMTP manquants).\n' +
          'Le message a été enregistré en brouillon.',
        );
      }
    }

    const { error } = await supabase.from('emails').insert({
      destinataires, sujet, corps, statut: finalStatut,
      expediteur: profile?.email ?? null,
      dossier_id: dossierId || null,
      sent_at: finalStatut === 'envoye' ? new Date().toISOString() : null,
      owner_id: session?.user.id,
    });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setOpen(false);
    refresh();
  };

  const remove = async (e: Email) => {
    if (!confirm('Supprimer ce message ?')) return;
    await supabase.from('emails').delete().eq('id', e.id);
    refresh();
  };

  // Synchronise la boîte de réception via l'Edge Function IMAP fetch-emails.
  const syncInbox = async () => {
    setSyncing(true);
    const { data: res, error } = await supabase.functions.invoke('fetch-emails');
    setSyncing(false);
    if (error) {
      alert('Réception IMAP indisponible (Edge Function "fetch-emails" non déployée ou secrets IMAP manquants).');
      return;
    }
    const n = (res as { imported?: number })?.imported ?? 0;
    setTab('entrant');
    refresh();
    alert(`${n} nouveau(x) message(s) importé(s).`);
  };

  const messages = data.filter((e) => e.direction === tab);

  return (
    <div>
      <PageHeader
        title="Messagerie"
        subtitle="Communications liées aux dossiers et contacts (4.7)"
        actions={
          <>
            <Button variant="secondary" onClick={syncInbox} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Synchroniser
            </Button>
            <Button onClick={compose}><Plus className="h-4 w-4" /> Nouveau message</Button>
          </>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Envoi via l'Edge Function <strong>send-email</strong> (SMTP) et réception via
          <strong> fetch-emails</strong> (IMAP). Déployez-les et renseignez les secrets
          (<code>SMTP_*</code> / <code>IMAP_*</code>). Sans déploiement, l'envoi reste en brouillon
          et la synchronisation est indisponible.
        </p>
      </div>

      <div className="mb-4 flex gap-1 border-b border-line">
        {([['sortant', 'Envoyés', Send], ['entrant', 'Reçus', Inbox]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-muted hover:text-fg'}`}>
            <Icon className="h-4 w-4" /> {label}
            <span className="rounded-full bg-surface-2 px-1.5 text-xs text-muted">{data.filter((e) => e.direction === key).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : messages.length === 0 ? (
        <EmptyState title={tab === 'entrant' ? 'Aucun message reçu' : 'Aucun message envoyé'} message={tab === 'entrant' ? 'Cliquez sur « Synchroniser » pour relever la boîte IMAP.' : undefined} />
      ) : (
        <div className="space-y-2">
          {messages.map((e) => (
            <div key={e.id} className="card flex items-start gap-3 p-4">
              <div className="rounded-lg bg-brand-50 p-2 text-brand-600">
                {e.direction === 'entrant' ? <Inbox className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-fg">{e.sujet}</p>
                  {e.direction === 'sortant'
                    ? <Badge className={e.statut === 'envoye' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-2 text-muted'}>{e.statut}</Badge>
                    : <Badge className="bg-indigo-100 text-indigo-700">reçu</Badge>}
                </div>
                <p className="text-xs text-muted">
                  {e.direction === 'entrant'
                    ? `De : ${e.expediteur ?? '—'}`
                    : `À : ${e.destinataires.join(', ') || '—'}`} · {formatDate(e.sent_at ?? e.created_at, 'dd/MM/yyyy HH:mm')}
                </p>
                {e.corps && <p className="mt-1 line-clamp-2 text-sm text-muted">{e.corps}</p>}
              </div>
              <button onClick={() => remove(e)} className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)} wide title="Nouveau message"
        footer={
          <>
            <Button variant="secondary" onClick={() => send('brouillon')} disabled={saving || !sujet}>Enregistrer brouillon</Button>
            <Button onClick={() => send('envoye')} disabled={saving || !sujet || !dest}><Send className="h-4 w-4" /> Envoyer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Destinataires (e-mails séparés par des virgules)" required>
            <input className="input" value={dest} onChange={(e) => setDest(e.target.value)} list="contacts-emails" />
            <datalist id="contacts-emails">
              {contacts.data.filter((c) => c.email).map((c) => <option key={c.id} value={c.email!}>{c.prenom} {c.nom}</option>)}
            </datalist>
          </Field>
          <Field label="Dossier lié"><select className="input" value={dossierId} onChange={(e) => setDossierId(e.target.value)}>
            <option value="">—</option>
            {dossiers.data.map((d) => <option key={d.id} value={d.id}>{d.reference} — {d.intitule}</option>)}
          </select></Field>
          <Field label="Sujet" required><input className="input" value={sujet} onChange={(e) => setSujet(e.target.value)} /></Field>
          <Field label="Message"><textarea className="input" rows={6} value={corps} onChange={(e) => setCorps(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
