// Assistant IA agentique — branché sur l'Edge Function `agent` (SSE).
// L'IA consulte le CRM via des outils (périmètre = RLS de l'utilisateur) et
// PROPOSE ses écritures : chaque action apparaît en carte « Valider / Annuler »
// et n'est exécutée qu'après validation explicite.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Bot, Send, User, FileText, Sparkles, Plus, History, Check, X,
  Wrench, CircleCheck, CircleX, TriangleAlert,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, Button, Spinner, Badge } from '@/components/ui';
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
/** Contexte transmis par les fiches (ContactFiche / DossierDetail) via navigate state. */
export type AssistantContexte = { type: 'contact' | 'dossier'; id: string; label: string };

const SUGGESTIONS = [
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
        try { onEvent(event, JSON.parse(data)); } catch { /* fragment illisible */ }
      }
    }
  }
}

/** Carte de validation d'une action proposée par l'IA. */
function ActionCard({ action, onDecision }: { action: AiAction; onDecision: (id: string, mode: 'execute' | 'cancel') => Promise<void> }) {
  const [busy, setBusy] = useState<'execute' | 'cancel' | null>(null);
  const decide = async (mode: 'execute' | 'cancel') => {
    setBusy(mode);
    try { await onDecision(action.id, mode); } finally { setBusy(null); }
  };
  const statutUi: Record<string, { icon: JSX.Element; text: string; cls: string }> = {
    executee: { icon: <CircleCheck className="h-4 w-4" />, text: 'Exécutée', cls: 'text-emerald-600 dark:text-emerald-400' },
    annulee: { icon: <CircleX className="h-4 w-4" />, text: 'Annulée', cls: 'text-muted' },
    erreur: { icon: <TriangleAlert className="h-4 w-4" />, text: `Erreur : ${(action.resultat?.erreur as string) ?? 'inconnue'}`, cls: 'text-red-600 dark:text-red-400' },
  };
  return (
    <div className="mt-2 rounded-lg border border-brand-500/30 bg-brand-500/5 p-3">
      <div className="flex items-start gap-2">
        <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">Action proposée</p>
          <p className="mt-0.5 break-words text-sm text-fg">{action.description}</p>
          {action.outil === 'proposer_envoi_email' && action.statut === 'proposee' && (
            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-line bg-surface p-2 text-xs text-muted">
              {String(action.args.corps ?? '')}
            </pre>
          )}
        </div>
      </div>
      {action.statut === 'proposee' ? (
        <div className="mt-2 flex gap-2">
          <Button onClick={() => decide('execute')} disabled={busy !== null} className="!px-3 !py-1.5 text-sm">
            {busy === 'execute' ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />} Valider
          </Button>
          <Button variant="ghost" onClick={() => decide('cancel')} disabled={busy !== null} className="!px-3 !py-1.5 text-sm">
            <X className="h-4 w-4" /> Annuler
          </Button>
        </div>
      ) : (
        <p className={`mt-2 flex items-center gap-1.5 text-sm ${statutUi[action.statut]?.cls ?? 'text-muted'}`}>
          {statutUi[action.statut]?.icon} {statutUi[action.statut]?.text}
        </p>
      )}
    </div>
  );
}

export default function Assistant() {
  const { isManager } = useAuth();
  const location = useLocation();
  const contexte = (location.state as { assistantContexte?: AssistantContexte } | null)?.assistantContexte ?? null;

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
      .select('*').order('updated_at', { ascending: false }).limit(30);
    setConversations(data ?? []);
  }, []);
  useEffect(() => { void loadConversations(); }, [loadConversations]);

  const openConversation = async (id: string) => {
    setShowHistory(false);
    setConversationId(id);
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
    setShowHistory(false);
  };

  const decideAction = async (id: string, decision: 'execute' | 'cancel') => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    try {
      const res = await fetch(FUNCTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ mode: decision, action_id: id }),
      });
      const body = await res.json();
      setActions((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          statut: res.ok ? (decision === 'execute' ? 'executee' : 'annulee') : 'erreur',
          resultat: res.ok ? prev[id]?.resultat ?? null : { erreur: body?.error ?? `HTTP ${res.status}` },
        },
      }));
    } catch (err) {
      setActions((prev) => ({
        ...prev,
        [id]: { ...prev[id], statut: 'erreur', resultat: { erreur: err instanceof Error ? err.message : String(err) } },
      }));
    }
  };

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
          setActions((prev) => ({ ...prev, [a.id]: { ...a, statut: 'proposee', resultat: null } as AiAction }));
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
    <div className="flex h-full flex-col">
      <PageHeader
        title="Assistant IA"
        subtitle="Interroge vos données en direct et propose des actions — rien n'est modifié sans votre validation"
        actions={
          <div className="flex items-center gap-2">
            {mode && <Badge tone={mode === 'direction' ? 'info' : 'brand'}>Mode {mode === 'direction' ? 'Direction' : 'Conseiller'}</Badge>}
            <Button variant="ghost" onClick={() => setShowHistory((v) => !v)} className="!px-3 !py-1.5 text-sm">
              <History className="h-4 w-4" /> Historique
            </Button>
            <Button variant="ghost" onClick={newConversation} className="!px-3 !py-1.5 text-sm">
              <Plus className="h-4 w-4" /> Nouvelle
            </Button>
          </div>
        }
      />

      {contexte && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-sm text-fg">
          <FileText className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          Contexte : {contexte.type === 'contact' ? 'fiche contact' : 'dossier'} <strong>{contexte.label}</strong>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface">
        {/* Historique des conversations (panneau) */}
        {showHistory && (
          <div className="absolute inset-y-0 right-0 z-10 w-full max-w-sm overflow-y-auto border-l border-line bg-surface p-3 shadow-lg">
            <p className="mb-2 text-sm font-medium text-fg">Conversations récentes</p>
            {conversations.length === 0 && <p className="text-sm text-muted">Aucune conversation enregistrée.</p>}
            <div className="space-y-1">
              {conversations.map((c) => (
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
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="mx-auto max-w-xl py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400"><Bot className="h-6 w-6" /></div>
              <p className="font-medium text-fg">Posez une question, ou demandez une action</p>
              <p className="mt-1 text-sm text-muted">
                L'assistant consulte vos données en direct{isManager ? ' (accès direction)' : ' (périmètre conseiller)'} et
                peut préparer relances, statuts, emails… chaque action vous est soumise pour validation.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
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
              <div className={`max-w-[80%] rounded-xl border p-3 ${m.role === 'user' ? 'border-brand-500/20 bg-brand-500/5' : 'border-line bg-surface'}`}>
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
                  <ActionCard key={id} action={actions[id]} onDecision={decideAction} />
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

        {/* Saisie */}
        <form
          onSubmit={(e) => { e.preventDefault(); void ask(input); }}
          className="flex items-end gap-2 border-t border-line bg-surface p-3"
        >
          <textarea
            className="input max-h-40 min-h-[44px] flex-1 resize-none"
            placeholder="Votre question ou votre demande d'action…"
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(input); } }}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()}><Send className="h-4 w-4" /> Envoyer</Button>
        </form>
      </div>
    </div>
  );
}
