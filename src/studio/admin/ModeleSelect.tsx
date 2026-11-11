// Sélecteur de modèle OpenRouter groupé par constructeur, avec prix. La liste vient
// de la fonction `studio` (liste blanche MODELES_STUDIO) ; le filtre n'apparaît qu'au-delà de 10.
// Valeur vide = « hérité » (le niveau supérieur décide, voir migration studio_modeles).
import { useMemo, useState } from 'react';

export type ModeleOR = {
  id: string; constructeur: string; nom: string; contexte: number | null;
  prix_entree: number | null; prix_sortie: number | null;
};

const prix = (m: ModeleOR) => (m.prix_entree == null ? '' : m.prix_entree === 0 && m.prix_sortie === 0
  ? ' · gratuit' : ` · ${m.prix_entree} $ / ${m.prix_sortie} $`);

export function ModeleSelect({
  value, onChange, modeles, herite, chargement,
}: {
  value: string | null; onChange: (v: string | null) => void;
  modeles: ModeleOR[]; herite: string; chargement?: boolean;
}) {
  const [filtre, setFiltre] = useState('');
  const groupes = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    const g = new Map<string, ModeleOR[]>();
    for (const m of modeles) {
      if (f && !`${m.constructeur} ${m.nom} ${m.id}`.toLowerCase().includes(f) && m.id !== value) continue;
      g.set(m.constructeur, [...(g.get(m.constructeur) ?? []), m]);
    }
    return [...g.entries()];
  }, [modeles, filtre, value]);
  const inconnu = value && !modeles.some((m) => m.id === value);
  const choisi = modeles.find((m) => m.id === value);

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        {modeles.length > 10 && (
          <input className="input w-40 shrink-0" placeholder="Filtrer…" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
        )}
        <select className="input min-w-0 flex-1" value={value ?? ''} disabled={chargement}
          onChange={(e) => onChange(e.target.value || null)}>
          <option value="">{chargement ? 'Chargement des modèles…' : `Hérité — ${herite}`}</option>
          {inconnu && <option value={value}>{value} (non autorisé : ignoré, le niveau au-dessus s'applique)</option>}
          {groupes.map(([c, liste]) => (
            <optgroup key={c} label={`${c} (${liste.length})`}>
              {liste.map((m) => <option key={m.id} value={m.id}>{m.nom}{prix(m)}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      {choisi && (
        <p className="text-xs text-muted">
          <code>{choisi.id}</code>
          {choisi.contexte ? ` · contexte ${Math.round(choisi.contexte / 1000)} k` : ''}
          {choisi.prix_entree != null ? ` · ${choisi.prix_entree} $ entrée / ${choisi.prix_sortie} $ sortie par million de tokens` : ''}
        </p>
      )}
    </div>
  );
}
