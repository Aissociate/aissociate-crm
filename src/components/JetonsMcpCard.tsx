import { useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, Ban } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Spinner, Button, Field } from '@/components/ui';

// Jetons personnels du serveur MCP distant (Edge Function `mcp`). Le jeton en
// clair n'est renvoyé qu'une fois par `creer_jeton_mcp` : la base ne garde que
// son empreinte. Voir mcp/README-distant.md pour brancher claude.ai, Claude
// Desktop ou n8n.
type Jeton = {
  id: string; libelle: string; prefixe: string; created_at: string;
  expires_at: string | null; last_used_at: string | null; revoked_at: string | null;
};

const URL_MCP = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp`;
const DUREES = [
  { jours: 30, label: '30 jours' },
  { jours: 90, label: '90 jours' },
  { jours: 365, label: '1 an' },
  { jours: 0, label: 'Sans expiration' },
];

const date = (s: string | null) => (s ? new Date(s).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function statut(j: Jeton): { label: string; cls: string } {
  if (j.revoked_at) return { label: 'Révoqué', cls: 'bg-red-50 text-red-700' };
  if (j.expires_at && new Date(j.expires_at) <= new Date()) return { label: 'Expiré', cls: 'bg-amber-50 text-amber-700' };
  return { label: 'Actif', cls: 'bg-emerald-50 text-emerald-700' };
}

export function JetonsMcpCard() {
  const [jetons, setJetons] = useState<Jeton[]>([]);
  const [loading, setLoading] = useState(true);
  const [libelle, setLibelle] = useState('');
  const [jours, setJours] = useState(90);
  const [creation, setCreation] = useState(false);
  const [nouveau, setNouveau] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);

  const charger = async () => {
    const { data, error } = await supabase.from('mcp_jetons')
      .select('id, libelle, prefixe, created_at, expires_at, last_used_at, revoked_at')
      .order('created_at', { ascending: false });
    if (error) alert(error.message);
    setJetons((data ?? []) as Jeton[]);
    setLoading(false);
  };
  useEffect(() => { charger(); }, []);

  const creer = async () => {
    if (!libelle.trim()) return;
    setCreation(true);
    const { data, error } = await supabase.rpc('creer_jeton_mcp', { p_libelle: libelle.trim(), p_jours: jours || null });
    setCreation(false);
    if (error) { alert(error.message); return; }
    setNouveau(data?.jeton ?? null);
    setLibelle('');
    charger();
  };

  const revoquer = async (j: Jeton) => {
    if (!confirm(`Révoquer le jeton « ${j.libelle} » ? Les outils qui l'utilisent seront refusés immédiatement.`)) return;
    const { error } = await supabase.rpc('revoquer_jeton_mcp', { p_id: j.id });
    if (error) { alert(error.message); return; }
    charger();
  };

  const copier = async (texte: string, cle: string) => {
    try { await navigator.clipboard.writeText(texte); setCopie(cle); setTimeout(() => setCopie(null), 1500); } catch { /* presse-papiers refusé */ }
  };

  return (
    <Card className="lg:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-fg">Connecteur MCP (claude.ai, Claude Desktop, n8n)</h2>
      </div>
      <p className="mb-4 text-sm text-muted">
        Un jeton personnel permet à un agent IA externe d'interroger le CRM <strong>avec vos droits</strong> (il ne voit que votre
        périmètre). Il ne modifie rien : ses demandes d'écriture arrivent comme propositions à valider dans
        l'Assistant (conversation « Connecteur MCP »). Le jeton n'est affiché qu'une seule fois.
      </p>

      <div className="mb-4 rounded-lg border border-line p-3 text-sm">
        <span className="text-muted">Adresse du serveur : </span>
        <code className="break-all">{URL_MCP}</code>
        <button type="button" className="ml-2 text-brand-600 hover:underline" onClick={() => copier(URL_MCP, 'url')}>
          {copie === 'url' ? 'Copiée ✓' : 'Copier'}
        </button>
      </div>

      {nouveau && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="mb-2 font-medium">Copiez ce jeton maintenant : il ne sera plus jamais affiché.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1">{nouveau}</code>
            <Button variant="secondary" className="py-1 text-sm" onClick={() => copier(nouveau, 'jeton')}>
              <Copy className="h-3.5 w-3.5" /> {copie === 'jeton' ? 'Copié ✓' : 'Copier'}
            </Button>
            <Button variant="secondary" className="py-1 text-sm" onClick={() => copier(`${URL_MCP}?jeton=${nouveau}`, 'urlj')}>
              <Copy className="h-3.5 w-3.5" /> {copie === 'urlj' ? 'Copiée ✓' : 'URL pour claude.ai'}
            </Button>
            <button type="button" className="ml-auto text-xs underline" onClick={() => setNouveau(null)}>J'ai copié le jeton</button>
          </div>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Field label="Libellé (où sera utilisé le jeton)">
          <input className="input" maxLength={80} placeholder="ex. n8n relances, Claude Desktop portable" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
        </Field>
        <Field label="Validité">
          <select className="input" value={jours} onChange={(e) => setJours(Number(e.target.value))}>
            {DUREES.map((d) => <option key={d.jours} value={d.jours}>{d.label}</option>)}
          </select>
        </Field>
        <Button onClick={creer} disabled={creation || !libelle.trim()}>
          <Plus className="h-4 w-4" /> {creation ? 'Création…' : 'Créer un jeton'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Spinner className="h-6 w-6" /></div>
      ) : jetons.length === 0 ? (
        <p className="text-sm text-muted">Aucun jeton pour l'instant.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 pr-3">Libellé</th><th className="pr-3">Jeton</th><th className="pr-3">Créé le</th>
                <th className="pr-3">Expire le</th><th className="pr-3">Dernier usage</th><th className="pr-3">Statut</th><th />
              </tr>
            </thead>
            <tbody>
              {jetons.map((j) => {
                const s = statut(j);
                return (
                  <tr key={j.id} className="border-t border-line">
                    <td className="py-2 pr-3 font-medium text-fg">{j.libelle}</td>
                    <td className="pr-3"><code>{j.prefixe}…</code></td>
                    <td className="pr-3">{date(j.created_at)}</td>
                    <td className="pr-3">{j.expires_at ? date(j.expires_at) : 'Jamais'}</td>
                    <td className="pr-3">{date(j.last_used_at)}</td>
                    <td className="pr-3"><span className={`rounded px-2 py-0.5 text-xs ${s.cls}`}>{s.label}</span></td>
                    <td className="text-right">
                      {!j.revoked_at && (
                        <Button variant="danger" className="py-1 text-sm" onClick={() => revoquer(j)}>
                          <Ban className="h-3.5 w-3.5" /> Révoquer
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
