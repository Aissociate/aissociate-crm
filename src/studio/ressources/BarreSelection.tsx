// Barre des actions groupées de « Mes ressources » : visible dès qu'une ressource est cochée.
import { useState } from 'react';
import { Bot, FolderInput, Power, PowerOff, Trash2, X } from 'lucide-react';
import { appel, type Ressource } from '../api';
import Confirmation from '../composants/Confirmation';

type Props = {
  choisies: Ressource[];
  options: { id: string; chemin: string }[];
  gerer: (e: unknown) => string;
  onFini: (message: string) => void;
  onErreur: (message: string) => void;
  onVider: () => void;
  /** Ouvre le panneau « Confier à un agent » (fichiers et notes confondus). */
  onConfier?: () => void;
};

const BOUTON = 'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-sm hover:bg-neutral-50 disabled:opacity-50';

export default function BarreSelection({ choisies, options, gerer, onFini, onErreur, onVider, onConfier }: Props) {
  const [enCours, setEnCours] = useState(false);
  const [confirmer, setConfirmer] = useState<'supprimer' | 'sensibles' | null>(null);
  const n = choisies.length;
  const s = n > 1 ? 's' : '';
  const sensibles = choisies.filter((r) => r.sensible && !r.actif);

  const lancer = async (op: 'activer' | 'desactiver' | 'ranger' | 'supprimer', extra: Record<string, unknown> = {}) => {
    setEnCours(true);
    try {
      const r = await appel<{ nombre: number }>('ressources_lot', { op, ids: choisies.map((x) => x.id), ...extra });
      const k = r.nombre, ks = k > 1 ? 's' : '';
      onFini({
        activer: `${k} ressource${ks} activée${ks} : vos agents s'en servent.`,
        desactiver: `${k} ressource${ks} désactivée${ks} : vos agents ne les lisent plus.`,
        ranger: `${k} ressource${ks} rangée${ks}.`,
        supprimer: `${k} ressource${ks} supprimée${ks}.`,
      }[op]);
    } catch (e) { onErreur(gerer(e)); }
    finally { setEnCours(false); setConfirmer(null); }
  };

  return (
    <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-900 bg-white px-3 py-2 shadow-sm" role="toolbar" aria-label="Actions sur la sélection">
      <p className="mr-1 text-sm font-medium">{n} sélectionnée{s}</p>
      {onConfier && <button type="button" className={BOUTON} disabled={enCours} onClick={onConfier}><Bot className="h-4 w-4" /> Confier à un agent</button>}
      <button type="button" className={BOUTON} disabled={enCours} onClick={() => (sensibles.length ? setConfirmer('sensibles') : lancer('activer'))}><Power className="h-4 w-4" /> Activer</button>
      <button type="button" className={BOUTON} disabled={enCours} onClick={() => lancer('desactiver')}><PowerOff className="h-4 w-4" /> Désactiver</button>
      <label className={BOUTON}>
        <FolderInput className="h-4 w-4" aria-hidden />
        <span className="sr-only">Ranger la sélection dans un dossier</span>
        <select value="" disabled={enCours} className="bg-transparent outline-none"
          onChange={(e) => { const v = e.target.value; if (v) void lancer('ranger', { dossier_id: v === '__racine' ? null : v }); }}>
          <option value="">Ranger dans…</option>
          <option value="__racine">Hors dossier</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.chemin}</option>)}
        </select>
      </label>
      <button type="button" className={`${BOUTON} text-red-700`} disabled={enCours} onClick={() => setConfirmer('supprimer')}><Trash2 className="h-4 w-4" /> Supprimer</button>
      <button type="button" onClick={onVider} className="ml-auto p-1 text-neutral-500 hover:text-neutral-900" aria-label="Annuler la sélection"><X className="h-4 w-4" /></button>

      <Confirmation
        ouvert={confirmer === 'supprimer'}
        titre={`Supprimer ${n} ressource${s} ?`}
        message="Elles ne seront plus disponibles pour vos agents. L'action est immédiate et sans corbeille."
        confirmer={{ label: `Supprimer ${n} ressource${s}`, danger: true, onClick: () => lancer('supprimer') }}
        annuler={{ onClick: () => setConfirmer(null) }}
        enCours={enCours}
      />
      <Confirmation
        ouvert={confirmer === 'sensibles'}
        titre="Rendre des documents sensibles lisibles par vos agents ?"
        message={`${sensibles.map((r) => `« ${r.titre} »`).join(', ')} ${sensibles.length > 1 ? 'semblent contenir' : 'semble contenir'} des données sensibles (RIB, pièce d'identité, paie…). Une fois activés, vos agents peuvent les lire. Vous pourrez les désactiver à tout moment.`}
        confirmer={{ label: 'Activer quand même', danger: true, onClick: () => lancer('activer', { confirmer: true }) }}
        annuler={{ onClick: () => setConfirmer(null) }}
        enCours={enCours}
      />
    </div>
  );
}
