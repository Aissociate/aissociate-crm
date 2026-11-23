// Conversation avec Sam : utilisée telle quelle par la démo de /agents-ia (SamDemo) et par la
// bulle présente sur toutes les pages (SamWidget). L'état vit dans samStore.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, ArrowUp, CheckCircle2, RotateCcw, X } from 'lucide-react';
import { decouper, envoyer, lienEssai, recommencer, suggestions, useSam } from './samStore';

const PORTRAIT = '/agents-ia/studio/sam.webp';

function Avatar({ taille = 'h-7 w-7' }: { taille?: string }) {
  return <img src={PORTRAIT} alt="" width={40} height={40} className={`${taille} shrink-0 rounded-full object-cover object-top`} style={{ background: '#3b82f6' }} />;
}

function Texte({ contenu, clair }: { contenu: string; clair: boolean }): ReactNode {
  const lien = clair ? 'font-medium text-orange-300 underline underline-offset-2 hover:text-orange-200' : 'font-medium text-orange-600 underline underline-offset-2 hover:text-orange-700';
  return decouper(contenu).map((b, i) => {
    if (b.t === 'texte') return <span key={i}>{b.v}</span>;
    if (b.t === 'gras') return <strong key={i} className="font-semibold">{b.v}</strong>;
    return (
      <a key={i} href={b.href} className={`break-words ${lien}`} {...(b.interne || /^(mailto|tel):/.test(b.href) ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
        {b.v}
      </a>
    );
  });
}

export default function SamChat({ className = '', onFermer, focus = false }: { className?: string; onFermer?: () => void; focus?: boolean }) {
  const etat = useSam();
  const [saisie, setSaisie] = useState('');
  const fil = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLTextAreaElement>(null);
  const page = typeof window === 'undefined' ? '/' : window.location.pathname;

  useEffect(() => {
    fil.current?.scrollTo({ top: fil.current.scrollHeight, behavior: 'smooth' });
  }, [etat.messages.length, etat.attente, etat.erreur]);

  useEffect(() => { if (focus) champ.current?.focus(); }, [focus]);

  // Le champ grandit avec le texte, jusqu'à quelques lignes.
  useEffect(() => {
    const c = champ.current;
    if (!c) return;
    c.style.height = 'auto';
    c.style.height = `${Math.min(c.scrollHeight, 128)}px`;
  }, [saisie]);

  const partir = (t: string) => { setSaisie(''); void envoyer(t); };
  const soumettre = (e: FormEvent) => { e.preventDefault(); partir(saisie); };

  return (
    <div className={`flex flex-col overflow-hidden bg-white font-sans text-neutral-900 ${className}`}>
      <div className="flex items-center gap-3 bg-neutral-950 px-4 py-3 text-white">
        <span className="relative">
          <Avatar taille="h-10 w-10" />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-neutral-950 bg-emerald-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">Sam <span className="font-normal text-neutral-400">· Aissociate</span></p>
          <p className="truncate text-xs text-neutral-400">Agent IA · répond en quelques secondes</p>
        </div>
        <button type="button" onClick={recommencer} className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Recommencer la conversation" title="Recommencer">
          <RotateCcw className="h-4 w-4" />
        </button>
        {onFermer && (
          <button type="button" onClick={onFermer} className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 hover:text-white" aria-label="Fermer la conversation">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div ref={fil} className="flex-1 space-y-3 overflow-y-auto bg-[#f6f6f4] px-4 py-4" aria-live="polite">
        {etat.messages.map((m, i) => {
          const moi = m.role === 'user';
          const essai = !moi ? lienEssai(m.content) : null;
          return (
            <div key={i} className={moi ? 'flex justify-end' : 'flex items-end gap-2'}>
              {!moi && <Avatar />}
              <div className={`max-w-[85%] ${moi ? '' : 'min-w-0'}`}>
                <p className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${moi ? 'rounded-br-md bg-neutral-900 text-white' : 'rounded-bl-md bg-white shadow-sm ring-1 ring-neutral-200/70'}`}>
                  <Texte contenu={m.content} clair={moi} />
                </p>
                {essai && (
                  <a href={essai} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600">
                    Ouvrir mon espace gratuit <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {etat.attente && (
          <div className="flex items-end gap-2" role="status" aria-label="Sam écrit">
            <Avatar />
            <span className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-neutral-200/70">
              {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-neutral-300" style={{ animationDelay: `${d * 120}ms` }} />)}
            </span>
          </div>
        )}
        {etat.messages.length === 1 && !etat.attente && (
          <div className="flex flex-wrap gap-2 pl-9 pt-1">
            {suggestions(page).map((s) => (
              <button key={s} type="button" onClick={() => partir(s)} className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-left text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900">{s}</button>
            ))}
          </div>
        )}
        {etat.enregistre && (
          <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Vos coordonnées sont transmises : un conseiller vous rappelle sous 24 h ouvrées.
              {etat.complements > 0 && ' Vos précisions ont été ajoutées à votre demande.'}
            </span>
          </p>
        )}
        {etat.erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{etat.erreur}</p>}
      </div>

      <form onSubmit={soumettre} className="flex items-end gap-2 border-t border-neutral-200 bg-white p-3">
        <textarea ref={champ} value={saisie} onChange={(e) => setSaisie(e.target.value)} rows={1} maxLength={2000}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); partir(saisie); } }}
          placeholder="Écrivez à Sam…" aria-label="Votre message à Sam"
          className="max-h-32 flex-1 resize-none rounded-xl border [scrollbar-width:none] border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none transition-colors focus:border-neutral-900 focus:bg-white" />
        <button type="submit" disabled={!saisie.trim() || etat.attente} aria-label="Envoyer"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition-colors hover:bg-orange-600 disabled:bg-neutral-200 disabled:text-neutral-400">
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
      <p className="bg-white px-3 pb-2 text-center text-[11px] leading-snug text-neutral-400">
        Agent IA : vérifiez les informations importantes avec un conseiller. Vos coordonnées ne sont transmises qu'avec votre accord.
      </p>
    </div>
  );
}
