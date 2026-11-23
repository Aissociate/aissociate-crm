import type { Dispatch, SetStateAction } from 'react';
import { ArrowDownUp } from 'lucide-react';
import { ALL_SCOPES, SCOPE_LABELS, type Scope } from './conversations';

/** Filtres rangés, ouverts à la demande : dates, opportunité, tri et périmètre de la recherche. */
export function FiltresAvances({
  dateDebut, setDateDebut, dateFin, setDateFin, oppFilter, setOppFilter, colonnesPipeline,
  sortBy, setSortBy, chrono, setChrono, scopes, setScopes, nbAvances, effacerAvances,
}: {
  dateDebut: string;
  setDateDebut: (v: string) => void;
  dateFin: string;
  setDateFin: (v: string) => void;
  oppFilter: string;
  setOppFilter: (v: string) => void;
  colonnesPipeline: { cle: string; libelle: string }[];
  sortBy: 'date' | 'conseiller';
  setSortBy: (v: 'date' | 'conseiller') => void;
  chrono: boolean;
  setChrono: Dispatch<SetStateAction<boolean>>;
  scopes: Set<Scope>;
  setScopes: Dispatch<SetStateAction<Set<Scope>>>;
  /** Nombre de filtres avancés actifs. */
  nbAvances: number;
  effacerAvances: () => void;
}) {
  return (
    <div className="mb-4 space-y-3 rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Fourchette de dates — ticket « fonction de recherche de messages ». */}
        <label className="flex items-center gap-1.5 text-sm text-muted">
          Du <input type="date" className="input w-[9.5rem] py-2 text-sm" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} title="Date de début" />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          au <input type="date" className="input w-[9.5rem] py-2 text-sm" value={dateFin} onChange={(e) => setDateFin(e.target.value)} title="Date de fin" />
        </label>
        <select className="input max-w-[210px] py-2 text-sm" value={oppFilter} onChange={(e) => setOppFilter(e.target.value)}>
          <option value="">Opportunité : toutes</option>
          <option value="aucune">Sans opportunité</option>
          {colonnesPipeline.map((c) => <option key={c.cle} value={c.cle}>{c.libelle}</option>)}
        </select>
        <select className="input max-w-[190px] py-2 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
          <option value="date">Trier par date</option>
          <option value="conseiller">Trier par conseiller</option>
        </select>
        <button
          onClick={() => setChrono((v) => !v)}
          title={chrono ? 'Actuellement : ordre chronologique (plus ancien en premier)' : 'Actuellement : plus récent en premier'}
          className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-sm text-muted transition hover:border-brand-400 hover:text-brand-600"
        >
          <ArrowDownUp className="h-4 w-4" />
          {chrono ? 'Chronologique' : 'Plus récent d’abord'}
        </button>
        {nbAvances > 0 && (
          <button onClick={effacerAvances} className="text-sm font-medium text-muted underline-offset-2 hover:text-fg hover:underline">Effacer ces filtres</button>
        )}
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
  );
}
