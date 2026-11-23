import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Info, RefreshCw, TriangleAlert, Search, SlidersHorizontal } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Spinner, EmptyState } from '@/components/ui';
import { formatDate, fullName, cn } from '@/lib/utils';
import ComposeMessageModal, { type ComposeInitial } from '@/components/ComposeMessageModal';
import ContactFiche from '@/components/ContactFiche';
import { usePipelineColonnes } from '@/lib/pipeline';
import type {
  Email, Contact, Profile, Formateur, Candidat,
  Opportunite, OpportuniteStage, ConversationClose, Entreprise, Financeur,
} from '@/lib/database.types';
import {
  ALL_SCOPES, atOf, emailAddr, estIA, expediteurDuMessage, fwdSubject, interlocuteurDe, parseDisplayName,
  reSubject, regrouperConversations, type Convo, type Scope, type SmtpCfg, type SyncInfo, type View,
} from './messagerie/conversations';
import { FiltresAvances } from './messagerie/FiltresAvances';
import { ListeEnvoyes } from './messagerie/ListeEnvoyes';
import { ListeConversations } from './messagerie/ListeConversations';
import { ModaleAffectation } from './messagerie/ModaleAffectation';

/**
 * Messagerie : une conversation par interlocuteur, e-mail et WhatsApp réunis, plus la vue « Envoyés ».
 * Les règles de regroupement sont dans `messagerie/conversations.ts`, les listes et les filtres
 * avancés dans `messagerie/` ; cette page charge les données et tient filtres, sélection et actions.
 */
