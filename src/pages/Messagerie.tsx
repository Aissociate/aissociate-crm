import { useState, useEffect } from 'react';
import { Plus, Mail, Send, Trash2, Info, RefreshCw, CircleCheck as CheckCircle2, UserCog, TriangleAlert, ChevronDown, ChevronRight, MessagesSquare, Reply, Paperclip, MessageCircle } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner, EmptyState, Badge, TONE_TILE, type Tone } from '@/components/ui';
import { formatDate, fullName, cn } from '@/lib/utils';
import type { Email, Contact, Dossier, EmailDirection, EmailCanal, Profile, Formateur, Candidat, Document } from '@/lib/database.types';

type SmtpCfg = { host?: string; user?: string; password?: string; from?: string };
type View = 'conversations' | 'orphelins';

// Adresse e-mail nue de « Nom <a@b.com> », normalisée.
const emailAddr = (s: string | null): string => {
  if (!s) return '';
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
};
const digits = (s: string | null): string => (s ?? '').replace(/[^\d]/g, '');
const reSubject = (s: string | null): string => /^\s*re\s*:/i.test(s ?? '') ? (s ?? '') : `Re: ${s ?? ''}`;

type MatchKind = 'contact' | 'formateur' | 'candidat';
const KIND_LABEL: Record<MatchKind, string> = { contact: 'Contact', formateur: 'Formateur', candidat: 'Recrutement' };
const KIND_TONE: Record<MatchKind, Tone> = {
  contact: 'brand',
  formateur: 'info',
  candidat: 'warning',
};

type Peer = { key: string; label: string; kind: MatchKind | null; contactId: string | null; ownerId: string | null };
type Convo = {
  key: string; label: string; kind: MatchKind | null; contactId: string | null;
  emails: Email[]; owners: Set<string>; channels: Set<EmailCanal>;
  lastAt: string; lastDir: EmailDirection; lastCanal: EmailCanal;
  hasInbound: boolean; hasOutbound: boolean; unread: boolean; matched: boolean;
};

