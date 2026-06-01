import { useState, useEffect } from 'react';
import { Plus, Mail, Send, Trash2, Info, Inbox, RefreshCw, CircleCheck as CheckCircle2, UserCog } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner, EmptyState, Badge } from '@/components/ui';
import { formatDate, fullName } from '@/lib/utils';
import type { Email, Contact, Dossier, EmailDirection, Profile } from '@/lib/database.types';

type SmtpCfg = { host?: string; user?: string; password?: string; from?: string };

export default function Messagerie() {
  const { session, profile, isManager } = useAuth();
  const { data, loading, refresh } = useCollection<Email>('emails', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const contacts = useCollection<Contact>('contacts');
  const dossiers = useCollection<Dossier>('dossiers');
  const profiles = useCollection<Profile>('profiles', { orderBy: { column: 'nom' } });
  const [smtpOk, setSmtpOk] = useState<boolean | null>(null);
  const [ownerFilter, setOwnerFilter] = useState(''); // '', 'none' (direction), ou un owner_id

  const ownerName = (id: string | null) => { const p = profiles.data.find((x) => x.id === id); return p ? fullName(p.prenom, p.nom) : null; };
  const contactName = (id: string | null) => { const c = contacts.data.find((x) => x.id === id); return c ? fullName(c.prenom, c.nom) : null; };

  // ── Affectation d'un e-mail (ou de toute la conversation) à un contact ──
  const [assignTarget, setAssignTarget] = useState<Email | null>(null);
  const [assignContact, setAssignContact] = useState('');
  const [assignWhole, setAssignWhole] = useState(true);
  const openAssign = (e: Email) => { setAssignTarget(e); setAssignContact(e.contact_id ?? ''); setAssignWhole(true); };
  const doAssign = async () => {
    if (!assignTarget) return;
    const c = contacts.data.find((x) => x.id === assignContact);
    const owner = c ? (c.responsable_id ?? c.owner_id ?? null) : null; // pas de contact -> direction
    const fields = { contact_id: assignContact || null, owner_id: owner };
    const q = supabase.from('emails').update(fields);
    const { error } = assignWhole && assignTarget.expediteur
      ? await q.eq('expediteur', assignTarget.expediteur)
      : await q.eq('id', assignTarget.id);
    if (error) { alert(error.message); return; }
    setAssignTarget(null);
    refresh();
  };

  useEffect(() => {
    supabase.from('parametres').select('valeur').eq('cle', 'smtp').maybeSingle().then(({ data }) => {
      const c = (data?.valeur ?? {}) as SmtpCfg;
      setSmtpOk(!!(c.host && c.user && c.password && c.from));
    });
  }, []);

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
          'Envoi SMTP échoué. Vérifiez la configuration SMTP dans Paramètres (hôte, port, identifiants).\n' +
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
    const { error } = await supabase.from('emails').delete().eq('id', e.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  // Synchronise la boîte de réception via l'Edge Function IMAP fetch-emails.
  const syncInbox = async () => {
    setSyncing(true);
    // Garde-fou : la synchro ne peut pas rester infinie (timeout 90 s)
    const timeout = new Promise<{ data: null; error: { message: string } }>(
      (resolve) => setTimeout(() => resolve({ data: null, error: { message: '__timeout__' } }), 90000),
    );
    const result = await Promise.race([supabase.functions.invoke('fetch-emails'), timeout]) as { data: unknown; error: { message: string } | null };
    setSyncing(false);
    if (result.error) {
      alert(result.error.message === '__timeout__'
        ? "La synchronisation a expiré (90 s). Vérifiez la configuration IMAP (hôte/port/identifiants) dans Paramètres et le déploiement de « fetch-emails »."
        : "Réception indisponible : déployez « fetch-emails » et configurez l'IMAP (Paramètres ou secrets).");
      return;
    }
    const n = (result.data as { imported?: number; error?: string } | null);
    if (n?.error) { alert(`Réception : ${n.error}`); return; }
    setTab('entrant');
    refresh();
    alert(`${n?.imported ?? 0} nouveau(x) message(s) importé(s).`);
  };

  const messages = data.filter((e) =>
    e.direction === tab &&
    (!ownerFilter || (ownerFilter === 'none' ? !e.owner_id : e.owner_id === ownerFilter)));

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

      {smtpOk === false && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Configuration SMTP incomplète. Renseignez l'hôte, l'utilisateur, le mot de passe et
            l'adresse d'expédition dans <strong>Paramètres → Serveur SMTP sortant</strong>.
          </p>
        </div>
      )}
      {smtpOk === true && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>SMTP configuré — l'envoi d'e-mails est opérationnel.</p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line">
        <div className="flex gap-1">
          {([['sortant', 'Envoyés', Send], ['entrant', 'Reçus', Inbox]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-muted hover:text-fg'}`}>
              <Icon className="h-4 w-4" /> {label}
              <span className="rounded-full bg-surface-2 px-1.5 text-xs text-muted">{data.filter((e) => e.direction === key).length}</span>
            </button>
          ))}
        </div>
        {isManager && (
          <select className="input mb-1 max-w-[220px] py-1 text-sm" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="">Tous les conseillers</option>
            <option value="none">Direction (non affectés)</option>
            {profiles.data.map((p) => <option key={p.id} value={p.id}>{fullName(p.prenom, p.nom)}</option>)}
          </select>
        )}
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
                    : <Badge className="bg-sky-100 text-sky-700">reçu</Badge>}
                </div>
                <p className="text-xs text-muted">
                  {e.direction === 'entrant'
                    ? `De : ${e.expediteur ?? '—'}`
                    : `À : ${e.destinataires.join(', ') || '—'}`} · {formatDate(e.sent_at ?? e.created_at, 'dd/MM/yyyy HH:mm')}
                </p>
                {e.corps && <p className="mt-1 line-clamp-2 text-sm text-muted">{e.corps}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                  {e.contact_id && <Badge className="bg-brand-50 text-brand-700">{contactName(e.contact_id) ?? 'Contact'}</Badge>}
                  <Badge className={e.owner_id ? 'bg-surface-2 text-muted' : 'bg-amber-100 text-amber-700'}>
                    {e.owner_id ? (ownerName(e.owner_id) ?? 'Conseiller') : 'Direction'}
                  </Badge>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button onClick={() => openAssign(e)} title="Affecter à un contact/conseiller" className="rounded p-1.5 text-muted hover:text-brand-600"><UserCog className="h-4 w-4" /></button>
                <button onClick={() => remove(e)} className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
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

      {/* Affectation d'un e-mail / d'une conversation à un contact (et son conseiller) */}
      <Modal
        open={!!assignTarget} onClose={() => setAssignTarget(null)} title="Affecter l'e-mail"
        footer={<><Button variant="secondary" onClick={() => setAssignTarget(null)}>Annuler</Button><Button onClick={doAssign}>Affecter</Button></>}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            De : <strong className="text-fg">{assignTarget?.expediteur ?? '—'}</strong>
          </p>
          <Field label="Apprenant / prospect" hint="L'e-mail sera visible par le conseiller affecté à ce contact ; sinon par la direction">
            <select className="input" value={assignContact} onChange={(e) => setAssignContact(e.target.value)}>
              <option value="">— Direction (non affecté) —</option>
              {contacts.data.map((c) => <option key={c.id} value={c.id}>{fullName(c.prenom, c.nom)}{c.email ? ` · ${c.email}` : ''}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={assignWhole} onChange={(e) => setAssignWhole(e.target.checked)} />
            Appliquer à toute la conversation (tous les e-mails de cet expéditeur)
          </label>
        </div>
      </Modal>
    </div>
  );
}
