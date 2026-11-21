// « Confier à un agent » : les ressources cochées partent chez un agent avec une consigne.
// Un livrable par document, ou une synthèse unique ; les résultats arrivent dans « Aujourd'hui ».
import { useState } from 'react';
import { X } from 'lucide-react';
import { appel, type Agent, type Ressource } from '../api';
import { Bouton, cx } from '../composants';

/** Bornes du serveur (supabase/functions/studio/lots.ts). */
export const LOT_MAX = 25;
export const SYNTHESE_MAX = 12;

const EXEMPLES: { texte: string; mode: 'chaque' | 'synthese' }[] = [
  { texte: 'Résume chaque document en 5 points clés, avec les chiffres importants.', mode: 'chaque' },
  { texte: 'Extrais les tarifs, conditions et dates d\'échéance.', mode: 'chaque' },
  { texte: 'Compare ces documents dans un tableau : points communs, différences, ce qui manque.', mode: 'synthese' },
  { texte: 'Rédige une FAQ client à partir de ces documents.', mode: 'synthese' },
];

type Props = {
  choisies: Ressource[];
  agents: Agent[];
  /** Demandes restantes ce mois-ci (null : sans limite). */
  restantes: number | null;
  gerer: (e: unknown) => string;
  onFermer: () => void;
  onLance: (message: string) => void;
};

export default function ConfierLot({ choisies, agents, restantes, gerer, onFermer, onLance }: Props) {
  const [agent, setAgent] = useState(agents[0]?.id ?? '');
  const [consigne, setConsigne] = useState('');
  const [mode, setMode] = useState<'chaque' | 'synthese'>('chaque');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const sensibles = choisies.filter((r) => r.sensible && !r.actif);
  const lisibles = choisies.length - sensibles.length;
  const max = mode === 'synthese' ? SYNTHESE_MAX : LOT_MAX;
  const demandes = mode === 'synthese' ? 1 : lisibles;
  const trop = lisibles > max;
  const prenom = agents.find((a) => a.id === agent)?.prenom ?? "L'agent";

  const lancer = async () => {
    setEnvoi(true); setErreur('');
    try {
      const r = await appel<{ nombre: number; ecartes: string[] }>('lot_lancer', { ids: choisies.map((x) => x.id), agent_id: agent, consigne, mode });
      const s = r.nombre > 1 ? 's' : '';
      onLance(mode === 'synthese'
        ? `C'est parti : ${prenom} lit les ${r.nombre} document${s} ensemble. La synthèse arrivera dans « Aujourd'hui » d'ici quelques minutes.`
        : `C'est parti : ${r.nombre} document${s} confié${s} à ${prenom}. Les résultats arrivent dans « Aujourd'hui » au fil de l'eau, environ une minute par document.`);
    } catch (e) { setErreur(gerer(e)); }
    finally { setEnvoi(false); }
  };

  return (
    <div className="mb-4 space-y-4 rounded-2xl border border-neutral-900 bg-white p-4" role="dialog" aria-label="Confier les documents à un agent">
      <div className="flex items-center justify-between">
        <p className="font-medium">Confier {choisies.length} document{choisies.length > 1 ? 's' : ''} à un agent</p>
        <button onClick={onFermer} aria-label="Fermer"><X className="h-4 w-4" /></button>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600">Agent</span>
        <select value={agent} onChange={(e) => setAgent(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-3 py-2 outline-none focus:border-neutral-900">
          {agents.map((a) => <option key={a.id} value={a.id}>{a.prenom} — {a.metier}</option>)}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600">Que doit-il en faire ?</span>
        <textarea value={consigne} onChange={(e) => setConsigne(e.target.value)} rows={3} maxLength={2000}
          placeholder="Ex. : résume chaque document en 5 points clés"
          className="w-full rounded-xl border border-neutral-200 px-3 py-2 outline-none focus:border-neutral-900" />
      </label>
      <div className="flex flex-wrap gap-2">
        {EXEMPLES.map((x) => (
          <button key={x.texte} type="button" onClick={() => { setConsigne(x.texte); setMode(x.mode); }}
            className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-50">{x.texte}</button>
        ))}
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Forme du résultat</legend>
        {([['chaque', 'Un résultat par document', `${lisibles} livrable${lisibles > 1 ? 's' : ''} à valider, un par document (${LOT_MAX} au plus).`],
          ['synthese', 'Une synthèse unique', `Tous les documents lus ensemble, un seul livrable (${SYNTHESE_MAX} documents au plus).`]] as const).map(([v, titre, aide]) => (
          <label key={v} className={cx('flex cursor-pointer gap-2 rounded-xl border px-3 py-2 text-sm', mode === v ? 'border-neutral-900' : 'border-neutral-200')}>
            <input type="radio" name="mode-lot" checked={mode === v} onChange={() => setMode(v)} className="mt-1 accent-neutral-900" />
            <span><span className="block font-medium">{titre}</span><span className="text-neutral-500">{aide}</span></span>
          </label>
        ))}
      </fieldset>

      {sensibles.length > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {sensibles.length} document{sensibles.length > 1 ? 's' : ''} sensible{sensibles.length > 1 ? 's' : ''} non activé{sensibles.length > 1 ? 's' : ''} ne ser{sensibles.length > 1 ? 'ont' : 'a'} pas lu{sensibles.length > 1 ? 's' : ''} : {sensibles.map((r) => r.titre).join(', ')}.
        </p>
      )}
      {trop && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{max} documents au plus pour ce choix : décochez-en {lisibles - max}.</p>}
      <p className="text-sm text-neutral-600">
        Utilise {demandes} demande{demandes > 1 ? 's' : ''} de votre forfait{restantes != null ? ` (il vous en reste ${Math.max(0, restantes)} ce mois-ci, au-delà vos crédits de recharge prennent le relais)` : ''}. Rien n'est envoyé : chaque résultat attend votre validation.
      </p>
      {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
      <Bouton onClick={lancer} disabled={envoi || !agent || consigne.trim().length < 5 || trop || lisibles === 0}>
        {envoi ? 'Lancement…' : `Confier à ${prenom}`}
      </Bouton>
    </div>
  );
}