export default function Messagerie() {
  const { session, profile, isManager, isAdmin } = useAuth();
  const { data, loading, refresh } = useCollection<Email>('emails', { orderBy: { column: 'created_at', ascending: false } });
  const contacts = useCollection<Contact>('contacts');
  const dossiers = useCollection<Dossier>('dossiers');
  const profiles = useCollection<Profile>('profiles', { orderBy: { column: 'nom' } });
  const formateurs = useCollection<Formateur>('formateurs');
  const candidats = useCollection<Candidat>('candidats');
  const documents = useCollection<Document>('documents');
  const availableDocs = documents.data.filter((d) => d.fichier_url);
  const [smtpOk, setSmtpOk] = useState<boolean | null>(null);
  const [smtpFrom, setSmtpFrom] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState('');

  const ownerName = (id: string | null) => { const p = profiles.data.find((x) => x.id === id); return p ? fullName(p.prenom, p.nom) : null; };

  // ── Résolution de l'INTERLOCUTEUR d'un message (clé de regroupement) ──
  // Un e-mail connu et un WhatsApp du même contact partagent la même clé
  // `contact:<id>` -> ils tombent dans la même conversation.
  const resolvePeer = (e: Email): Peer => {
    const raw = e.direction === 'entrant' ? (e.expediteur ?? '') : (e.destinataires[0] ?? '');
    if (e.canal === 'whatsapp') {
      const ph = digits(raw);
      const c = ph ? contacts.data.find((x) => x.telephone && digits(x.telephone) === ph) : null;
      const cc = c ?? (e.contact_id ? contacts.data.find((x) => x.id === e.contact_id) : null);
      if (cc) return { key: `contact:${cc.id}`, label: fullName(cc.prenom, cc.nom), kind: 'contact', contactId: cc.id, ownerId: cc.responsable_id ?? cc.owner_id ?? null };
      return { key: `wa:${ph || raw || '?'}`, label: raw || 'WhatsApp', kind: null, contactId: null, ownerId: null };
    }
    const addr = emailAddr(raw);
    const c = addr ? contacts.data.find((x) => emailAddr(x.email) === addr) : null;
    if (c) return { key: `contact:${c.id}`, label: fullName(c.prenom, c.nom), kind: 'contact', contactId: c.id, ownerId: c.responsable_id ?? c.owner_id ?? null };
    const f = addr ? formateurs.data.find((x) => emailAddr(x.email) === addr) : null;
    if (f) return { key: `formateur:${f.id}`, label: fullName(f.prenom, f.nom), kind: 'formateur', contactId: null, ownerId: null };
    const k = addr ? candidats.data.find((x) => emailAddr(x.email) === addr) : null;
    if (k) return { key: `candidat:${k.id}`, label: fullName(k.prenom, k.nom), kind: 'candidat', contactId: null, ownerId: null };
    if (e.contact_id) { const cc = contacts.data.find((x) => x.id === e.contact_id); if (cc) return { key: `contact:${cc.id}`, label: fullName(cc.prenom, cc.nom), kind: 'contact', contactId: cc.id, ownerId: cc.responsable_id ?? cc.owner_id ?? null }; }
    return { key: `addr:${addr || raw || '?'}`, label: raw || addr || '—', kind: null, contactId: null, ownerId: null };
  };

  // Conversations regroupées par interlocuteur (tous canaux, tous sens).
  const buildConvos = (): Convo[] => {
    const map = new Map<string, Convo>();
    data.forEach((e) => {
      const p = resolvePeer(e);
      let cv = map.get(p.key);
      if (!cv) { cv = { key: p.key, label: p.label, kind: p.kind, contactId: p.contactId, emails: [], owners: new Set(), channels: new Set(), lastAt: '', lastDir: 'sortant', lastCanal: 'email', hasInbound: false, hasOutbound: false, unread: false, matched: p.kind !== null }; map.set(p.key, cv); }
      cv.emails.push(e);
      cv.channels.add(e.canal === 'whatsapp' ? 'whatsapp' : 'email');
      const t = e.sent_at ?? e.created_at;
      if (t > cv.lastAt) { cv.lastAt = t; cv.lastDir = e.direction; cv.lastCanal = e.canal === 'whatsapp' ? 'whatsapp' : 'email'; }
      if (e.direction === 'entrant') { cv.hasInbound = true; if (!e.lu) cv.unread = true; } else cv.hasOutbound = true;
      if (e.owner_id) cv.owners.add(e.owner_id);
      if (p.ownerId) cv.owners.add(p.ownerId);
    });
    return [...map.values()]
      .map((cv) => { cv.emails.sort((a, b) => ((a.sent_at ?? a.created_at) < (b.sent_at ?? b.created_at) ? 1 : -1)); return cv; })
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  };

  const allConvos = buildConvos();
  const isOrphan = (c: Convo) => !c.matched && c.hasInbound;
  const orphanConvos = allConvos.filter(isOrphan);
  const mainConvos = allConvos.filter((c) => !isOrphan(c));

  // ── Affectation manuelle d'un e-mail (ou de tout le fil) à un contact ──
  const [assignTarget, setAssignTarget] = useState<Email | null>(null);
  const [assignContact, setAssignContact] = useState('');
  const [assignWhole, setAssignWhole] = useState(true);
  const openAssign = (e: Email) => { setAssignTarget(e); setAssignContact(e.contact_id ?? ''); setAssignWhole(true); };
  const doAssign = async () => {
    if (!assignTarget) return;
    const c = contacts.data.find((x) => x.id === assignContact);
    const owner = c ? (c.responsable_id ?? c.owner_id ?? null) : null;
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
      setSmtpFrom(c.from ?? null);
    });
  }, []);

  const [view, setView] = useState<View>('conversations');
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const toggleThread = (k: string) => setOpenThreads((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  // ── Sélection / suppression de masse ──
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const changeView = (v: View) => { setView(v); setSelection(new Set()); };

  // ── Composition (e-mail ou WhatsApp) ──
  const [syncing, setSyncing] = useState(false);
  const [open, setOpen] = useState(false);
  const [canal, setCanal] = useState<EmailCanal>('email');
  const [dest, setDest] = useState('');           // e-mails (séparés par virgule) ou numéro WhatsApp
  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');
  const [dossierId, setDossierId] = useState('');
  const [attachIds, setAttachIds] = useState<Set<string>>(new Set());
  const [composeContactId, setComposeContactId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toggleAttach = (id: string) => setAttachIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const compose = () => { setCanal('email'); setDest(''); setSujet(''); setCorps(''); setDossierId(''); setAttachIds(new Set()); setComposeContactId(null); setOpen(true); };

  // ── Répondre à une conversation (même canal que le dernier message) ──
  const affectationLabel = (c: Convo): string | null =>
    c.owners.size > 0 ? [...c.owners].map(ownerName).filter(Boolean).join(', ') : (c.matched ? 'Direction' : null);
  const lastEmail = (c: Convo) => c.emails.find((e) => e.canal !== 'whatsapp');
  const replyEmailTarget = (c: Convo): string => {
    const lastIn = c.emails.find((e) => e.direction === 'entrant' && e.canal !== 'whatsapp' && e.expediteur);
    if (lastIn?.expediteur) return emailAddr(lastIn.expediteur);
    if (c.contactId) { const ct = contacts.data.find((x) => x.id === c.contactId); if (ct?.email) return ct.email; }
    return c.emails.find((e) => e.direction === 'sortant' && e.canal !== 'whatsapp')?.destinataires[0] ?? '';
  };
  const replyPhone = (c: Convo): string => {
    if (c.contactId) { const ct = contacts.data.find((x) => x.id === c.contactId); if (ct?.telephone) return ct.telephone; }
    const m = c.emails.find((e) => e.canal === 'whatsapp');
    return m ? ((m.direction === 'entrant' ? m.expediteur : m.destinataires[0]) ?? '') : '';
  };
  const reply = (c: Convo) => {
    setComposeContactId(c.contactId);
    if (c.lastCanal === 'whatsapp') {
      setCanal('whatsapp'); setDest(replyPhone(c)); setSujet('');
    } else {
      setCanal('email'); setDest(replyEmailTarget(c)); const le = lastEmail(c); setSujet(le ? reSubject(le.sujet) : '');
    }
    setCorps(''); setDossierId(''); setAttachIds(new Set());
    setOpen(true);
  };

  const send = async (statut: 'brouillon' | 'envoye') => {
    setSaving(true);
    const attachments = availableDocs.filter((d) => attachIds.has(d.id) && d.fichier_url).map((d) => ({ filename: d.titre, url: d.fichier_url! }));

    if (canal === 'whatsapp') {
      const phone = digits(dest);
      if (!phone) { setSaving(false); alert('Numéro de téléphone requis pour WhatsApp.'); return; }
      // Ouverture de WhatsApp (web/app) pré-rempli, puis journalisation du message.
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(corps ?? '')}`, '_blank', 'noopener');
      const { error } = await supabase.from('emails').insert({
        destinataires: [dest], sujet: sujet || 'WhatsApp', corps, statut: 'envoye', canal: 'whatsapp',
        direction: 'sortant', expediteur: smtpFrom ?? profile?.email ?? null,
        contact_id: composeContactId, sent_at: new Date().toISOString(), owner_id: session?.user.id, attachments: [],
      });
      setSaving(false);
      if (error) { alert(error.message); return; }
      setOpen(false); refresh();
      return;
    }

    const destinataires = dest.split(',').map((d) => d.trim()).filter(Boolean);
    let finalStatut = statut;
    if (statut === 'envoye') {
      const { error: fnError } = await supabase.functions.invoke('send-email', {
        body: { to: destinataires, subject: sujet, html: (corps ?? '').replace(/\n/g, '<br>'), text: corps, attachments },
      });
      if (fnError) {
        finalStatut = 'brouillon';
        alert('Envoi SMTP échoué. Vérifiez la configuration SMTP dans Paramètres.\nLe message a été enregistré en brouillon.');
      }
    }
    const { error } = await supabase.from('emails').insert({
      destinataires, sujet, corps, statut: finalStatut, attachments, canal: 'email',
      expediteur: smtpFrom ?? profile?.email ?? null,
      dossier_id: dossierId || null, contact_id: composeContactId,
      sent_at: finalStatut === 'envoye' ? new Date().toISOString() : null,
      owner_id: session?.user.id,
    });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setOpen(false); refresh();
  };

  const remove = async (e: Email) => {
    if (!confirm('Supprimer ce message ?')) return;
    const { error } = await supabase.from('emails').delete().eq('id', e.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  const syncInbox = async () => {
    setSyncing(true);
    const timeout = new Promise<{ data: null; error: { message: string } }>((resolve) => setTimeout(() => resolve({ data: null, error: { message: '__timeout__' } }), 90000));
    const result = await Promise.race([supabase.functions.invoke('fetch-emails'), timeout]) as { data: unknown; error: { message: string } | null };
    setSyncing(false);
    if (result.error) {
      alert(result.error.message === '__timeout__'
        ? "La synchronisation a expiré (90 s). Vérifiez l'IMAP (Paramètres) et le déploiement de « fetch-emails »."
        : "Réception indisponible : déployez « fetch-emails » et configurez l'IMAP (Paramètres ou secrets).");
      return;
    }
    const n = (result.data as { imported?: number; skipped?: number; error?: string } | null);
    if (n?.error) { alert(`Réception : ${n.error}`); return; }
    refresh();
    alert(`${n?.imported ?? 0} nouveau(x) message(s) importé(s).${n?.skipped ? ` ${n.skipped} ignoré(s) (expéditeur inconnu).` : ''}`);
  };

  const convos = (view === 'orphelins' ? orphanConvos : mainConvos)
    .filter((c) => view === 'orphelins' || !ownerFilter || (ownerFilter === 'none' ? c.owners.size === 0 : c.owners.has(ownerFilter)));

  // Sélection (par conversation -> tous ses messages)
  const convoIds = (c: Convo) => c.emails.map((e) => e.id);
  const visibleIds = convos.flatMap(convoIds);
  const convoSelected = (c: Convo) => { const ids = convoIds(c); return ids.length > 0 && ids.every((id) => selection.has(id)); };
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selection.has(id));
  const toggleConvo = (c: Convo) => setSelection((s) => { const n = new Set(s); const ids = convoIds(c); const has = ids.every((id) => n.has(id)); ids.forEach((id) => (has ? n.delete(id) : n.add(id))); return n; });
  const toggleAll = () => setSelection((s) => (visibleIds.every((id) => s.has(id)) ? new Set() : new Set(visibleIds)));
  const bulkDelete = async () => {
    const ids = [...selection];
    if (!ids.length) return;
    if (!confirm(`Supprimer définitivement ${ids.length} message(s) ?`)) return;
    const { error } = await supabase.from('emails').delete().in('id', ids);
    if (error) { alert(error.message); return; }
    setSelection(new Set());
    refresh();
  };

  const tabs: [View, string, typeof MessagesSquare, number][] = [['conversations', 'Conversations', MessagesSquare, mainConvos.length]];
  if (isAdmin) tabs.push(['orphelins', 'Orphelins', TriangleAlert, orphanConvos.length]);

  // Pastille canal (e-mail / WhatsApp)
  const channelIcon = (c: EmailCanal, cls = 'h-4 w-4') => (c === 'whatsapp' ? <MessageCircle className={cls} /> : <Mail className={cls} />);
  const waValid = canal === 'whatsapp' && !!digits(dest) && !!corps;
  const emailValid = canal === 'email' && !!sujet && !!dest;

  return (
    <div>
      <PageHeader
        title="Messagerie"
        subtitle="Conversations unifiées par interlocuteur — e-mail & WhatsApp"
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
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Configuration SMTP incomplète. Renseignez l'hôte, l'utilisateur, le mot de passe et l'adresse d'expédition dans <strong>Paramètres → Serveur SMTP sortant</strong>.</p>
        </div>
      )}
      {smtpOk === true && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>SMTP configuré — l'envoi d'e-mails est opérationnel.</p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line">
        <div className="flex gap-1">
          {tabs.map(([key, label, Icon, count]) => (
            <button key={key} onClick={() => changeView(key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${view === key ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-muted hover:text-fg'}`}>
              <Icon className="h-4 w-4" /> {label}
              <span className="rounded-full bg-surface-2 px-1.5 text-xs text-muted">{count}</span>
            </button>
          ))}
        </div>
        {view === 'conversations' && isManager && (
          <select className="input mb-1 max-w-[200px] py-1 text-sm" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="">Tous les conseillers</option>
            <option value="none">Direction (non affectés)</option>
            {profiles.data.map((p) => <option key={p.id} value={p.id}>{fullName(p.prenom, p.nom)}</option>)}
          </select>
        )}
      </div>

      {view === 'orphelins' && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Messages reçus d'un interlocuteur inconnu (aucun contact, formateur ni candidat). Visibles <strong>uniquement par l'administrateur</strong>. Affectez-les à un contact pour les router.</p>
        </div>
      )}

      {!loading && convos.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} /> Tout sélectionner ({convos.length})
          </label>
          {selection.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">{selection.size} message(s)</span>
              <Button variant="secondary" onClick={() => setSelection(new Set())}>Annuler</Button>
              <Button variant="danger" onClick={bulkDelete}><Trash2 className="h-4 w-4" /> Supprimer</Button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : convos.length === 0 ? (
        <EmptyState
          title={view === 'orphelins' ? 'Aucun message orphelin' : 'Aucune conversation'}
          message={view === 'orphelins' ? undefined : 'Cliquez sur « Synchroniser » ou « Nouveau message ».'}
        />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {convos.map((c) => {
            const expanded = openThreads.has(c.key);
            const last = c.emails[0];
            const aff = affectationLabel(c);
            return (
              <div key={c.key} className={convoSelected(c) ? 'bg-brand-500/5' : ''}>
                {/* En-tête : interlocuteur, dernière interaction, canaux, affectation */}
                <div className="flex items-start gap-2.5 p-3">
                  <input type="checkbox" className="mt-2 shrink-0" checked={convoSelected(c)} onChange={() => toggleConvo(c)} title="Sélectionner la conversation" />
                  <button onClick={() => toggleThread(c.key)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <div className={cn('mt-0.5 shrink-0 rounded-full p-2', TONE_TILE[c.lastCanal === 'whatsapp' ? 'success' : c.lastDir === 'entrant' ? 'info' : 'brand'])}>
                      {channelIcon(c.lastCanal, 'h-5 w-5')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" title="Non lu" />}
                        <p className={`truncate ${c.unread ? 'font-semibold' : 'font-medium'} text-fg`}>{c.label}</p>
                        {c.channels.has('email') && <Mail className="h-3 w-3 shrink-0 text-muted" />}
                        {c.channels.has('whatsapp') && <MessageCircle className="h-3 w-3 shrink-0 text-emerald-500" />}
                        <span className="shrink-0 text-xs text-muted">· {c.emails.length}</span>
                        {c.emails.some((e) => e.attachments && e.attachments.length > 0) && <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" />}
                        <span className="ml-auto shrink-0 text-xs text-muted">{formatDate(c.lastAt, 'dd/MM/yyyy HH:mm')}</span>
                        {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted" />}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        <span className="text-fg/70">{last.direction === 'entrant' ? '↩ ' : '↪ '}{last.sujet || (last.canal === 'whatsapp' ? 'WhatsApp' : '(sans objet)')}</span>
                        {last.corps ? ` — ${last.corps}` : ''}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        {c.kind ? (
                          <>
                            <Badge tone={KIND_TONE[c.kind]}>{KIND_LABEL[c.kind]} · {c.label}</Badge>
                            <Badge tone={c.owners.size > 0 ? 'neutral' : 'info'}>{aff ?? 'Direction'}</Badge>
                          </>
                        ) : c.hasInbound ? <Badge tone="warning">Non rattaché</Badge> : null}
                      </div>
                    </div>
                  </button>
                </div>

                {/* Détail déplié : tag interlocuteur + Répondre, puis fil façon chat */}
                {expanded && (
                  <div className="border-t border-line bg-surface-2/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      {c.kind ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white">
                          <UserCog className="h-3.5 w-3.5" /> {c.label} <span className="opacity-80">· {aff ?? 'Direction'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          <TriangleAlert className="h-3.5 w-3.5" /> {c.label} · non rattaché
                        </span>
                      )}
                      <Button variant="secondary" onClick={() => reply(c)}><Reply className="h-4 w-4" /> Répondre</Button>
                    </div>
                    <div className="max-h-[28rem] space-y-3 overflow-y-auto p-3 pt-0">
                      {c.emails.map((e) => {
                        const wa = e.canal === 'whatsapp';
                        return (
                          <div key={e.id} className={`flex ${e.direction === 'sortant' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[88%] rounded-xl border p-3 ${wa ? 'border-emerald-500/20 bg-emerald-500/5' : e.direction === 'sortant' ? 'border-brand-500/20 bg-brand-500/5' : 'border-line bg-surface'}`}>
                              <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted">
                                <span className="flex min-w-0 items-center gap-1 truncate">
                                  {channelIcon(e.canal, 'h-3 w-3 shrink-0')}
                                  {e.direction === 'entrant' ? `De ${e.expediteur ?? '—'}` : `À ${e.destinataires.join(', ') || '—'}`}
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                  {e.direction === 'sortant' && !wa && <Badge tone={e.statut === 'envoye' ? 'success' : 'neutral'}>{e.statut}</Badge>}
                                  {formatDate(e.sent_at ?? e.created_at, 'dd/MM/yyyy HH:mm')}
                                </span>
                              </div>
                              {!wa && e.sujet && <p className="mb-1 text-sm font-medium text-fg">{e.sujet}</p>}
                              {e.corps && <p className="whitespace-pre-wrap break-words text-sm text-fg">{e.corps}</p>}
                              {e.attachments && e.attachments.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {e.attachments.map((a, i) => (
                                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="inline-flex max-w-[14rem] items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-surface">
                                      <Paperclip className="h-3 w-3 shrink-0" /><span className="truncate">{a.filename}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                              <div className="mt-2 flex items-center justify-end gap-1">
                                {e.direction === 'entrant' && !wa && <button onClick={() => openAssign(e)} title="Affecter à un contact/conseiller" className="rounded p-1 text-muted hover:text-brand-600"><UserCog className="h-4 w-4" /></button>}
                                <button onClick={() => remove(e)} title="Supprimer ce message" className="rounded p-1 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Composition multi-canal */}
      <Modal
        open={open} onClose={() => setOpen(false)} wide
        title={canal === 'whatsapp' ? 'Nouveau message WhatsApp' : 'Nouveau message'}
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
            </>
          )}
        </div>
      </Modal>

      {/* Affectation d'un e-mail / d'une conversation à un contact */}
      <Modal
        open={!!assignTarget} onClose={() => setAssignTarget(null)} title="Affecter l'e-mail"
        footer={<><Button variant="secondary" onClick={() => setAssignTarget(null)}>Annuler</Button><Button onClick={doAssign}>Affecter</Button></>}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">De : <strong className="text-fg">{assignTarget?.expediteur ?? '—'}</strong></p>
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
