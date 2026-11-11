// Démo en direct : Sam, l'agent commercial d'Aissociate (Edge Function `studio-demo`).
// Il répond aux questions sur le Studio IA, qualifie le prospect et, avec son accord,
// l'enregistre dans le CRM. L'historique reste dans le navigateur (sessionStorage).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, CheckCircle2, RotateCcw } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };
const URL_FN = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/studio-demo`;
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
const CLE = 'aissociate.sam-demo';
const ACCUEIL: Msg = {
  role: 'assistant',
  content: "Bonjour, je suis Sam, l'agent commercial d'Aissociate — et un agent IA du Studio, vous êtes donc en pleine démonstration. Quelle est votre activité, et qu'est-ce qui vous prend le plus de temps en ce moment ?",
};
const SUGGESTIONS = ['Je suis artisan, je n\'ai pas le temps pour mes réseaux', 'Combien coûtent deux agents ?', 'Suis-je éligible au Kap Numérik ?'];

type Etat = { conversation: string; messages: Msg[]; enregistre: boolean };
function charger(): Etat {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLE) ?? 'null') as Etat | null;
    if (s?.conversation && Array.isArray(s.messages)) return s;
  } catch { /* stockage indisponible */ }
  return { conversation: crypto.randomUUID(), messages: [ACCUEIL], enregistre: false };
}

export default function SamDemo() {
  const [etat, setEtat] = useState<Etat>(charger);
  const [saisie, setSaisie] = useState('');
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState('');
  const fil = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { sessionStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* stockage indisponible */ }
    fil.current?.scrollTo({ top: fil.current.scrollHeight, behavior: 'smooth' });
  }, [etat, attente]);

  const envoyer = async (texte: string) => {
    const t = texte.trim();
    if (!t || attente) return;
    const messages: Msg[] = [...etat.messages, { role: 'user', content: t.slice(0, 2000) }];
    setEtat({ ...etat, messages }); setSaisie(''); setErreur(''); setAttente(true);
    try {
      const r = await fetch(URL_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
        // Le message d'accueil est affiché par la page : il n'est pas renvoyé au modèle.
        body: JSON.stringify({ conversation: etat.conversation, messages: messages.slice(1) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.reponse) throw new Error(j.error ?? 'Sam ne répond pas pour le moment.');
      setEtat((e) => ({ ...e, messages: [...messages, { role: 'assistant', content: j.reponse }], enregistre: e.enregistre || j.prospect_enregistre === true }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur');
      setEtat((x) => ({ ...x, messages }));
    } finally { setAttente(false); }
  };

  const soumettre = (e: FormEvent) => { e.preventDefault(); void envoyer(saisie); };
  const recommencer = () => { setEtat({ conversation: crypto.randomUUID(), messages: [ACCUEIL], enregistre: false }); setErreur(''); };

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white text-neutral-900 shadow-2xl">
      <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
        <img src="/agents-ia/studio/sam.webp" alt="Sam" width={40} height={40} className="h-10 w-10 rounded-full object-cover object-top" style={{ background: '#3b82f6' }} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Sam <span className="font-normal text-neutral-500">· Commercial Aissociate</span></p>
          <p className="flex items-center gap-1.5 text-xs text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Agent IA · démo en direct</p>
        </div>
        <button type="button" onClick={recommencer} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Recommencer la conversation">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div ref={fil} className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 px-4 py-4" aria-live="polite">
        {etat.messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex'}>
            <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'rounded-br-md bg-neutral-900 text-white' : 'rounded-tl-md border border-neutral-200 bg-white'}`}>
              {m.content.replace(/\*\*/g, '')}
            </p>
          </div>
        ))}
        {attente && (
          <div className="flex" aria-label="Sam écrit">
            <span className="flex gap-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
              {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-neutral-300" style={{ animationDelay: `${d * 120}ms` }} />)}
            </span>
          </div>
        )}
        {etat.messages.length === 1 && !attente && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => void envoyer(s)} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs hover:border-neutral-900">{s}</button>
            ))}
          </div>
        )}
        {etat.enregistre && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> Vos coordonnées sont transmises : un conseiller vous rappelle sous 24 h ouvrées.
          </p>
        )}
        {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{erreur}</p>}
      </div>

      <form onSubmit={soumettre} className="flex items-end gap-2 border-t border-neutral-200 p-3">
        <textarea value={saisie} onChange={(e) => setSaisie(e.target.value)} rows={1} maxLength={2000}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void envoyer(saisie); } }}
          placeholder="Écrivez à Sam…" aria-label="Votre message à Sam"
          className="max-h-32 flex-1 resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 focus:bg-white" />
        <button type="submit" disabled={!saisie.trim() || attente} aria-label="Envoyer"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white disabled:bg-neutral-300">
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
      <p className="border-t border-neutral-100 px-3 py-2 text-center text-[11px] text-neutral-400">
        Agent IA : vérifiez les informations importantes avec un conseiller. Vos coordonnées ne sont transmises qu'avec votre accord.
      </p>
    </div>
  );
}
