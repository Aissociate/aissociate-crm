// Fiche d'un espace (CRM) : arrêt d'urgence, dépense IA du jour et journal
// d'audit avec vérification de la chaîne de hachage (faite côté serveur).
import { useCallback, useEffect, useState } from 'react';
import { PauseCircle, PlayCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { Button } from '@/components/ui';
import { libelleAction, type LigneJournal } from '../journal';

type Reponse = {
  lignes: LigneJournal[]; depense_jour_eur: number;
  verification: { ok: boolean; lignes: number; rupture?: number; motif?: string };
};

async function appeler<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('studio', { body });
  if (error) throw new Error(await functionErrorMessage(error));
  return data as T;
}

export default function GouvernanceEspace({ workspaceId, suspendu: initial, budget }: { workspaceId: string; suspendu: boolean; budget: number | null }) {
  const [suspendu, setSuspendu] = useState(initial);
  const [r, setR] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState('');
  const [tout, setTout] = useState(false);

  const charger = useCallback(() => {
    appeler<Reponse>({ action: 'admin_journal', workspace_id: workspaceId }).then(setR).catch((e) => setErreur(e.message));
  }, [workspaceId]);
  useEffect(() => { charger(); }, [charger]);

  const basculer = async () => {
    if (!suspendu && !confirm('Suspendre tous les agents de cet espace ? Le client le verra dans son Studio.')) return;
    try {
      const x = await appeler<{ suspendu: boolean }>({ action: 'admin_suspendre', workspace_id: workspaceId, suspendu: !suspendu });
      setSuspendu(x.suspendu); charger();
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
  };

  const lignes = r ? (tout ? r.lignes : r.lignes.slice(0, 12)) : [];
  return (
    <section>
      <h3 className="mb-2 font-semibold text-fg">Gouvernance</h3>
      {erreur && <p className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{erreur}</p>}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 text-sm">
        {suspendu ? <PauseCircle className="h-5 w-5 text-red-600" /> : <PlayCircle className="h-5 w-5 text-emerald-600" />}
        <span className="text-fg">{suspendu ? 'Agents suspendus' : 'Agents actifs'}</span>
        {r && <span className="text-muted">· dépense IA aujourd'hui : {r.depense_jour_eur.toFixed(2)} €{budget != null ? ` / ${budget} €` : ' (sans plafond)'}</span>}
        <Button variant="secondary" className="ml-auto" onClick={basculer}>{suspendu ? 'Relancer' : 'Suspendre'}</Button>
      </div>
      {r && (
        <div className="mt-3 rounded-lg border border-line">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm">
            {r.verification.ok
              ? <><ShieldCheck className="h-4 w-4 text-emerald-600" /><span className="text-fg">Journal intègre</span><span className="text-muted">({r.verification.lignes} lignes, chaîne vérifiée)</span></>
              : <><ShieldAlert className="h-4 w-4 text-red-600" /><span className="font-medium text-red-600">Chaîne rompue à la ligne {r.verification.rupture} ({r.verification.motif})</span></>}
          </div>
          {lignes.length === 0 ? <p className="px-3 py-2 text-sm text-muted">Aucune entrée.</p> : (
            <ul className="divide-y divide-line/60 text-xs">
              {lignes.map((l) => (
                <li key={l.id} className="flex flex-wrap gap-x-3 px-3 py-1.5">
                  <span className="w-28 text-muted">{new Date(l.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span className="font-medium text-fg">{libelleAction(l.action)}</span>
                  {l.agent_id && <span className="text-muted">{l.agent_id}</span>}
                  {typeof l.detail?.titre === 'string' && <span className="min-w-0 flex-1 truncate text-fg">« {l.detail.titre} »</span>}
                  <span className="ml-auto text-muted">{l.acteur}</span>
                </li>
              ))}
            </ul>
          )}
          {r.lignes.length > 12 && (
            <button className="btn-ghost w-full text-xs" onClick={() => setTout(!tout)}>{tout ? 'Réduire' : `Voir les ${r.lignes.length} dernières entrées`}</button>
          )}
        </div>
      )}
    </section>
  );
}
