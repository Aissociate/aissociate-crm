import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Mail, Trash2, Info, RefreshCw, CircleCheck as CheckCircle2, UserCog, TriangleAlert, ChevronDown, ChevronRight, MessagesSquare, Reply, Paperclip, MessageCircle, ArrowDownUp, Pencil, Clock, Search, UserRound, UserPlus, CheckCheck, CircleSlash2 } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner, EmptyState, Badge, TONE_TILE, type Tone } from '@/components/ui';
import { formatDate, fullName, cn } from '@/lib/utils';
import ComposeMessageModal, { type ComposeInitial } from '@/components/ComposeMessageModal';
import ContactFiche from '@/components/ContactFiche';
import { OPP_STAGE_LABELS, OPP_STAGE_ORDER } from '@/lib/constants';
import type {
  Email, Contact, EmailDirection, EmailCanal, Profile, Formateur, Candidat,
  Opportunite, OpportuniteStage, ConversationClose, Entreprise, Financeur,
} from '@/lib/database.types';

type SmtpCfg = { host?: string; user?: string; password?: string; from?: string };
type SyncInfo = { last_at?: string; ok?: boolean; imported?: number; skipped?: number; error?: string };
type View = 'conversations' | 'orphelins';
// Fréquence du cron `imap-sync` (pg_cron) — informatif pour l'utilisateur.
const SYNC_EVERY = '5 minutes';

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
  /** Un message sortant existe après le dernier message entrant. */
  answered: boolean;
  /** Discussion marquée « close » : aucune réponse n'est attendue. */
  closed: boolean;
  /** Étape de l'opportunité du contact lié, `null` s'il n'en a pas. */
  oppStage: OpportuniteStage | null;
};

// Périmètres de recherche activables (ticket « Messagerie fonction de recherche »).
type Scope = 'expediteur' | 'destinataire' | 'objet' | 'corps' | 'piece_jointe';
const SCOPE_LABELS: Record<Scope, string> = {
  expediteur: 'Expéditeurs', destinataire: 'Destinataires', objet: 'Objet',
  corps: 'Corps du texte', piece_jointe: 'Pièces jointes',
};
const ALL_SCOPES = Object.keys(SCOPE_LABELS) as Scope[];

