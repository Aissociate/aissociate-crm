import { useState } from 'react';
import { Plus, Mail, Send, Trash2, Info } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner, EmptyState, Badge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { Email, Contact, Dossier } from '@/lib/database.types';

export default function Messagerie() {
  const { session, profile } = useAuth();
  const { data, loading, refresh } = useCollection<Email>('emails', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const contacts = useCollection<Contact>('contacts');
  const dossiers = useCollection<Dossier>('dossiers');

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

  return (
    <div>
      <PageHeader
        title="Messagerie"
        subtitle="Communications liées aux dossiers et contacts (4.7)"
        actions={<Button onClick={compose}><Plus className="h-4 w-4" /> Nouveau message</Button>}
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          L'envoi utilise l'Edge Function <strong>send-email</strong> (CDC 4.7). Déployez-la
          (<code>supabase functions deploy send-email</code>) et renseignez les secrets SMTP
          (<code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USERNAME</code>,
          <code>SMTP_PASSWORD</code>, <code>SMTP_FROM</code>). Sans cela, le message est conservé
          en brouillon.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : data.length === 0 ? (
        <EmptyState title="Aucun message" />
      ) : (
        <div className="space-y-2">
          {data.map((e) => (
            <div key={e.id} className="card flex items-start gap-3 p-4">
              <div className="rounded-lg bg-brand-50 p-2 text-brand-600"><Mail className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-slate-900">{e.sujet}</p>
                  <Badge className={e.statut === 'envoye' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{e.statut}</Badge>
                </div>
                <p className="text-xs text-slate-400">À : {e.destinataires.join(', ') || '—'} · {formatDate(e.sent_at ?? e.created_at, 'dd/MM/yyyy HH:mm')}</p>
                {e.corps && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{e.corps}</p>}
              </div>
              <button onClick={() => remove(e)} className="rounded p-1.5 text-slate-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
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
