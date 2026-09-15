import { Plus, Trash2 } from 'lucide-react';
import {
  SECTIONS, TACHES_SUGGEREES, FREQUENCES, REALISEE_PAR, NATURES_COUT,
  cumulTaches, tacheVide, SEMAINES_TRAVAILLEES,
  type Reponses, type Champ, type Question,
} from '@/lib/positionnement';
import { cn } from '@/lib/utils';

/**
 * Le questionnaire de positionnement, rendu une seule fois pour deux usages :
 * la page publique tokenisée que remplit l'apprenant, et la modale du CRM où
 * le formateur reconstitue le positionnement d'un apprenant absent. Les deux
 * doivent noter exactement la même chose — d'où le composant unique.
 *
 * Purement contrôlé : il ne connaît ni le token, ni l'enregistrement. Les
 * classes sont celles du CRM (`card`, `input`, `label`, tons `brand`), pour
 * que le formulaire public et le back-office aient la même langue visuelle.
 */

const LETTRES = 'ABCDEFGHIJ';

export default function PositionnementForm({
  valeur, onChange,
}: { valeur: Reponses; onChange: (r: Reponses) => void }) {
  const r = valeur;
  const maj = (patch: Partial<Reponses>) => onChange({ ...r, ...patch });
  const setChamp = (id: string, v: string) => maj({ champs: { ...r.champs, [id]: v } });
  const setRadio = (id: string, v: string) => maj({ radios: { ...r.radios, [id]: v } });
  const toggleCheck = (id: string, v: string) => {
    const actuel = r.checks[id] ?? [];
    const suivant = actuel.includes(v) ? actuel.filter((x) => x !== v) : [...actuel, v];
    maj({ checks: { ...r.checks, [id]: suivant } });
  };

  const champHTML = (c: Champ) => (
    <div key={c.id} className={cn(c.full && 'sm:col-span-2')}>
      <label className="label" htmlFor={`pos-${c.id}`}>
        {c.label} {c.req && <span className="text-red-500">*</span>}
      </label>
      {c.type === 'select' ? (
        <select id={`pos-${c.id}`} className="input" value={r.champs[c.id] ?? ''} onChange={(e) => setChamp(c.id, e.target.value)}>
          {(c.options ?? []).map((o) => (
            <option key={o} value={o}>{o || '— Sélectionner —'}</option>
          ))}
        </select>
      ) : c.type === 'textarea' ? (
        <textarea id={`pos-${c.id}`} className="input" rows={3} placeholder={c.ph}
          value={r.champs[c.id] ?? ''} onChange={(e) => setChamp(c.id, e.target.value)} />
      ) : (
        <input id={`pos-${c.id}`} type={c.type === 'email' ? 'email' : 'text'} className="input" placeholder={c.ph}
          value={r.champs[c.id] ?? ''} onChange={(e) => setChamp(c.id, e.target.value)} />
      )}
    </div>
  );

  const questionHTML = (q: Question) => {
    if (q.type === 'scale') {
      return (
        <div key={q.id} className="rounded-xl border border-line bg-surface p-4" role="group" aria-labelledby={`lbl-${q.id}`}>
          <p className="font-medium text-fg" id={`lbl-${q.id}`}>{q.q}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((v) => {
              const actif = r.radios[q.id] === String(v);
              return (
                <button
                  key={v} type="button" aria-pressed={actif} aria-label={`${v} sur 5`}
                  onClick={() => setRadio(q.id, String(v))}
                  className={cn(
                    'min-w-[56px] flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                    actif ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-surface-2/40 text-fg hover:border-brand-500/60',
                  )}
                >
                  {v}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between gap-4 text-xs text-muted">
            <span>1 — {q.low}</span><span className="text-right">5 — {q.high}</span>
          </div>
        </div>
      );
    }

    const multiple = q.type === 'check';
    return (
      <div key={q.id} className="rounded-xl border border-line bg-surface p-4" role="group" aria-labelledby={`lbl-${q.id}`}>
        <p className="font-medium text-fg" id={`lbl-${q.id}`}>{q.q}</p>
        {q.hint && <p className="mt-1 text-xs text-muted">{q.hint}</p>}
        <div className="mt-3 flex flex-col gap-2">
          {q.options.map(([cle, texte], i) => {
            const actif = multiple ? (r.checks[q.id] ?? []).includes(cle) : r.radios[q.id] === cle;
            return (
              <label
                key={cle}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors',
                  actif ? 'border-brand-500 bg-brand-500/10' : 'border-line hover:border-brand-500/50',
                )}
              >
                <input
                  type={multiple ? 'checkbox' : 'radio'} name={q.id} value={cle} className="sr-only"
                  checked={actif}
                  onChange={() => (multiple ? toggleCheck(q.id, cle) : setRadio(q.id, cle))}
                />
                <span className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border text-xs font-semibold',
                  multiple ? 'rounded-md' : 'rounded-full',
                  actif ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-surface text-muted',
                )}>
                  {multiple ? '✓' : LETTRES[i]}
                </span>
                <span className="text-sm leading-relaxed text-fg">{texte}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Section 8 — objectifs opérationnels ──────────────────────────────────
  const setObjectif = (i: number, patch: Partial<{ but: string; critere: string }>) =>
    maj({ objectifs: r.objectifs.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });

  const objectifsHTML = (
    <div className="space-y-3">
      {r.objectifs.map((o, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
            Objectif {i + 1}{i > 0 ? ' — facultatif' : ''}
          </p>
          <label className="label mt-3">À l'issue de la formation, je veux être capable de…</label>
          <input
            className="input" value={o.but} onChange={(e) => setObjectif(i, { but: e.target.value })}
            placeholder={i === 0 ? 'ex. produire seul un compte rendu de réunion exploitable à partir de mes notes manuscrites' : '…'}
          />
          <label className="label mt-3">Je saurai que c'est réussi quand…</label>
          <input
            className="input" value={o.critere} onChange={(e) => setObjectif(i, { critere: e.target.value })}
            placeholder={i === 0 ? "ex. je ne consacre plus qu'une demi-heure par semaine à cette tâche au lieu de trois" : '…'}
          />
        </div>
      ))}
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">La priorité absolue</p>
        <label className="label mt-3">S'il n'y avait qu'une seule chose à régler pendant cette formation, ce serait :</label>
        <textarea className="input" rows={3} value={r.priorite} onChange={(e) => maj({ priorite: e.target.value })} />
      </div>
    </div>
  );

  // ── Section 9 — tâches chronophages ──────────────────────────────────────
  const setTache = (i: number, patch: Partial<Reponses['taches'][number]>) =>
    maj({ taches: r.taches.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });

  const ajouterTache = (libelle = '') => {
    // Un libellé suggéré remplit la première ligne vide plutôt que d'en créer
    // une nouvelle : cliquer trois suggestions ne doit pas laisser trois
    // lignes vides en dessous.
    const vide = r.taches.findIndex((t) => !t.tache.trim());
    if (libelle && vide >= 0) { setTache(vide, { tache: libelle }); return; }
    maj({ taches: [...r.taches, tacheVide(libelle)] });
  };

  const { heures, annuel, journees, remplies } = cumulTaches(r.taches);

  const selectTache = (i: number, cle: 'frequence' | 'qui' | 'cout', label: string, options: string[]) => (
    <div>
      <label className="label" htmlFor={`t-${cle}-${i}`}>{label}</label>
      <select id={`t-${cle}-${i}`} className="input" value={r.taches[i][cle]} onChange={(e) => setTache(i, { [cle]: e.target.value })}>
        {options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </div>
  );

  const irritantsHTML = (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TACHES_SUGGEREES.map((c) => (
          <button
            key={c} type="button" onClick={() => ajouterTache(c)}
            className="rounded-full border border-dashed border-line px-3 py-1 text-xs text-muted transition-colors hover:border-solid hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {r.taches.map((t, i) => (
          <div key={i} className="rounded-xl border border-line border-l-[3px] border-l-brand-500 bg-surface p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs font-semibold tabular-nums text-muted">{String(i + 1).padStart(2, '0')}</span>
              <input
                className="input flex-1" value={t.tache}
                placeholder="Tâche ou situation — ex. rédiger les comptes rendus de réunion"
                onChange={(e) => setTache(i, { tache: e.target.value })}
              />
              <button
                type="button" aria-label="Supprimer cette tâche"
                onClick={() => maj({ taches: r.taches.filter((_, idx) => idx !== i) })}
                className="rounded-lg border border-line p-2 text-muted transition-colors hover:border-red-500 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {selectTache(i, 'frequence', 'Fréquence', FREQUENCES)}
              <div>
                <label className="label" htmlFor={`t-h-${i}`}>Temps par semaine (h)</label>
                <input
                  id={`t-h-${i}`} type="number" min={0} max={60} step={0.5} className="input" placeholder="ex. 3"
                  value={t.heures} onChange={(e) => setTache(i, { heures: e.target.value })}
                />
              </div>
              {selectTache(i, 'qui', 'Réalisée par', REALISEE_PAR)}
              {selectTache(i, 'cout', 'Ce qui coûte le plus', NATURES_COUT)}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button" onClick={() => ajouterTache()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-sm font-medium text-brand-600 transition-colors hover:border-solid hover:border-brand-500 dark:text-brand-400"
      >
        <Plus className="h-4 w-4" /> Ajouter une tâche
      </button>

      <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4" aria-live="polite">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Tâches listées</p>
          <p className="text-2xl font-bold tabular-nums text-fg">{remplies.length || '—'}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Cumul hebdomadaire</p>
          <p className="text-2xl font-bold tabular-nums text-fg">
            {heures ? `${heures.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Projection annuelle</p>
          <p className="text-2xl font-bold tabular-nums text-fg">{annuel ? `${annuel.toLocaleString('fr-FR')} h` : '—'}</p>
        </div>
        <p className="min-w-[200px] flex-1 text-sm text-fg/80">
          {annuel
            ? `Soit l'équivalent d'environ ${journees} journées de travail de 7 heures par an, sur la base de ${SEMAINES_TRAVAILLEES} semaines travaillées. C'est le gisement sur lequel la formation portera en priorité.`
            : 'Renseignez au moins une tâche et son temps hebdomadaire : le cumul annuel se calcule automatiquement.'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {SECTIONS.map((s) => (
        <section key={s.id} className="card p-5 sm:p-6">
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
            Section {String(s.n).padStart(2, '0')}
          </div>
          <h2 className="text-xl font-bold tracking-tight text-fg">{s.titre}</h2>
          <p className="mb-5 mt-2 max-w-[64ch] text-sm leading-relaxed text-muted">{s.intro}</p>

          {s.champs && (
            <div className="grid gap-4 sm:grid-cols-2">{s.champs.map(champHTML)}</div>
          )}
          {s.questions && <div className="space-y-3">{s.questions.map(questionHTML)}</div>}
          {s.custom === 'objectifs' && objectifsHTML}
          {s.custom === 'irritants' && irritantsHTML}
        </section>
      ))}
    </div>
  );
}