export default function Messagerie() {
  const { isManager, isAdmin, session } = useAuth();
  const navigate = useNavigate();
  const { data, loading, refresh } = useCollection<Email>('emails', { orderBy: { column: 'created_at', ascending: false } });
  const contacts = useCollection<Contact>('contacts');
  const profiles = useCollection<Profile>('profiles', { orderBy: { column: 'nom' } });
  const formateurs = useCollection<Formateur>('formateurs');
  const candidats = useCollection<Candidat>('candidats');
  const [smtpOk, setSmtpOk] = useState<boolean | null>(null);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [sync, setSync] = useState<SyncInfo | null>(null);
  // Ordre d'affichage : décroissant (plus récent d'abord) par défaut,
  // croissant = ordre chronologique (ticket Benjamin « tri chronologique »).
  const [chrono, setChrono] = useState(false);

  // ── Recherche & filtres (tickets « recherche », « réponse apportée », « statut opportunité ») ──
  const [search, setSearch] = useState('');
  const [scopes, setScopes] = useState<Set<Scope>>(new Set(ALL_SCOPES));
  const [reponseFilter, setReponseFilter] = useState<'' | 'repondu' | 'non_repondu' | 'closes'>('');
  const [oppFilter, setOppFilter] = useState('');           // '' | 'aucune' | <stage>
  const [sortBy, setSortBy] = useState<'date' | 'conseiller'>('date');

  const opportunites = useCollection<Opportunite>('opportunites');
  const closes = useCollection<ConversationClose>('conversations_closes');
  const closedKeys = new Set(closes.data.map((c) => c.cle));
  // Opportunité la plus récente par contact (une conversation = un interlocuteur).
  const oppByContact = new Map<string, OpportuniteStage>();
  for (const o of opportunites.data) {
    if (o.contact_id && !oppByContact.has(o.contact_id)) oppByContact.set(o.contact_id, o.stage);
  }

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
      if (!cv) { cv = { key: p.key, label: p.label, kind: p.kind, contactId: p.contactId, emails: [], owners: new Set(), channels: new Set(), lastAt: '', lastDir: 'sortant', lastCanal: 'email', hasInbound: false, hasOutbound: false, unread: false, matched: p.kind !== null, answered: false, closed: false, oppStage: null }; map.set(p.key, cv); }
      cv.emails.push(e);
      cv.channels.add(e.canal === 'whatsapp' ? 'whatsapp' : 'email');
      const t = e.sent_at ?? e.created_at;
      if (t > cv.lastAt) { cv.lastAt = t; cv.lastDir = e.direction; cv.lastCanal = e.canal === 'whatsapp' ? 'whatsapp' : 'email'; }
      if (e.direction === 'entrant') { cv.hasInbound = true; if (!e.lu) cv.unread = true; } else cv.hasOutbound = true;
      if (e.owner_id) cv.owners.add(e.owner_id);
      if (p.ownerId) cv.owners.add(p.ownerId);
    });
    const dir = chrono ? -1 : 1; // chrono = plus ancien d'abord
    const at = (e: Email) => e.sent_at ?? e.created_at;
    return [...map.values()]
      .map((cv) => {
        cv.emails.sort((a, b) => ((at(a) < at(b) ? 1 : -1) * dir));
        // « Répondu » = un sortant postérieur au dernier entrant. Une conversation
        // sans aucun message entrant n'attend rien : elle est considérée traitée.
        const lastIn = cv.emails.filter((e) => e.direction === 'entrant').map(at).sort().at(-1);
        cv.answered = !lastIn || cv.emails.some((e) => e.direction === 'sortant' && at(e) > lastIn);
        cv.closed = closedKeys.has(cv.key);
        cv.oppStage = cv.contactId ? (oppByContact.get(cv.contactId) ?? null) : null;
        return cv;
      })
      .sort((a, b) => ((a.lastAt < b.lastAt ? 1 : -1) * dir));
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

  // Statut SMTP (bandeau) + horodatage de la dernière synchronisation IMAP,
  // écrit par la fonction « fetch-emails » à chaque passage (manuel ou cron).
  const loadSyncInfo = () =>
    supabase.from('parametres').select('valeur').eq('cle', 'imap_sync').maybeSingle()
      .then(({ data }) => setSync((data?.valeur ?? null) as SyncInfo | null));

  useEffect(() => {
    supabase.from('parametres').select('valeur').eq('cle', 'smtp').maybeSingle().then(({ data }) => {
      if (!data) { setSmtpOk(false); return; }
      const c = (data.valeur ?? {}) as SmtpCfg;
      setSmtpOk(!!(c.host && c.user && c.password && c.from));
    });
    void loadSyncInfo();
    // Le cron tourne toutes les 5 min : on rafraîchit l'indicateur régulièrement.
    const t = setInterval(() => void loadSyncInfo(), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [view, setView] = useState<View>('conversations');
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const toggleThread = (k: string) => setOpenThreads((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  // ── Sélection / suppression de masse ──
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const changeView = (v: View) => { setView(v); setSelection(new Set()); };

  // ── Composition (e-mail ou WhatsApp) — modale partagée ──
  const [syncing, setSyncing] = useState(false);
  const [open, setOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<ComposeInitial>({});

  const compose = () => { setComposeInitial({}); setOpen(true); };

  // ── Répondre à une conversation (même canal que le dernier message) ──
  const affectationLabel = (c: Convo): string | null =>
    c.owners.size > 0 ? [...c.owners].map(ownerName).filter(Boolean).join(', ') : (c.matched ? 'Direction' : null);
  // Le fil peut être affiché en ordre chronologique : les recherches de « dernier
  // message » doivent rester indépendantes de l'ordre d'affichage.
  const newestFirst = (c: Convo) =>
    chrono ? [...c.emails].reverse() : c.emails;
  const lastEmail = (c: Convo) => newestFirst(c).find((e) => e.canal !== 'whatsapp');
  const replyEmailTarget = (c: Convo): string => {
    const list = newestFirst(c);
    const lastIn = list.find((e) => e.direction === 'entrant' && e.canal !== 'whatsapp' && e.expediteur);
    if (lastIn?.expediteur) return emailAddr(lastIn.expediteur);
    if (c.contactId) { const ct = contacts.data.find((x) => x.id === c.contactId); if (ct?.email) return ct.email; }
    return list.find((e) => e.direction === 'sortant' && e.canal !== 'whatsapp')?.destinataires[0] ?? '';
  };
  const replyPhone = (c: Convo): string => {
    if (c.contactId) { const ct = contacts.data.find((x) => x.id === c.contactId); if (ct?.telephone) return ct.telephone; }
    const m = newestFirst(c).find((e) => e.canal === 'whatsapp');
    return m ? ((m.direction === 'entrant' ? m.expediteur : m.destinataires[0]) ?? '') : '';
  };
  const reply = (c: Convo) => {
    if (c.lastCanal === 'whatsapp') {
      setComposeInitial({ canal: 'whatsapp', dest: replyPhone(c), contactId: c.contactId });
    } else {
      const le = lastEmail(c);
      setComposeInitial({ canal: 'email', dest: replyEmailTarget(c), sujet: le ? reSubject(le.sujet) : '', contactId: c.contactId });
    }
    setOpen(true);
  };

  // Reprise d'un brouillon : rouvre la modale de composition pré-remplie et
  // rattachée à la ligne existante (ticket Benjamin « brouillon impossible à rouvrir »).
  const editDraft = (e: Email) => {
    setComposeInitial({
      canal: e.canal === 'whatsapp' ? 'whatsapp' : 'email',
      dest: e.destinataires.join(', '),
      sujet: e.sujet ?? '',
      corps: e.corps ?? '',
      dossierId: e.dossier_id ?? undefined,
      contactId: e.contact_id,
      draftId: e.id,
      attachments: e.attachments ?? [],
    });
    setOpen(true);
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
    void loadSyncInfo();
    if (n?.error) { alert(`Réception : ${n.error}`); return; }
    refresh();
    alert(`${n?.imported ?? 0} nouveau(x) message(s) importé(s).${n?.skipped ? ` ${n.skipped} ignoré(s) (expéditeur inconnu).` : ''}`);
  };

  // ── Recherche plein texte, restreinte aux périmètres cochés ──
  const needle = search.trim().toLowerCase();
  const matchesSearch = (c: Convo): boolean => {
    if (!needle) return true;
    // Le nom de l'interlocuteur reste toujours interrogeable.
    if (c.label.toLowerCase().includes(needle)) return true;
    return c.emails.some((e) => {
      if (scopes.has('expediteur') && (e.expediteur ?? '').toLowerCase().includes(needle)) return true;
      if (scopes.has('destinataire') && e.destinataires.some((d) => d.toLowerCase().includes(needle))) return true;
      if (scopes.has('objet') && (e.sujet ?? '').toLowerCase().includes(needle)) return true;
      if (scopes.has('corps') && (e.corps ?? '').toLowerCase().includes(needle)) return true;
      if (scopes.has('piece_jointe') && (e.attachments ?? []).some((a) => (a.filename ?? '').toLowerCase().includes(needle))) return true;
      return false;
    });
  };

  const matchesReponse = (c: Convo): boolean => {
    if (reponseFilter === 'closes') return c.closed;
    if (c.closed) return false; // une discussion close sort des listes « à traiter »
    if (reponseFilter === 'repondu') return c.answered;
    if (reponseFilter === 'non_repondu') return !c.answered;
    return true;
  };

  const matchesOpp = (c: Convo): boolean => {
    if (!oppFilter) return true;
    if (oppFilter === 'aucune') return c.oppStage === null;
    return c.oppStage === oppFilter;
  };

  // Tri « par conseiller » : regroupement alphabétique, puis date à l'intérieur.
  const convoOwnerLabel = (c: Convo) =>
    c.owners.size > 0 ? [...c.owners].map(ownerName).filter(Boolean).sort().join(', ') : 'Direction';

  const convos = (view === 'orphelins' ? orphanConvos : mainConvos)
    .filter((c) => view === 'orphelins' || !ownerFilter || (ownerFilter === 'none' ? c.owners.size === 0 : c.owners.has(ownerFilter)))
    .filter(matchesSearch)
    .filter((c) => view === 'orphelins' || matchesReponse(c))
    .filter((c) => view === 'orphelins' || matchesOpp(c))
    .sort((a, b) => {
      if (sortBy !== 'conseiller') return 0; // déjà trié par date dans buildConvos
      const cmp = convoOwnerLabel(a).localeCompare(convoOwnerLabel(b), 'fr');
      return cmp !== 0 ? cmp : (a.lastAt < b.lastAt ? 1 : -1);
    });

  // ── Lien vers la fiche Contact (ticket « Messagerie : lien vers fiche dans contacts ») ──
  // Interlocuteur connu : ouverture de sa fiche par-dessus la messagerie.
  // Interlocuteur inconnu : bascule vers Contacts, formulaire « Nouveau contact »
  // pré-rempli avec l'adresse (et le nom si l'en-tête en porte un). Contacts se
  // charge d'y ajouter les deux actions demandées à l'enregistrement.
  const [fiche, setFiche] = useState<Contact | null>(null);
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');

  /** « Jean Dupont <j@d.fr> » → { prenom: 'Jean', nom: 'Dupont' } ; vide si absent. */
  const parseDisplayName = (raw: string | null): { prenom: string; nom: string } => {
    const m = (raw ?? '').match(/^\s*"?([^"<]+?)"?\s*</);
    const parts = (m?.[1] ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { prenom: '', nom: '' };
    if (parts.length === 1) return { prenom: '', nom: parts[0] };
    return { prenom: parts[0], nom: parts.slice(1).join(' ') };
  };

  const openPeer = (c: Convo) => {
    if (c.contactId) {
      const ct = contacts.data.find((x) => x.id === c.contactId);
      if (ct) { setFiche(ct); return; }
    }
    const firstIn = newestFirst(c).find((e) => e.direction === 'entrant');
    const raw = firstIn?.expediteur ?? null;
    const email = emailAddr(raw) || (c.key.startsWith('addr:') ? c.key.slice(5) : '');
    const { prenom, nom } = parseDisplayName(raw);
    navigate('/contacts', {
      state: {
        nouveauContact: {
          email,
          prenom,
          nom: nom || email.split('@')[0] || 'Inconnu',
          telephone: c.key.startsWith('wa:') ? c.key.slice(3) : '',
          // Journalise le mail entrant reçu + la réponse à faire à la première heure ouvrable.
          actionsMessagerie: { sujet: firstIn?.sujet ?? null, recuLe: firstIn?.sent_at ?? firstIn?.created_at ?? null },
        },
      },
    });
  };

  // ── Clore / rouvrir une discussion ──
  const toggleClose = async (c: Convo) => {
    if (c.closed) {
      const { error } = await supabase.from('conversations_closes').delete().eq('cle', c.key);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase.from('conversations_closes')
        .insert({ cle: c.key, closed_by: session?.user.id ?? null });
      if (error) { alert(error.message); return; }
    }
    closes.refresh();
  };

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

      {/* Les bandeaux SMTP ne concernent que l'admin : `parametres` lui est réservée,
          un conseiller lisait `null` et voyait à tort « configuration incomplète ». */}
      {isAdmin && smtpOk === false && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Configuration SMTP incomplète. Renseignez l'hôte, l'utilisateur, le mot de passe et l'adresse d'expédition dans <strong>Paramètres → Serveur SMTP sortant</strong>.</p>
        </div>
      )}
      {isAdmin && smtpOk === true && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>SMTP configuré — l'envoi d'e-mails est opérationnel.</p>
        </div>
      )}

      {/* Synchronisation IMAP : automatique via cron, plus horodatage du dernier passage. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-sm text-muted">
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          Réception automatique toutes les <strong className="text-fg">{SYNC_EVERY}</strong>.
          {' '}Dernière synchronisation :{' '}
          <strong className="text-fg">{sync?.last_at ? formatDate(sync.last_at, 'dd/MM/yyyy à HH:mm') : 'jamais'}</strong>
          {sync?.ok === false && sync.error ? <span className="text-red-600 dark:text-red-400"> — échec : {sync.error}</span> : null}
          {sync?.ok !== false && typeof sync?.imported === 'number' ? ` — ${sync.imported} message(s) importé(s)` : ''}
        </span>
      </div>

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
        <div className="mb-1 flex items-center gap-2">
          <button
            onClick={() => setChrono((v) => !v)}
            title={chrono ? 'Actuellement : ordre chronologique (plus ancien en premier)' : 'Actuellement : plus récent en premier'}
            className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-sm text-muted transition hover:border-brand-400 hover:text-brand-600"
          >
            <ArrowDownUp className="h-4 w-4" />
            {chrono ? 'Chronologique' : 'Plus récent d’abord'}
          </button>
          {view === 'conversations' && isManager && (
            <select className="input max-w-[200px] py-1 text-sm" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="">Tous les conseillers</option>
              <option value="none">Direction (non affectés)</option>
              {profiles.data.map((p) => <option key={p.id} value={p.id}>{fullName(p.prenom, p.nom)}</option>)}
            </select>
          )}
        </div>
      </div>

      {view === 'orphelins' && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Messages reçus d'un interlocuteur inconnu (aucun contact, formateur ni candidat). Visibles <strong>uniquement par l'administrateur</strong>. Affectez-les à un contact pour les router.</p>
        </div>
      )}

      {/* ── Recherche & filtres ─────────────────────────────────────────────── */}
      <div className="mb-4 space-y-3 rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input
              className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher dans les messages…"
            />
          </div>
          {search && (
            <button onClick={() => setSearch('')} className="rounded-lg border border-line px-2.5 py-2 text-sm text-muted hover:text-fg">
              Effacer
            </button>
          )}
          <select className="input max-w-[210px] py-2 text-sm" value={reponseFilter} onChange={(e) => setReponseFilter(e.target.value as typeof reponseFilter)}>
            <option value="">Réponse : toutes</option>
            <option value="non_repondu">Sans réponse apportée</option>
            <option value="repondu">Réponse apportée</option>
            <option value="closes">Discussions closes</option>
          </select>
          <select className="input max-w-[210px] py-2 text-sm" value={oppFilter} onChange={(e) => setOppFilter(e.target.value)}>
            <option value="">Opportunité : toutes</option>
            <option value="aucune">Sans opportunité</option>
            {OPP_STAGE_ORDER.map((s) => <option key={s} value={s}>{OPP_STAGE_LABELS[s]}</option>)}
          </select>
          <select className="input max-w-[190px] py-2 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="date">Trier par date</option>
            <option value="conseiller">Trier par conseiller</option>
          </select>
        </div>

        {/* Périmètre de la recherche : à restreindre ou étendre au besoin. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
          <span className="font-medium">Rechercher dans :</span>
          {ALL_SCOPES.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox" checked={scopes.has(s)}
                onChange={() => setScopes((prev) => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; })}
              />
              {SCOPE_LABELS[s]}
            </label>
          ))}
          <button onClick={() => setScopes(new Set(ALL_SCOPES))} className="underline hover:text-fg">tout</button>
          <button onClick={() => setScopes(new Set())} className="underline hover:text-fg">aucun</button>
        </div>
      </div>

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
            const last = newestFirst(c)[0];
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
                        {/* Statut de traitement : réponse apportée / attendue / discussion close. */}
                        {c.closed
                          ? <Badge tone="neutral">Discussion close</Badge>
                          : c.answered ? <Badge tone="success">Répondu</Badge> : <Badge tone="warning">Sans réponse</Badge>}
                        {c.oppStage && <Badge tone="info">Opportunité · {OPP_STAGE_LABELS[c.oppStage]}</Badge>}
                        {/* Repère visuel : un brouillon attend d'être finalisé dans ce fil. */}
                        {c.emails.some((e) => e.statut === 'brouillon') && <Badge tone="warning">Brouillon à finaliser</Badge>}
                      </div>
                    </div>
                  </button>

                  {/* Accès direct à la fiche du contact, ou création si l'interlocuteur est inconnu. */}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => openPeer(c)}
                      title={c.contactId ? 'Ouvrir la fiche du contact' : 'Créer ce contact dans Contacts'}
                      className="rounded p-1.5 text-muted hover:text-brand-600"
                    >
                      {c.contactId ? <UserRound className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => toggleClose(c)}
                      title={c.closed ? 'Rouvrir la discussion' : 'Clore la discussion (aucune réponse attendue)'}
                      className={cn('rounded p-1.5 hover:text-brand-600', c.closed ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted')}
                    >
                      {c.closed ? <CircleSlash2 className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />}
                    </button>
                  </div>
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
                                {e.direction === 'sortant' && e.statut === 'brouillon' && (
                                  <button onClick={() => editDraft(e)} title="Reprendre le brouillon" className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-500/10 dark:text-brand-400">
                                    <Pencil className="h-3.5 w-3.5" /> Reprendre
                                  </button>
                                )}
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

      {/* Composition multi-canal (modale partagée avec la fiche contact) */}
      <ComposeMessageModal open={open} onClose={() => setOpen(false)} onSent={refresh} initial={composeInitial} />

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

      {/* Fiche du contact ouverte depuis une conversation */}
      {fiche && (
        <ContactFiche
          key={fiche.id}
          contact={contacts.data.find((x) => x.id === fiche.id) ?? fiche}
          entreprises={entreprises.data}
          financeurs={financeurs.data}
          profiles={profiles.data}
          onClose={() => setFiche(null)}
          onEdit={() => { setFiche(null); navigate('/contacts'); }}
          onUpdated={() => contacts.refresh()}
        />
      )}
    </div>
  );
}
