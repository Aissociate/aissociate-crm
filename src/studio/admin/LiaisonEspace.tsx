// Fiche d'un espace (CRM) : canal e-mail de liaison. Crée la boîte AgentMail de
// l'espace, l'active ou la coupe, choisit l'agent par défaut et montre les
// e-mails reçus (y compris ceux mis en quarantaine, avec leur motif).
import { useCallback, useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { Badge, Button } from '@/components/ui';

type Instruction = {
  reference: string; sujet: string; type: string; statut: string; motif: string | null;
  agent_id: string | null; created_at: string; expediteur?: string;
};
type Etat = { disponible: boolean; configure: boolean; email: string | null; actif: boolean; agent: string | null; instructions: Instruction[] };

const TONS: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  traitee: 'success', quarantaine: 'danger', erreur: 'danger', recue: 'warning', ignoree: 'neutral',
};

async function appeler(body: Record<string, unknown>): Promise<Etat> {
  const { data, error } = await supabase.functions.invoke('studio', { body: { action: 'admin_liaison', ...body } });
  if (error) throw new Error(await functionErrorMessage(error));
  return data as Etat;
}

export default function LiaisonEspace({ workspaceId, nomEspace, agents }: { workspaceId: string; nomEspace: string; agents: { id: string; prenom: string }[] }) {
  const [e, setE] = useState<Etat | null>(null);
  const [identifiant, setIdentifiant] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const agir = useCallback(async (body: Record<string, unknown> = {}) => {
    setErreur(''); setEnvoi(true);
    try { setE(await appeler({ workspace_id: workspaceId, ...body })); }
    catch (x) { setErreur(x instanceof Error ? x.message : String(x)); }
    finally { setEnvoi(false); }
  }, [workspaceId]);
  useEffect(() => { agir(); }, [agir]);

  const suggestion = nomEspace.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 font-semibold text-fg"><Mail className="h-4 w-4" />Canal e-mail</h3>
      {erreur && <p className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{erreur}</p>}
      {!e ? <p className="text-sm text-muted">Chargement…</p> : !e.disponible ? (
        <p className="text-sm text-muted">Migration « studio_liaison » non appliquée.</p>
      ) : (
        <div className="space-y-3 rounded-lg border border-line p-3 text-sm">
          {!e.configure && <p className="text-amber-600">Secret AGENTMAIL_API_KEY absent : la boîte ne peut pas être créée.</p>}
          {e.email ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-fg">{e.email}</span>
              {e.actif ? <Badge tone="success">actif</Badge> : <Badge tone="neutral">coupé</Badge>}
              <Button variant="secondary" className="ml-auto" disabled={envoi} onClick={() => agir({ activer: !e.actif })}>{e.actif ? 'Couper' : 'Activer'}</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input className="input max-w-xs" placeholder={suggestion} value={identifiant} onChange={(x) => setIdentifiant(x.target.value.toLowerCase())} />
              <span className="text-muted">@agentmail.to</span>
              <Button disabled={envoi || !e.configure} onClick={() => agir({ activer: true, username: identifiant || undefined })}>Créer l'adresse</Button>
            </div>
          )}
          <label className="flex items-center gap-2 text-fg">
            Agent qui répond sans désignation :
            <select className="input max-w-[12rem]" value={e.agent ?? ''} disabled={envoi} onChange={(x) => agir({ agent: x.target.value || null })}>
              <option value="">Premier agent de l'espace</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.prenom}</option>)}
            </select>
          </label>
          <p className="text-xs text-muted">Seuls les utilisateurs actifs de l'espace sont écoutés. Quarantaine muette pour les autres, et pour toute demande financière.</p>
          {e.instructions.length > 0 && (
            <ul className="divide-y divide-line/60 border-t border-line pt-1 text-xs">
              {e.instructions.slice(0, 15).map((i) => (
                <li key={i.reference} className="flex flex-wrap gap-x-3 py-1.5">
                  <span className="w-28 text-muted">{new Date(i.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span className="text-muted">{i.expediteur}</span>
                  <span className="min-w-0 flex-1 truncate text-fg">{i.sujet || '(sans objet)'}</span>
                  <Badge tone={TONS[i.statut] ?? 'neutral'}>{i.statut}</Badge>
                  {i.motif && <span className="w-full text-muted">↳ {i.motif}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
