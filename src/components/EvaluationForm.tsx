import { CHAMPS, SECTIONS, type EvaluationType, type Question, type Reponses } from '@/lib/evaluation';
import { cn } from '@/lib/utils';

/**
 * Questionnaire d'évaluation (à chaud ou à froid), rendu une seule fois pour
 * la page publique tokenisée et la saisie depuis le CRM — même logique que
 * `PositionnementForm`. Purement contrôlé.
 */
export default function EvaluationForm({
  type, valeur, onChange,
}: { type: EvaluationType; valeur: Reponses; onChange: (r: Reponses) => void }) {
  const r = valeur;
  const setChamp = (id: string, v: string) => onChange({ ...r, champs: { ...r.champs, [id]: v } });
  const setValeur = (id: string, v: string | string[]) => onChange({ ...r, valeurs: { ...r.valeurs, [id]: v } });
  const toggle = (id: string, v: string) => {
    const actuel = Array.isArray(r.valeurs[id]) ? (r.valeurs[id] as string[]) : [];
    setValeur(id, actuel.includes(v) ? actuel.filter((x) => x !== v) : [...actuel, v]);
  };

  const echelle = (q: Question, max: number, min: number) => (
    <div className="mt-3 flex flex-wrap gap-2">
      {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((v) => {
        const actif = r.valeurs[q.id] === String(v);
        return (
          <button
            key={v} type="button" aria-pressed={actif} aria-label={`${v} sur ${max}`}
            onClick={() => setValeur(q.id, String(v))}
            className={cn(
              'flex-1 rounded-lg border px-2 py-2 text-sm font-semibold transition-colors',
              max === 10 ? 'min-w-[38px]' : 'min-w-[56px]',
              actif ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-surface-2/40 text-fg hover:border-brand-500/60',
            )}
          >
            {v}
          </button>
        );
      })}
    </div>
  );

  const questionHTML = (q: Question) => (
    <div key={q.id} className="rounded-xl border border-line bg-surface p-4" role="group" aria-labelledby={`lbl-${q.id}`}>
      <p className="font-medium text-fg" id={`lbl-${q.id}`}>
        {q.q} {q.req && <span className="text-red-500">*</span>}
      </p>
      {'hint' in q && q.hint && <p className="mt-1 text-xs text-muted">{q.hint}</p>}

      {q.type === 'scale' && (
        <>
          {echelle(q, 5, 1)}
          {(q.low || q.high) && (
            <div className="mt-2 flex justify-between gap-4 text-xs text-muted">
              <span>1 — {q.low}</span><span className="text-right">5 — {q.high}</span>
            </div>
          )}
        </>
      )}
      {q.type === 'nps' && (
        <>
          {echelle(q, 10, 0)}
          <div className="mt-2 flex justify-between gap-4 text-xs text-muted">
            <span>0 — Certainement pas</span><span className="text-right">10 — Certainement</span>
          </div>
        </>
      )}
      {q.type === 'textarea' && (
        <textarea className="input mt-3" rows={3} placeholder={q.ph}
          value={(r.valeurs[q.id] as string) ?? ''} onChange={(e) => setValeur(q.id, e.target.value)} />
      )}
      {(q.type === 'radio' || q.type === 'check') && (
        <div className="mt-3 flex flex-col gap-2">
          {q.options.map((opt) => {
            const multiple = q.type === 'check';
            const actif = multiple
              ? (Array.isArray(r.valeurs[q.id]) && (r.valeurs[q.id] as string[]).includes(opt))
              : r.valeurs[q.id] === opt;
            return (
              <label
                key={opt}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                  actif ? 'border-brand-500 bg-brand-500/10' : 'border-line hover:border-brand-500/50',
                )}
              >
                <input
                  type={multiple ? 'checkbox' : 'radio'} name={q.id} className="sr-only" checked={actif}
                  onChange={() => (multiple ? toggle(q.id, opt) : setValeur(q.id, opt))}
                />
                <span className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center border text-[10px] font-semibold',
                  multiple ? 'rounded-md' : 'rounded-full',
                  actif ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-surface',
                )}>
                  {actif ? '✓' : ''}
                </span>
                <span className="text-sm text-fg">{opt}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">Vous</div>
        <h2 className="mb-5 text-xl font-bold tracking-tight text-fg">Vos coordonnées</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CHAMPS.map((c) => (
            <div key={c.id}>
              <label className="label" htmlFor={`ev-${c.id}`}>
                {c.label} {c.req && <span className="text-red-500">*</span>}
              </label>
              <input id={`ev-${c.id}`} type={c.type ?? 'text'} className="input" placeholder={c.ph}
                value={r.champs[c.id] ?? ''} onChange={(e) => setChamp(c.id, e.target.value)} />
            </div>
          ))}
        </div>
      </section>

      {SECTIONS[type].map((s, i) => (
        <section key={s.id} className="card p-5 sm:p-6">
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
            Section {String(i + 1).padStart(2, '0')}
          </div>
          <h2 className="text-xl font-bold tracking-tight text-fg">{s.titre}</h2>
          <p className="mb-5 mt-2 max-w-[64ch] text-sm leading-relaxed text-muted">{s.intro}</p>
          <div className="space-y-3">{s.questions.map(questionHTML)}</div>
        </section>
      ))}
    </div>
  );
}
