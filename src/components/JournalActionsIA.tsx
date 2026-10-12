// Journal des actions de l'IA : ce que l'assistant a fait dans le CRM après
// validation, avec la possibilité de défaire ce qui peut l'être.
import { useCallback, useEffect, useState } from 'react';
import { CircleCheck, TriangleAlert, Undo2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button, Spinner } from '@/components/ui';
import { defaireActionIA, etatAnnulation } from '@/lib/agentIA';
import { entiteDeAction } from '@/components/AssistantChat';
import type { EntiteRef } from '@/components/ApercuEntite';
import type { AiAction } from '@/lib/database.types';

export default function JournalActionsIA({ onVoir }: { onVoir?: (e: EntiteRef) => void }) {
  const [actions, setActions] = useState<AiAction[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const { data } = await supabase.from('ai_actions').select('*')
      .in('statut', ['executee', 'erreur'])
      .order('executed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(60);
    setActions((data ?? []) as AiAction[]);
  }, []);
  useEffect(() => { void charger(); }, [charger]);

  const defaire = async (a: AiAction) => {
    if (!confirm(`Défaire : « ${a.description} » ?`)) return;
    setBusy(a.id); setErreur(null);
    try {
      const resultat = await defaireActionIA(a);
      setActions((prev) => prev?.map((x) => (x.id === a.id ? { ...x, resultat } : x)) ?? null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Actions faites par l'IA</p>
        <button onClick={() => void charger()} title="Actualiser" className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      {erreur && <p className="mb-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">{erreur}</p>}
      {actions === null && <div className="flex justify-center py-6"><Spinner className="h-5 w-5" /></div>}
      {actions?.length === 0 && <p className="text-sm text-muted">Aucune action exécutée pour l'instant.</p>}
      <ul className="space-y-2">
        {actions?.map((a) => {
          const annulation = etatAnnulation(a);
          const entite = entiteDeAction(a);
          const quand = a.executed_at ?? a.created_at;
          return (
            <li key={a.id} className="rounded-lg border border-line p-2.5">
              <p className="flex items-start gap-1.5 text-sm text-fg">
                {a.statut === 'erreur'
                  ? <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                  : annulation.faiteLe
                    ? <Undo2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                    : <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                <span className={annulation.faiteLe ? 'text-muted line-through' : ''}>{a.description}</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {new Date(quand).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                {a.statut === 'erreur' && ` · échec : ${String(a.resultat?.erreur ?? 'inconnu')}`}
                {annulation.faiteLe && ' · défaite'}
              </p>
              {(annulation.possible || (entite && onVoir)) && (
                <div className="mt-1.5 flex gap-1.5">
                  {entite && onVoir && (
                    <Button variant="ghost" onClick={() => onVoir(entite)} className="!px-2 !py-1 text-xs">Voir la fiche</Button>
                  )}
                  {annulation.possible && (
                    <Button variant="ghost" onClick={() => void defaire(a)} disabled={busy !== null} className="!px-2 !py-1 text-xs">
                      {busy === a.id ? <Spinner className="h-3.5 w-3.5" /> : <Undo2 className="h-3.5 w-3.5" />} Défaire
                    </Button>
                  )}
                </div>
              )}
              {!annulation.possible && !annulation.faiteLe && annulation.raison && (
                <p className="mt-1 text-[11px] text-muted/80">{annulation.raison}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
