import { useRef, useState, useEffect } from 'react';
import { Bot, Send, User, FileText, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, Button, Spinner, Badge } from '@/components/ui';

type Source = { label: string; url: string | null };
type Msg = { role: 'user' | 'assistant'; content: string; sources?: Source[] };

const SUGGESTIONS = [
  'Quels sont mes contacts à relancer en priorité ?',
  'Résume les dossiers en cours et leur statut.',
  'Où en est le pipeline ? Quels devis sont en attente ?',
  'Que dit la documentation sur la procédure AGEFICE ?',
  'Quelles sessions de formation sont planifiées prochainement ?',
  'Quelles formations du catalogue conviennent à un dirigeant de TPE ?',
];

export default function Assistant() {
  const { isManager } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('chatbot', { body: { question: q, history } });
      if (error) {
        // invoke() renvoie un message générique (« non-2xx ») ; le vrai motif
        // est dans le corps de la réponse de la fonction (error.context).
        let detail = (error as { message?: string }).message ?? 'Erreur';
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.text === 'function') {
          try {
            const body = await ctx.text();
            const parsed = body ? JSON.parse(body) : null;
            if (parsed?.error) detail = parsed.error;
            else if (body) detail = body.slice(0, 400);
          } catch { /* corps non-JSON : on garde le message générique */ }
        }
        throw new Error(detail);
      }
      const res = data as { ok?: boolean; answer?: string; role?: string; sources?: Source[]; error?: string };
      if (res?.error) throw new Error(res.error);
      if (res?.role) setMode(res.role);
      setMessages((m) => [...m, { role: 'assistant', content: res?.answer ?? '—', sources: res?.sources ?? [] }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${err instanceof Error ? err.message : String(err)}\n\nVérifiez le déploiement de l'Edge Function « chatbot » et la clé OpenRouter (Paramètres › IA).` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Assistant IA"
        subtitle="Questions sur l'activité, à partir de la base documentaire et de vos données"
        actions={mode && <Badge tone={mode === 'direction' ? 'info' : 'brand'}>Mode {mode === 'direction' ? 'Direction' : 'Conseiller'}</Badge>}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface">
        {/* Fil de conversation */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="mx-auto max-w-xl py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400"><Bot className="h-6 w-6" /></div>
              <p className="font-medium text-fg">Posez une question sur l'activité</p>
              <p className="mt-1 text-sm text-muted">
                L'assistant répond à partir de la base documentaire et des données auxquelles vous avez accès
                {isManager ? ' (accès direction).' : ' (périmètre conseiller).'} Les sources sont citées.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm text-fg transition hover:border-brand-300 hover:bg-surface-2">
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
                <p className="whitespace-pre-wrap break-words text-sm text-fg">{m.content}</p>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 border-t border-line pt-2">
                    <p className="mb-1 text-xs font-medium text-muted">Sources :</p>
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
            <div className="flex items-center gap-2 text-sm text-muted"><Spinner className="h-4 w-4" /> L'assistant réfléchit…</div>
          )}
          <div ref={endRef} />
        </div>

        {/* Saisie */}
        <form
          onSubmit={(e) => { e.preventDefault(); ask(input); }}
          className="flex items-end gap-2 border-t border-line bg-surface p-3"
        >
          <textarea
            className="input max-h-40 min-h-[44px] flex-1 resize-none"
            placeholder="Votre question…"
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()}><Send className="h-4 w-4" /> Envoyer</Button>
        </form>
      </div>
    </div>
  );
}