export default function Messagerie() {
  const { isManager, isAdmin, session } = useAuth();
  const { colonnes: colonnesPipeline } = usePipelineColonnes();
  const navigate = useNavigate();
  const { data, loading, refresh } = useCollection<Email>('emails', { orderBy: { column: 'created_at', ascending: false } });
  // Un mail entrant relevé par le cron IMAP apparaît sans « Synchroniser ».
  useRealtimeRefresh('emails', refresh);
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
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [reponseFilter, setReponseFilter] = useState<'' | 'repondu' | 'non_repondu' | 'closes'>('');
  const [oppFilter, setOppFilter] = useState('');           // '' | 'aucune' | <stage>
  const [sortBy, setSortBy] = useState<'date' | 'conseiller'>('date');
  // Dates, opportunité, tri et périmètre de recherche : rangés, ouverts à la demande.
  const [avance, setAvance] = useState(false);

  const opportunites = useCollection<Opportunite>('opportunites');
  const closes = useCollection<ConversationClose>('conversations_closes');
  const closedKeys = new Set(closes.data.map((c) => c.cle));
  // Opportunité la plus récente par contact (une conversation = un interlocuteur).
  const oppByContact = new Map<string, OpportuniteStage>();
  for (const o of opportunites.data) {
    if (o.contact_id && !oppByContact.has(o.contact_id)) oppByContact.set(o.contact_id, o.stage);
  }

  const ownerName = (id: string | null) => { const p = profiles.data.find((x) => x.id === id); return p ? fullName(p.prenom, p.nom) : null; };

  // Expéditeur d'un message sortant (IA, automate ou utilisateur) et interlocuteur d'un message.
  const expediteurDe = (e: Email) => expediteurDuMessage(e, ownerName);
  const resolvePeer = (e: Email) => interlocuteurDe(e, contacts.data, formateurs.data, candidats.data);

  const allConvos = regrouperConversations({ data, chrono, closedKeys, oppByContact, resolvePeer });
  const isOrphan = (c: Convo) => !c.matched && c.hasInbound;
  const orphanConvos = allConvos.filter(isOrphan);
  const mainConvos = allConvos.filter((c) => !isOrphan(c));

  // ── Affectation manuelle d'un e-mail (ou de tout le fil) à un contact ──
  const [assignTarget, setAssignTarget] = useState<Email | null>(null);

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
  }, []);

  const [view, setView] = useState<View>('conversations');

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

  /**
   * Transfert d'un message : la composition s'ouvre avec le destinataire à
   * saisir, l'objet préfixé « Fwd: », le message d'origine cité en en-tête et
   * ses pièces jointes reprises telles quelles.
   *
   * Le rattachement au contact et au dossier d'origine est conservé : dans un
   * CRM, transférer les pièces d'un candidat à un financeur fait partie du
   * suivi de l'affaire et doit rester dans son fil. Le bouton « Affecter »
   * permet de le déplacer si le transfert ne concernait pas ce contact.
   */
  const forward = (e: Email) => {
    const entete = [
      '',
      '---------- Message transféré ----------',
      `De : ${e.expediteur ?? '—'}`,
      `Date : ${formatDate(e.sent_at ?? e.created_at, 'dd/MM/yyyy HH:mm')}`,
      `Objet : ${e.sujet || '(sans objet)'}`,
      `À : ${e.destinataires.join(', ') || '—'}`,
      '',
    ].join('\n');
    setComposeInitial({
      canal: 'email',
      dest: '',
      titre: 'Transférer le message',
      sujet: fwdSubject(e.sujet),
      corps: `${entete}${e.corps ?? ''}`,
      dossierId: e.dossier_id ?? undefined,
      contactId: e.contact_id,
      attachments: e.attachments ?? [],
    });
    setOpen(true);
  };

  // Reprise d'un brouillon : rouvre la modale de composition pré-remplie et
  // rattachée à la ligne existante (ticket Benjamin « brouillon impossible à rouvrir »).
  const editDraft = (e: Email) => {
    setComposeInitial({
      canal: e.canal === 'whatsapp' ? 'whatsapp' : 'email',
      dest: e.destinataires.join(', '),
      copie: (e.copie ?? []).join(', '),
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
    void refresh();
  };

  // Lu / non lu : permet de remettre un message dans les « à traiter ».
  const toggleLu = async (e: Email) => {
    const { error } = await supabase.from('emails').update({ lu: !e.lu }).eq('id', e.id);
    if (error) { alert(error.message); return; }
    void refresh();
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
    void refresh();
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

  // Fourchette de dates : la conversation est retenue si au moins un de ses
  // messages tombe dans l'intervalle (bornes incluses, vides = pas de limite).
  const matchesDate = (c: Convo): boolean => {
    if (!dateDebut && !dateFin) return true;
    return c.emails.some((e) => {
      const j = (e.sent_at ?? e.created_at ?? '').slice(0, 10);
      if (!j) return false;
      if (dateDebut && j < dateDebut) return false;
      if (dateFin && j > dateFin) return false;
      return true;
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

  const parDate = (list: Convo[]) => (sortBy !== 'conseiller' ? list : [...list].sort((a, b) => {
    // Tri « par conseiller » ; sinon l'ordre par date de buildConvos est gardé.
    const cmp = convoOwnerLabel(a).localeCompare(convoOwnerLabel(b), 'fr');
    return cmp !== 0 ? cmp : (a.lastAt < b.lastAt ? 1 : -1);
  }));
  // Tout sauf le statut de réponse : sert aussi aux compteurs des pastilles.
  const base = mainConvos
    .filter((c) => !ownerFilter || (ownerFilter === 'none' ? c.owners.size === 0 : c.owners.has(ownerFilter)))
    .filter(matchesSearch).filter(matchesDate).filter(matchesOpp);
  const orphelinsFiltres = orphanConvos.filter(matchesSearch).filter(matchesDate);
  const convos = parDate(view === 'orphelins' ? orphelinsFiltres : base.filter(matchesReponse));
  const enCours = base.filter((c) => !c.closed);

  // ── Vue « Envoyés » : tous les e-mails partis du CRM, un par ligne ──
  const [expFilter, setExpFilter] = useState<'' | 'ia' | 'humain' | 'automatique'>('');
  const sentAll = data.filter((e) => e.direction === 'sortant' && e.canal !== 'whatsapp' && e.statut !== 'brouillon');
  const sentMatches = (e: Email): boolean => {
    const x = expediteurDe(e);
    if (expFilter === 'ia' && !estIA(x.origine)) return false;
    if (expFilter === 'humain' && x.origine !== 'utilisateur') return false;
    if (expFilter === 'automatique' && x.origine !== 'automatique') return false;
    const j = atOf(e).slice(0, 10);
    if (dateDebut && j < dateDebut) return false;
    if (dateFin && j > dateFin) return false;
    if (!needle) return true;
    if (resolvePeer(e).label.toLowerCase().includes(needle)) return true;
    if (x.label.toLowerCase().includes(needle)) return true;
    if (scopes.has('destinataire') && [...e.destinataires, ...(e.copie ?? [])].some((d) => d.toLowerCase().includes(needle))) return true;
    if (scopes.has('objet') && (e.sujet ?? '').toLowerCase().includes(needle)) return true;
    if (scopes.has('corps') && (e.corps ?? '').toLowerCase().includes(needle)) return true;
    if (scopes.has('piece_jointe') && (e.attachments ?? []).some((a) => (a.filename ?? '').toLowerCase().includes(needle))) return true;
    return false;
  };
  const sentList = sentAll.filter(sentMatches)
    .sort((a, b) => (atOf(a) < atOf(b) ? 1 : -1) * (chrono ? -1 : 1));
  const sentIA = sentAll.filter((e) => estIA(expediteurDe(e).origine)).length;
  const pastilles: { cle: string; label: string; n: number; actif: boolean; alerte?: boolean; choisir: () => void }[] = [
    { cle: 'a_repondre', label: 'À répondre', n: enCours.filter((c) => !c.answered).length, alerte: true, actif: view === 'conversations' && reponseFilter === 'non_repondu', choisir: () => { changeView('conversations'); setReponseFilter('non_repondu'); } },
    { cle: 'en_cours', label: 'En cours', n: enCours.length, actif: view === 'conversations' && reponseFilter === '', choisir: () => { changeView('conversations'); setReponseFilter(''); } },
    { cle: 'repondu', label: 'Répondues', n: enCours.filter((c) => c.answered).length, actif: view === 'conversations' && reponseFilter === 'repondu', choisir: () => { changeView('conversations'); setReponseFilter('repondu'); } },
    { cle: 'closes', label: 'Closes', n: base.filter((c) => c.closed).length, actif: view === 'conversations' && reponseFilter === 'closes', choisir: () => { changeView('conversations'); setReponseFilter('closes'); } },
    // Tous les e-mails partis du CRM, humains comme IA.
    { cle: 'envoyes', label: 'Envoyés', n: sentList.length, actif: view === 'envoyes', choisir: () => changeView('envoyes') },
    // Interlocuteurs inconnus : réservés à l'administrateur.
    ...(isAdmin ? [{ cle: 'orphelins', label: 'Non rattachés', n: orphelinsFiltres.length, actif: view === 'orphelins', choisir: () => changeView('orphelins') }] : []),
  ];
  const scopesRestreints = scopes.size !== ALL_SCOPES.length;
  const nbAvances = [dateDebut, dateFin, oppFilter, sortBy !== 'date', chrono, scopesRestreints].filter(Boolean).length;
  const effacerAvances = () => { setDateDebut(''); setDateFin(''); setOppFilter(''); setSortBy('date'); setChrono(false); setScopes(new Set(ALL_SCOPES)); };

  // ── Lien vers la fiche Contact (ticket « Messagerie : lien vers fiche dans contacts ») ──
  // Interlocuteur connu : ouverture de sa fiche par-dessus la messagerie.
  // Interlocuteur inconnu : bascule vers Contacts, formulaire « Nouveau contact »
  // pré-rempli avec l'adresse (et le nom si l'en-tête en porte un). Contacts se
  // charge d'y ajouter les deux actions demandées à l'enregistrement.
  const [fiche, setFiche] = useState<Contact | null>(null);
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');


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
    void closes.refresh();
  };

  // Sélection (par conversation -> tous ses messages)
  const convoIds = (c: Convo) => c.emails.map((e) => e.id);
  const visibleIds = view === 'envoyes' ? sentList.map((e) => e.id) : convos.flatMap(convoIds);
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
    void refresh();
  };


  return (
    <div>
      <PageHeader
        title="Messagerie"
        subtitle="Une conversation par interlocuteur, e-mail et WhatsApp réunis"
        actions={<Button onClick={compose}><Plus className="h-4 w-4" /> Nouveau message</Button>}
      />

      {/* Le bandeau SMTP ne concerne que l'admin : `parametres` lui est réservée,
          un conseiller lisait `null` et voyait à tort « configuration incomplète ».
          Il n'apparaît que s'il y a quelque chose à corriger. */}
      {isAdmin && smtpOk === false && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Configuration SMTP incomplète. Renseignez l'hôte, l'utilisateur, le mot de passe et l'adresse d'expédition dans <strong>Paramètres → Serveur SMTP sortant</strong>.</p>
        </div>
      )}

      {/* Où en sont les conversations, et le relevé du courrier */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {pastilles.map((p) => {
          const actif = p.actif;
          return (
            <button key={p.cle} onClick={p.choisir} aria-pressed={actif} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition', actif ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'border-line text-muted hover:bg-surface-2 hover:text-fg')}>
              {p.label}
              <span className={cn('text-xs tabular-nums', p.alerte && p.n > 0 ? 'rounded-full bg-amber-500 px-1.5 font-bold text-white' : 'opacity-70')}>{p.n}</span>
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted">
          {sync?.ok === false && sync.error
            ? <span className="text-red-600 dark:text-red-400">Relevé en échec : {sync.error}</span>
            : <span title="Le courrier est relevé automatiquement toutes les 5 minutes">{sync?.last_at ? `Courrier relevé le ${formatDate(sync.last_at, 'dd/MM à HH:mm')}` : 'Courrier pas encore relevé'}</span>}
          <button onClick={syncInbox} disabled={syncing} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 font-medium hover:bg-surface-2 hover:text-fg disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} /> Relever maintenant
          </button>
        </span>
      </div>

      {view === 'orphelins' && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Messages reçus d'un interlocuteur inconnu (aucun contact, formateur ni candidat). Visibles <strong>uniquement par l'administrateur</strong>. Créez le contact ou affectez le message pour le confier à un conseiller.</p>
        </div>
      )}

      {/* ── Recherche & filtres ─────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un interlocuteur, un objet, un texte…"
          />
        </div>
        {view === 'envoyes' && (
          <select className="input max-w-[230px]" value={expFilter} onChange={(e) => setExpFilter(e.target.value as typeof expFilter)} title="Qui a envoyé">
            <option value="">Expéditeur : tous</option>
            <option value="ia">Envoyés par une IA ({sentIA})</option>
            <option value="humain">Envoyés par un utilisateur</option>
            <option value="automatique">Envois automatiques</option>
          </select>
        )}
        {view === 'conversations' && isManager && (
          <select className="input max-w-[210px]" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="">Tous les conseillers</option>
            <option value="none">Direction (non affectés)</option>
            {profiles.data.map((p) => <option key={p.id} value={p.id}>{fullName(p.prenom, p.nom)}</option>)}
          </select>
        )}
        <button onClick={() => setAvance((v) => !v)} aria-expanded={avance}
          className={cn('inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition', avance || nbAvances > 0 ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-line text-muted hover:text-fg')}>
          <SlidersHorizontal className="h-4 w-4" /> Filtres{nbAvances > 0 ? ` (${nbAvances})` : ''}
        </button>
      </div>

      {avance && (
        <FiltresAvances
          dateDebut={dateDebut} setDateDebut={setDateDebut}
          dateFin={dateFin} setDateFin={setDateFin}
          oppFilter={oppFilter} setOppFilter={setOppFilter}
          colonnesPipeline={colonnesPipeline}
          sortBy={sortBy} setSortBy={setSortBy}
          chrono={chrono} setChrono={setChrono}
          scopes={scopes} setScopes={setScopes}
          nbAvances={nbAvances} effacerAvances={effacerAvances}
        />
      )}

      {!loading && visibleIds.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} /> Tout sélectionner ({view === 'envoyes' ? sentList.length : convos.length})
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
      ) : view === 'envoyes' ? (
        sentList.length === 0 ? (
          <EmptyState title="Aucun e-mail envoyé" message={sentAll.length ? 'Aucun envoi ne correspond aux filtres.' : undefined} />
        ) : (
          <ListeEnvoyes
            sentList={sentList}
            selection={selection}
            setSelection={setSelection}
            resolvePeer={resolvePeer}
            expediteurDe={expediteurDe}
            contacts={contacts.data}
            setFiche={setFiche}
            forward={forward}
            remove={remove}
          />
        )
      ) : convos.length === 0 ? (
        <EmptyState
          title={view === 'orphelins' ? 'Aucun message non rattaché' : reponseFilter === 'non_repondu' ? 'Tout le monde a eu une réponse' : 'Aucune conversation'}
          message={view === 'orphelins' || reponseFilter === 'non_repondu' ? undefined : 'Changez de vue ou videz la recherche.'}
        />
      ) : (
        <ListeConversations
          convos={convos}
          newestFirst={newestFirst}
          affectationLabel={affectationLabel}
          convoSelected={convoSelected}
          toggleConvo={toggleConvo}
          expediteurDe={expediteurDe}
          reply={reply}
          openPeer={openPeer}
          toggleClose={toggleClose}
          editDraft={editDraft}
          forward={forward}
          toggleLu={toggleLu}
          openAssign={setAssignTarget}
          remove={remove}
        />
      )}

      {/* Composition multi-canal (modale partagée avec la fiche contact) */}
      <ComposeMessageModal open={open} onClose={() => setOpen(false)} onSent={refresh} initial={composeInitial} />

      {/* Affectation d'un e-mail / d'une conversation à un contact */}
      {assignTarget && (
        <ModaleAffectation
          key={assignTarget.id}
          assignTarget={assignTarget}
          contacts={contacts.data}
          onClose={() => setAssignTarget(null)}
          refresh={refresh}
        />
      )}

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
