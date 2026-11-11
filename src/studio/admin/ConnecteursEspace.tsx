// Connecteurs d'un espace client, côté CRM : suivi des demandes et mise en service manuelle.
// Les secrets (mot de passe SMTP, jeton MCP) restent chiffrés : seul leur présence est affichée.
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui';

const db = supabase as unknown as SupabaseClient;
type Ligne = { id: string; type: string; statut: string; infos: Record<string, string>; secret_chiffre: string | null; notes_admin: string; updated_at: string };

const LIBELLES: Record<string, string> = {
  google: 'Google Workspace', outlook: 'Outlook / Microsoft 365', smtp: 'SMTP sur mesure', facebook: 'Facebook',
  instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok', mcp: 'Serveur MCP',
};
const STATUTS = [['demande', 'Demande'], ['en_cours', 'Mise en place'], ['connecte', 'Connecté'], ['erreur', 'À corriger'], ['desactive', 'Désactivé']];
const TON: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'neutral'> = {
  demande: 'warning', en_cours: 'info', connecte: 'success', erreur: 'danger', desactive: 'neutral',
};

export default function ConnecteursEspace({ workspaceId }: { workspaceId: string }) {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    const { data, error } = await db.from('studio_connecteurs').select('*').eq('workspace_id', workspaceId).order('created_at');
    if (error) setErreur(error.message); else setLignes((data ?? []) as Ligne[]);
  }, [workspaceId]);
  useEffect(() => { charger(); }, [charger]);

  const maj = async (id: string, patch: Partial<Ligne>) => {
    setLignes((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await db.from('studio_connecteurs').update(patch).eq('id', id);
    if (error) setErreur(error.message);
  };

  return (
    <section>
      <h3 className="mb-1 font-semibold text-fg">Connecteurs</h3>
      <p className="mb-2 text-xs text-muted">
        Passer en « Connecté » une fois la connexion mise en place : l'outil apparaît alors dans le contexte des agents.
        La note est visible par le client.
      </p>
      {erreur && <p className="mb-2 text-sm text-red-600">{erreur}</p>}
      {lignes.length === 0 ? <p className="text-sm text-muted">Aucune demande de connexion.</p> : (
        <div className="space-y-2">
          {lignes.map((c) => (
            <div key={c.id} className="rounded-lg border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-fg">{LIBELLES[c.type] ?? c.type}</span>
                <Badge tone={TON[c.statut] ?? 'neutral'}>{STATUTS.find(([k]) => k === c.statut)?.[1] ?? c.statut}</Badge>
                {c.secret_chiffre && <Badge tone="neutral">secret chiffré enregistré</Badge>}
                <span className="ml-auto text-xs text-muted">maj {new Date(c.updated_at).toLocaleDateString('fr-FR')}</span>
              </div>
              <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-xs text-muted sm:grid-cols-2">
                {Object.entries(c.infos ?? {}).map(([k, v]) => (
                  <div key={k} className="truncate"><dt className="inline font-medium">{k} : </dt><dd className="inline select-all">{v}</dd></div>
                ))}
              </dl>
              <div className="mt-2 grid gap-2 sm:grid-cols-[160px_1fr]">
                <select className="input" value={c.statut} onChange={(e) => maj(c.id, { statut: e.target.value })}>
                  {STATUTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <input className="input" placeholder="Note pour le client (ex. invitation envoyée le 12/11)" value={c.notes_admin}
                  onChange={(e) => setLignes((l) => l.map((x) => (x.id === c.id ? { ...x, notes_admin: e.target.value } : x)))}
                  onBlur={(e) => maj(c.id, { notes_admin: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
