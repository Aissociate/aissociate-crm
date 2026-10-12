// Chat de l'assistant IA agentique — branché sur l'Edge Function `agent` (SSE).
// Composant partagé : page /assistant (plein écran) et fiches (panneau embarqué,
// prop `compact`). L'IA consulte le CRM via des outils (périmètre = RLS de
// l'utilisateur) et PROPOSE ses écritures : chaque action apparaît en carte
// « Valider / Annuler » et n'est exécutée qu'après validation explicite.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot, Send, User, FileText, Sparkles, Plus, History, Check, X,
  Wrench, CircleCheck, CircleX, TriangleAlert, Pencil, Eye, CheckCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Spinner, Badge } from '@/components/ui';
import DicteeVocale from '@/components/DicteeVocale';
import type { EntiteRef } from '@/components/ApercuEntite';
import type { AiAction, AiConversation } from '@/lib/database.types';

type Source = { label: string; url: string | null };
type Etape = { outil: string; label: string };
type Msg = {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  etapes?: Etape[];
  actionIds?: string[];
};
/** Contexte transmis par les fiches (ContactFiche / DossierDetail). */
export type AssistantContexte = { type: 'contact' | 'dossier'; id: string; label: string };

const SUGGESTIONS_DEFAUT = [
  'Quels sont mes contacts à relancer en priorité ?',
  'Où en est le pipeline ? Donne-moi les chiffres par étape.',
  'Quels devis envoyés arrivent à expiration ?',
  'Que dit la documentation sur la procédure AGEFICE ?',
  'Quelles sessions de formation sont planifiées prochainement ?',
  'Prépare une relance pour les prospects sans action planifiée.',
];

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent`;

/** Parse un flux SSE et invoque `onEvent(event, data)` pour chaque message. */
async function readSse(res: Response, onEvent: (event: string, data: Record<string, unknown>) => void) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Flux de réponse vide');
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = 'message';
      let data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (data) {
        // Seul le parse est protégé : une exception levée par onEvent (ex.
        // l'événement `error` du serveur) doit remonter à l'appelant, sinon
        // le vrai message d'erreur est remplacé par « Flux interrompu ».
        let parsed: Record<string, unknown> | null = null;
        try { parsed = JSON.parse(data); } catch { /* fragment illisible */ }
        if (parsed) onEvent(event, parsed);
      }
    }
  }
}

/** Libellés lisibles des arguments modifiables d'une proposition. */
const LIBELLES_ARGS: Record<string, string> = {
  destinataire: 'Destinataire', sujet: 'Objet', corps: 'Message', note: 'Note',
  description: 'Description', type: 'Type', date_action: 'Date (AAAA-MM-JJ)', heure_action: 'Heure (HH:MM)',
  statut_prospect: 'Statut', statut: 'Statut', etape: 'Étape', nom: 'Nom', prenom: 'Prénom',
  email: 'Email', telephone: 'Téléphone', ville: 'Ville', besoin_resume: 'Besoin',
};
const CHAMPS_LONGS = new Set(['corps', 'note', 'description', 'besoin_resume']);

/** Arguments que l'utilisateur peut retoucher : textes, hors identifiants. */
function argsModifiables(action: AiAction): [string, string][] {
  return Object.entries(action.args ?? {})
    .filter(([k, v]) => typeof v === 'string' && !k.endsWith('_id'))
    .map(([k, v]) => [k, v as string]);
}

/** Fiche visée par une proposition, pour l'aperçu du mode avancé. */
export function entiteDeAction(action: AiAction): EntiteRef | null {
  const a = action.args ?? {};
  if (typeof a.dossier_id === 'string') return { type: 'dossier', id: a.dossier_id };
  if (typeof a.opportunite_id === 'string') return { type: 'opportunite', id: a.opportunite_id };
  if (typeof a.contact_id === 'string') return { type: 'contact', id: a.contact_id };
  const entite = action.resultat?.entite, id = action.resultat?.entite_id;
  if (entite === 'contacts' && typeof id === 'string') return { type: 'contact', id };
  return null;
}

type CardProps = {
  action: AiAction;
  onDecision: (id: string, mode: 'execute' | 'cancel') => Promise<void>;
  selectionnee: boolean;
  onSelection: (id: string, v: boolean) => void;
  modifs: Record<string, string> | undefined;
  onModif: (id: string, cle: string, valeur: string) => void;
  onVoir?: (e: EntiteRef) => void;
};

/** Carte de validation d'une action proposée par l'IA. */
function ActionCard({ action, onDecision, selectionnee, onSelection, modifs, onModif, onVoir }: CardProps) {
  const [busy, setBusy] = useState<'execute' | 'cancel' | null>(null);
  const [edition, setEdition] = useState(false);
  const decide = async (mode: 'execute' | 'cancel') => {
    setBusy(mode);
    try { await onDecision(action.id, mode); } finally { setBusy(null); }
  };
  const statutUi: Record<string, { icon: JSX.Element; text: string; cls: string }> = {
    executee: { icon: <CircleCheck className="h-4 w-4" />, text: 'Exécutée', cls: 'text-emerald-600 dark:text-emerald-400' },
    annulee: { icon: <CircleX className="h-4 w-4" />, text: 'Annulée', cls: 'text-muted' },
    expiree: { icon: <CircleX className="h-4 w-4" />, text: 'Expirée (non traitée sous 24 h)', cls: 'text-muted' },
    erreur: { icon: <TriangleAlert className="h-4 w-4" />, text: `Erreur : ${(action.resultat?.erreur as string) ?? 'inconnue'}`, cls: 'text-red-600 dark:text-red-400' },
  };
  const enAttente = action.statut === 'proposee';
  const champs = argsModifiables(action);
  const entite = entiteDeAction(action);
  const modifiee = modifs && Object.keys(modifs).length > 0;
  return (
    <div className={`mt-2 rounded-lg border p-3 ${enAttente && !selectionnee ? 'border-line bg-surface-2/50' : 'border-brand-500/30 bg-brand-500/5'}`}>
      <div className="flex items-start gap-2">
        {enAttente ? (
          <input type="checkbox" checked={selectionnee} onChange={(e) => onSelection(action.id, e.target.checked)}
            title="Inclure dans la validation groupée" className="mt-1 h-4 w-4 shrink-0 accent-brand-500" />
        ) : (
          <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
            Action proposée{modifiee ? ' · modifiée' : ''}
          </p>
          <p className="mt-0.5 break-words text-sm text-fg">{action.description}</p>
          {edition && enAttente ? (
            <div className="mt-2 space-y-2">
              {champs.map(([cle, valeur]) => {
                const v = modifs?.[cle] ?? valeur;
                return (
                  <label key={cle} className="block">
                    <span className="text-xs text-muted">{LIBELLES_ARGS[cle] ?? cle}</span>
                    {CHAMPS_LONGS.has(cle) ? (
                      <textarea className="input mt-0.5 min-h-[90px] text-sm" value={v} onChange={(e) => onModif(action.id, cle, e.target.value)} />
                    ) : (
                      <input className="input mt-0.5 text-sm" value={v} onChange={(e) => onModif(action.id, cle, e.target.value)} />
                    )}
                  </label>
                );
              })}
            </div>
          ) : action.outil === 'proposer_envoi_email' && enAttente && (
            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-line bg-surface p-2 text-xs text-muted">
              {String(modifs?.corps ?? action.args.corps ?? '')}
            </pre>
          )}
        </div>
      </div>
      {enAttente ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={() => decide('execute')} disabled={busy !== null} className="!px-3 !py-1.5 text-sm">
            {busy === 'execute' ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />} Valider
          </Button>
          {champs.length > 0 && (
            <Button variant="ghost" onClick={() => setEdition((v) => !v)} disabled={busy !== null} className="!px-3 !py-1.5 text-sm">
              <Pencil className="h-4 w-4" /> {edition ? 'Fermer' : 'Modifier'}
            </Button>
          )}
          <Button variant="ghost" onClick={() => decide('cancel')} disabled={busy !== null} className="!px-3 !py-1.5 text-sm">
            <X className="h-4 w-4" /> Refuser
          </Button>
          {entite && onVoir && (
            <Button variant="ghost" onClick={() => onVoir(entite)} className="!px-3 !py-1.5 text-sm">
              <Eye className="h-4 w-4" /> Voir la fiche
            </Button>
          )}
        </div>
      ) : (
        <p className={`mt-2 flex items-center gap-1.5 text-sm ${statutUi[action.statut]?.cls ?? 'text-muted'}`}>
          {statutUi[action.statut]?.icon} {statutUi[action.statut]?.text}
        </p>
      )}
    </div>
  );
}

type Props = {
  /** Fiche d'origine : oriente l'IA et filtre l'historique des conversations. */
  contexte?: AssistantContexte | null;
  /** Panneau embarqué dans une fiche : espacements réduits, accueil resserré. */
  compact?: boolean;
  suggestions?: string[];
  /** « jarvis » : présentation épurée du mode avancé (pas de cadre, fil centré). */
  variant?: 'standard' | 'jarvis';
  /** Fiche concernée par la dernière proposition (aperçu du mode avancé). */
  onEntite?: (e: EntiteRef) => void;
};

export default function AssistantChat({
  contexte = null, compact = false, suggestions = SUGGESTIONS_DEFAUT, variant = 'standard', onEntite,
}: Props) {
  const { isManager, profile } = useAuth();
  const jarvis = variant === 'jarvis';
  // Sélection pour la validation groupée (cochée par défaut) et retouches
  // apportées aux arguments avant exécution.
  const [deselection, setDeselection] = useState<Record<string, boolean>>({});
  const [modifs, setModifs] = useState<Record<string, Record<string, string>>>({});
  const [lotEnCours, setLotEnCours] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [actions, setActions] = useState<Record<string, AiAction>>({});
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveSteps, setLiveSteps] = useState<Etape[]>([]);
  const [mode, setMode] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, liveSteps]);

  const loadConversations = useCallback(async () => {
    const { data } = await supabase.from('ai_conversations')
      .select('*').order('updated_at', { ascending: false }).limit(60);
    setConversations(data ?? []);
  }, []);
  useEffect(() => { void loadConversations(); }, [loadConversations]);

  // Depuis une fiche, l'historique montre les conversations DE cette fiche.
  const conversationsVisibles = contexte
    ? conversations.filter((c) => (c.contexte as AssistantContexte | null)?.id === contexte.id)
    : conversations;

  const openConversation = async (id: string) => {
    setShowHistory(false);
    setConversationId(id);
    setDeselection({});
    setModifs({});
    const [{ data: msgs }, { data: acts }] = await Promise.all([
      supabase.from('ai_messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }).limit(100),
      supabase.from('ai_actions').select('*').eq('conversation_id', id).order('created_at', { ascending: true }),
    ]);
    const actMap: Record<string, AiAction> = {};
    for (const a of acts ?? []) actMap[a.id] = a;
    setActions(actMap);
    // Les actions sont rattachées au dernier message assistant qui les précède
    // (approximation suffisante pour la relecture d'un fil).
    const loaded: Msg[] = (msgs ?? []).map((m) => ({
      role: m.role, content: m.content, etapes: m.etapes ?? undefined,
    }));
    const lastAssistant = loaded.map((m) => m.role).lastIndexOf('assistant');
    if (lastAssistant >= 0) loaded[lastAssistant].actionIds = (acts ?? []).map((a) => a.id);
    setMessages(loaded);
  };

  const newConversation = () => {
    setConversationId(null);
    setMessages([]);
    setActions({});
    setDeselection({});
    setModifs({});
    setShowHistory(false);
  };

  const decideAction = async (id: string, decision: 'execute' | 'cancel') => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    const retouches = decision === 'execute' ? modifs[id] : undefined;
    try {
      const res = await fetch(FUNCTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ mode: decision, action_id: id, ...(retouches ? { args: retouches } : {}) }),
      });
      const body = await res.json();
      setActions((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          args: retouches ? { ...prev[id]?.args, ...retouches } : prev[id]?.args,
          statut: res.ok ? (decision === 'execute' ? 'executee' : 'annulee') : 'erreur',
          resultat: res.ok
            ? (body?.entite ? { entite: body.entite, entite_id: body.entite_id } : prev[id]?.resultat ?? null)
            : { erreur: body?.error ?? `HTTP ${res.status}` },
        },
      }));
    } catch (err) {
      setActions((prev) => ({
        ...prev,
        [id]: { ...prev[id], statut: 'erreur', resultat: { erreur: err instanceof Error ? err.message : String(err) } },
      }));
    }
  };

  const enAttente = Object.values(actions).filter((a) => a.statut === 'proposee');
  const selection = enAttente.filter((a) => !deselection[a.id]);

  /** Validation (ou refus) groupée, une action après l'autre : l'ordre compte
   *  (créer un contact avant de lui planifier une relance). */
  const deciderLot = async (decision: 'execute' | 'cancel') => {
    const cibles = decision === 'execute' ? selection : enAttente;
    setLotEnCours(true);
    try {
      const ordre = cibles.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
      for (const a of ordre) await decideAction(a.id, decision);
    } finally { setLotEnCours(false); }
  };

  const modifier = (id: string, cle: string, valeur: string) =>
    setModifs((prev) => ({ ...prev, [id]: { ...prev[id], [cle]: valeur } }));

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);
    setLiveSteps([]);

    const turnActionIds: string[] = [];
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Session expirée, reconnectez-vous.');

      const res = await fetch(FUNCTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ mode: 'chat', message: q, conversation_id: conversationId, contexte }),
      });
      if (!res.ok || !res.headers.get('Content-Type')?.includes('text/event-stream')) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
      }

      let finished = false;
      await readSse(res, (event, data) => {
        if (event === 'meta') {
          if (data.conversation_id) setConversationId(String(data.conversation_id));
          if (data.role) setMode(String(data.role));
        } else if (event === 'step') {
          setLiveSteps((s) => [...s, { outil: String(data.outil), label: String(data.label) }]);
        } else if (event === 'action') {
          const a = data as unknown as AiAction;
          turnActionIds.push(a.id);
          const recue = { ...a, statut: 'proposee', resultat: null, created_at: a.created_at ?? new Date().toISOString() } as AiAction;
          setActions((prev) => ({ ...prev, [a.id]: recue }));
          const entite = entiteDeAction(recue);
          if (entite) onEntite?.(entite);
        } else if (event === 'done') {
          finished = true;
          setMessages((m) => [...m, {
            role: 'assistant',
            content: String(data.answer ?? '—'),
            sources: (data.sources as Source[]) ?? [],
            etapes: undefined,
            actionIds: turnActionIds.length ? [...turnActionIds] : undefined,
          }]);
        } else if (event === 'error') {
          throw new Error(String(data.message ?? 'Erreur inconnue'));
        }
      });
      if (!finished) throw new Error('Flux interrompu avant la réponse.');
      void loadConversations();
    } catch (err) {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: `⚠️ ${err instanceof Error ? err.message : String(err)}\n\nVérifiez le déploiement de l'Edge Function « agent » et la clé OpenRouter (Paramètres › IA).`,
      }]);
    } finally {
      setLoading(false);
      setLiveSteps([]);
    }
  };

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${jarvis ? '' : 'bg-surface'} ${compact || jarvis ? '' : 'rounded-xl border border-line'}`}>
      {/* Barre d'outils du fil : mode, historique, nouvelle conversation */}
      <div className={`flex items-center justify-between gap-2 ${jarvis ? '' : 'border-b border-line'} ${compact ? 'px-3 py-2' : 'px-4 py-2.5'}`}>
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted">
          <Bot className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
          {contexte
            ? <span className="truncate">Assistant sur <strong className="text-fg">{contexte.label}</strong></span>
            : <span>Assistant IA</span>}
          {mode && <Badge tone={mode === 'direction' ? 'info' : 'brand'}>{mode === 'direction' ? 'Direction' : 'Conseiller'}</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => setShowHistory((v) => !v)} title="Conversations précédentes"
            className={`rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg ${showHistory ? 'bg-surface-2 text-fg' : ''}`}>
            <History className="h-4 w-4" />
          </button>
          <button onClick={newConversation} title="Nouvelle conversation"
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Historique des conversations (panneau) */}
      {showHistory && (
        <div className="absolute inset-y-11 right-0 z-10 w-full max-w-sm overflow-y-auto border-l border-line bg-surface p-3 shadow-lg">
          <p className="mb-2 text-sm font-medium text-fg">{contexte ? 'Conversations sur cette fiche' : 'Conversations récentes'}</p>
          {conversationsVisibles.length === 0 && <p className="text-sm text-muted">Aucune conversation enregistrée.</p>}
          <div className="space-y-1">
            {conversationsVisibles.map((c) => (
              <button key={c.id} onClick={() => void openConversation(c.id)}
                className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:border-brand-300 hover:bg-surface-2 ${c.id === conversationId ? 'border-brand-500/40 bg-brand-500/5 text-fg' : 'border-line text-fg'}`}>
                <span className="line-clamp-2">{c.titre}</span>
                <span className="mt-0.5 block text-xs text-muted">{new Date(c.updated_at).toLocaleDateString('fr-FR')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fil de conversation */}
      <div className={`flex-1 overflow-y-auto ${compact ? 'p-3' : 'p-4'}`}>
       <div className={`space-y-4 ${jarvis ? 'mx-auto w-full max-w-3xl' : ''}`}>
        {messages.length === 0 && jarvis && (
          <div className="mx-auto max-w-2xl py-10 text-center">
            <div className="orbe-ia mx-auto mb-6" aria-hidden="true" />
            <p className="text-2xl font-semibold text-fg">
              Bonjour{profile?.prenom ? ` ${profile.prenom}` : ''}, que fait-on ?
            </p>
            <p className="mt-2 text-sm text-muted">
              Dites ou écrivez ce qui s'est passé ou ce que vous voulez obtenir. Je consulte le CRM
              {isManager ? ' (accès direction)' : ' (périmètre conseiller)'} et je vous propose les actions : rien ne s'exécute sans votre validation.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => void ask(s)} className="rounded-xl border border-line bg-surface/70 px-3 py-2.5 text-left text-sm text-fg backdrop-blur transition hover:border-brand-300 hover:bg-surface">
                  <Sparkles className="mb-1 h-3.5 w-3.5 text-brand-500" /> {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 && !jarvis && (
          <div className={`mx-auto max-w-xl text-center ${compact ? 'py-4' : 'py-8'}`}>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400"><Bot className="h-6 w-6" /></div>
            <p className="font-medium text-fg">{contexte ? `Posez une question sur ${contexte.label}` : 'Posez une question, ou demandez une action'}</p>
            <p className="mt-1 text-sm text-muted">
              L'assistant consulte vos données en direct{isManager ? ' (accès direction)' : ' (périmètre conseiller)'} et
              peut préparer relances, statuts, emails… chaque action vous est soumise pour validation.
            </p>
            <div className={`mt-5 grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
              {suggestions.map((s) => (
                <button key={s} onClick={() => void ask(s)} className="rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm text-fg transition hover:border-brand-300 hover:bg-surface-2">
                  <Sparkles className="mb-1 h-3.5 w-3.5 text-brand-500" /> {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.role === 'user' ? 'bg-surface-2 text-muted' : 'bg-brand-500/10 text-brand-600 dark:text-brand-400'}`}>
              {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={`max-w-[85%] rounded-xl border p-3 ${m.role === 'user' ? 'border-brand-500/20 bg-brand-500/5' : 'border-line bg-surface'}`}>
              {m.etapes && m.etapes.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {m.etapes.map((e, j) => (
                    <span key={j} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs text-muted">
                      <Wrench className="h-3 w-3" /> {e.label}
                    </span>
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap break-words text-sm text-fg">{m.content}</p>
              {m.actionIds?.map((id) => actions[id] && (
                <ActionCard
                  key={id} action={actions[id]} onDecision={decideAction}
                  selectionnee={!deselection[id]}
                  onSelection={(aid, v) => setDeselection((prev) => ({ ...prev, [aid]: !v }))}
                  modifs={modifs[id]} onModif={modifier} onVoir={onEntite}
                />
              ))}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 border-t border-line pt-2">
                  <p className="mb-1 text-xs font-medium text-muted">Sources documentaires :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.sources.map((s, j) => s.url ? (
                      <a key={j} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-surface">
                        <FileText className="h-3 w-3" /> {s.label}
                      </a>
                    ) : (
                      <span key={j} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-muted">
                        <FileText className="h-3 w-3" /> {s.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="space-y-1.5">
            {liveSteps.map((s, i) => (
              <p key={i} className="flex items-center gap-2 text-sm text-muted">
                <Wrench className="h-3.5 w-3.5" /> {s.label}
              </p>
            ))}
            <div className="flex items-center gap-2 text-sm text-muted"><Spinner className="h-4 w-4" /> L'assistant travaille…</div>
          </div>
        )}
        <div ref={endRef} />
       </div>
      </div>

      {/* Validation groupée des propositions en attente */}
      {enAttente.length > 1 && (
        <div className={`border-t border-line bg-brand-500/5 ${compact ? 'px-2 py-2' : 'px-3 py-2'}`}>
          <div className={`flex flex-wrap items-center gap-2 ${jarvis ? 'mx-auto max-w-3xl' : ''}`}>
            <p className="flex-1 text-sm text-fg">
              <strong>{enAttente.length}</strong> actions en attente · {selection.length} sélectionnée{selection.length > 1 ? 's' : ''}
            </p>
            <Button onClick={() => void deciderLot('execute')} disabled={lotEnCours || selection.length === 0} className="!px-3 !py-1.5 text-sm">
              {lotEnCours ? <Spinner className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />} Valider la sélection
            </Button>
            <Button variant="ghost" onClick={() => void deciderLot('cancel')} disabled={lotEnCours} className="!px-3 !py-1.5 text-sm">
              <X className="h-4 w-4" /> Tout refuser
            </Button>
          </div>
        </div>
      )}

      {/* Saisie */}
      <form
        onSubmit={(e) => { e.preventDefault(); void ask(input); }}
        className={jarvis
          ? 'mx-auto mb-4 flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-lg shadow-brand-500/5'
          : `flex items-end gap-2 border-t border-line bg-surface ${compact ? 'p-2' : 'p-3'}`}
      >
        <DicteeVocale
          disabled={loading}
          onTexte={(t) => setInput((v) => (v ? `${v.trimEnd()} ${t}` : t))}
          onErreur={(msg) => setMessages((m) => [...m, { role: 'assistant', content: `⚠️ Dictée : ${msg}` }])}
        />
        <textarea
          className="input max-h-40 min-h-[44px] flex-1 resize-none"
          placeholder={jarvis ? "Ex. : j'ai eu Cyril Martin, il attend un devis pour 3 personnes…" : "Votre question ou votre demande d'action…"}
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(input); } }}
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()}><Send className="h-4 w-4" />{compact ? '' : ' Envoyer'}</Button>
      </form>
    </div>
  );
}
