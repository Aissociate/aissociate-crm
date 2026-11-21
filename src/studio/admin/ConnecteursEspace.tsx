// Connecteurs d'un espace client, côté CRM : suivi des demandes et mise en service manuelle.
// Les secrets (mot de passe SMTP, jeton MCP, clé d'API) restent chiffrés : seul leur présence est affichée.
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

type Test = { enCours: true } | { ok: true; outils: { nom: string; lecture: boolean }[] } | { ok: false; erreur: string };
/** Test d'une API : statut de la racine avec la clé, et nombre d'opérations lues dans la description OpenAPI. */
type TestApi = { enCours: true } | { ok: boolean; statut: string; operations: number; erreur_openapi?: string } | { erreur: string };
const estMcp = (type: string) => type === 'mcp' || type.startsWith('mcp:');

export default function ConnecteursEspace({ workspaceId }: { workspaceId: string }) {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [erreur, setErreur] = useState('');
  /** Serveurs MCP : test de connexion (outils vus) avant de passer en « Connecté ». */
  const [tests, setTests] = useState<Record<string, Test>>({});
  const [testsApi, setTestsApi] = useState<Record<string, TestApi>>({});
  const testerApi = async (id: string) => {
    setTestsApi((t) => ({ ...t, [id]: { enCours: true } }));
    const { data, error } = await supabase.functions.invoke('studio', { body: { action: 'admin_tester_api', id } });
    setTestsApi((t) => ({ ...t, [id]: (error ? { erreur: error.message } : data) as TestApi }));
  };
  const tester = async (id: string) => {
    setTests((t) => ({ ...t, [id]: { enCours: true } }));
    const { data, error } = await supabase.functions.invoke('studio', { body: { action: 'admin_tester_mcp', id } });
    const r = (error ? { ok: false, erreur: error.message } : data) as Test;
    setTests((t) => ({ ...t, [id]: r }));
  };

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
        Serveur MCP ou API : « Tester la connexion », puis « Connecté » : les agents s'en servent (lecture directe, écriture validée par le client).
        La note est visible par le client.
      </p>
      {erreur && <p className="mb-2 text-sm text-red-600">{erreur}</p>}
      {lignes.length === 0 ? <p className="text-sm text-muted">Aucune demande de connexion.</p> : (
        <div className="space-y-2">
          {lignes.map((c) => (
            <div key={c.id} className="rounded-lg border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-fg">{LIBELLES[c.type] ?? (c.type.startsWith('app:') ? `Sur demande : ${c.infos?.libelle ?? c.type.slice(4)}` : c.type.startsWith('mcp:') ? 'Serveur MCP' : c.type.startsWith('api:') ? `API : ${c.infos?.nom ?? c.type.slice(4)}` : c.type)}</span>
                <Badge tone={TON[c.statut] ?? 'neutral'}>{STATUTS.find(([k]) => k === c.statut)?.[1] ?? c.statut}</Badge>
                {c.secret_chiffre && <Badge tone="neutral">secret chiffré enregistré</Badge>}
                <span className="ml-auto text-xs text-muted">maj {new Date(c.updated_at).toLocaleDateString('fr-FR')}</span>
              </div>
              <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-xs text-muted sm:grid-cols-2">
                {Object.entries(c.infos ?? {}).map(([k, v]) => (
                  <div key={k} className={k === 'documentation' ? 'sm:col-span-2 line-clamp-3 whitespace-pre-wrap' : 'truncate'}><dt className="inline font-medium">{k} : </dt><dd className="inline select-all">{v}</dd></div>
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
              {c.type.startsWith('api:') && (() => {
                const t = testsApi[c.id];
                return (
                  <div className="mt-2 text-xs">
                    <button type="button" className="rounded-md border border-line px-2 py-1 font-medium text-fg hover:bg-white/5 disabled:opacity-50"
                      disabled={Boolean(t && 'enCours' in t)} onClick={() => testerApi(c.id)}>
                      {t && 'enCours' in t ? 'Test en cours…' : 'Tester la connexion'}
                    </button>
                    {t && 'erreur' in t && <p className="mt-1 text-red-500">Échec : {t.erreur}</p>}
                    {t && 'statut' in t && (
                      <p className={`mt-1 ${t.ok ? 'text-emerald-500' : 'text-amber-500'}`}>
                        Racine de l'API : {t.statut}{t.ok ? '' : ' (une racine qui refuse peut être normale : vérifier avec la documentation)'}.
                        {c.infos?.openapi && <span className="mt-0.5 block">{t.erreur_openapi ? `Description OpenAPI : ${t.erreur_openapi}` : `Description OpenAPI : ${t.operations} opération${t.operations > 1 ? 's' : ''} lue${t.operations > 1 ? 's' : ''}.`}</span>}
                      </p>
                    )}
                  </div>
                );
              })()}
              {estMcp(c.type) && (() => {
                const t = tests[c.id];
                return (
                  <div className="mt-2 text-xs">
                    <button type="button" className="rounded-md border border-line px-2 py-1 font-medium text-fg hover:bg-white/5 disabled:opacity-50"
                      disabled={Boolean(t && 'enCours' in t)} onClick={() => tester(c.id)}>
                      {t && 'enCours' in t ? 'Test en cours…' : 'Tester la connexion'}
                    </button>
                    {t && 'ok' in t && (t.ok ? (
                      <p className="mt-1 text-emerald-500">
                        Répond : {t.outils.length} outil{t.outils.length > 1 ? 's' : ''} ({t.outils.filter((o) => o.lecture).length} en lecture directe, les autres proposés au client avant exécution).
                        <span className="mt-0.5 block text-muted">{t.outils.map((o) => `${o.nom}${o.lecture ? '' : ' ✎'}`).join(', ')}</span>
                      </p>
                    ) : <p className="mt-1 text-red-500">Échec : {t.erreur}</p>)}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
