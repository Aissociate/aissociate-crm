// CRM › fiche d'un espace Studio : crédits de recharge (solde reporté de mois en mois),
// ajout manuel (achat ou geste commercial), packs propres au client et achat en libre-service.
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button, Field } from '@/components/ui';

const db = supabase as unknown as SupabaseClient;
type Pack = { prix: number | null; credits: number | null };
type Mvt = { id: string; nature: string; credits: number; ressource: string | null; prix_ht: number | null; note: string | null; acteur: string | null; created_at: string };

const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const NATURES: Record<string, string> = { achat: 'Achat', offert: 'Offert', correction: 'Correction', consommation: 'Consommation' };

export default function RechargesEspace({ workspaceId }: { workspaceId: string }) {
  const [mvts, setMvts] = useState<Mvt[] | null>(null);
  const [defauts, setDefauts] = useState<{ prix: string; credits: string }[]>([{ prix: '10', credits: '100' }, { prix: '30', credits: '350' }]);
  const [packs, setPacks] = useState<Pack[]>([{ prix: null, credits: null }, { prix: null, credits: null }]);
  const [libre, setLibre] = useState(true);
  const [ajout, setAjout] = useState({ nature: 'offert', credits: '', prix: '', note: '' });
  const [message, setMessage] = useState('');
  const [indisponible, setIndisponible] = useState(false);

  const charger = useCallback(async () => {
    const [m, w, c] = await Promise.all([
      db.from('studio_recharges').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(500),
      db.from('studio_workspaces').select('recharge_packs, recharge_achat_libre').eq('id', workspaceId).maybeSingle(),
      db.from('studio_config').select('cle, valeur').like('cle', 'recharge_%'),
    ]);
    if (m.error || w.error) { setIndisponible(true); setMvts([]); return; }
    setMvts((m.data ?? []) as Mvt[]);
    const p = (w.data?.recharge_packs ?? []) as Pack[];
    setPacks([0, 1].map((i) => ({ prix: p[i]?.prix ?? null, credits: p[i]?.credits ?? null })));
    setLibre(w.data?.recharge_achat_libre !== false);
    const cfg = Object.fromEntries((c.data ?? []).map((r) => [r.cle, String(r.valeur ?? '')]));
    setDefauts([
      { prix: cfg.recharge_petit_prix_ht || '10', credits: cfg.recharge_petit_credits || '100' },
      { prix: cfg.recharge_grand_prix_ht || '30', credits: cfg.recharge_grand_credits || '350' },
    ]);
  }, [workspaceId]);
  useEffect(() => { charger(); }, [charger]);

  if (indisponible) return <p className="text-sm text-muted">Recharges indisponibles : migration « studio_recharges » non appliquée.</p>;
  if (!mvts) return null;

  const solde = mvts.reduce((t, m) => t + m.credits, 0);
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const consommes = -mvts.filter((m) => m.nature === 'consommation' && m.created_at >= debutMois).reduce((t, m) => t + m.credits, 0);
  const aFacturer = mvts.filter((m) => m.nature === 'achat' && m.created_at >= debutMois).reduce((t, m) => t + Number(m.prix_ht ?? 0), 0);

  const enregistrerReglages = async () => {
    setMessage('');
    const propres = packs.some((p) => p.prix != null || p.credits != null) ? packs : null;
    const { error } = await db.from('studio_workspaces').update({ recharge_packs: propres, recharge_achat_libre: libre }).eq('id', workspaceId);
    setMessage(error ? `Erreur : ${error.message}` : 'Réglages des recharges enregistrés.');
  };

  const ajouter = async () => {
    setMessage('');
    const credits = Math.round(Number(ajout.credits));
    if (!credits) { setMessage('Indiquez un nombre de crédits (négatif pour retirer).'); return; }
    const { data: me } = await supabase.auth.getUser();
    const { error } = await db.from('studio_recharges').insert({
      workspace_id: workspaceId, nature: ajout.nature, credits,
      prix_ht: ajout.nature === 'achat' && ajout.prix ? Number(ajout.prix) : null,
      note: ajout.note.trim() || null, acteur: `crm:${me.user?.email ?? ''}`,
    });
    if (error) { setMessage(`Erreur : ${error.message}`); return; }
    setAjout({ nature: 'offert', credits: '', prix: '', note: '' });
    await charger();
  };

  const nombre = (v: string) => (v === '' ? null : Number(v));
  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-fg">Crédits de recharge</h3>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-line p-3"><p className="text-muted">Solde (reporté)</p><p className="text-lg font-semibold text-fg">{solde} crédits</p></div>
        <div className="rounded-lg border border-line p-3"><p className="text-muted">Consommés ce mois</p><p className="text-lg font-semibold text-fg">{consommes}</p></div>
        <div className="rounded-lg border border-line p-3"><p className="text-muted">Achats à facturer ce mois</p><p className="text-lg font-semibold text-fg">{eur(aFacturer)} HT</p></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {packs.map((p, i) => (
          <Field key={i} label={`Pack ${i === 0 ? 'petit' : 'grand'} de ce client`} hint={`Vide = Paramètres (${defauts[i].credits} crédits pour ${defauts[i].prix} € HT).`}>
            <div className="flex gap-2">
              <input type="number" min={0} step="0.5" className="input" placeholder={`${defauts[i].prix} € HT`} value={p.prix ?? ''}
                onChange={(e) => setPacks(packs.map((x, j) => (j === i ? { ...x, prix: nombre(e.target.value) } : x)))} />
              <input type="number" min={0} className="input" placeholder={`${defauts[i].credits} crédits`} value={p.credits ?? ''}
                onChange={(e) => setPacks(packs.map((x, j) => (j === i ? { ...x, credits: nombre(e.target.value) } : x)))} />
            </div>
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={libre} onChange={(e) => setLibre(e.target.checked)} />
          Le propriétaire peut acheter des recharges depuis le Studio
        </label>
        <Button variant="secondary" onClick={enregistrerReglages}>Enregistrer les recharges</Button>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
        <Field label="Ajouter">
          <select className="input" value={ajout.nature} onChange={(e) => setAjout({ ...ajout, nature: e.target.value })}>
            <option value="offert">Crédits offerts</option><option value="achat">Achat (à facturer)</option><option value="correction">Correction</option>
          </select>
        </Field>
        <Field label="Crédits"><input type="number" className="input w-28" value={ajout.credits} onChange={(e) => setAjout({ ...ajout, credits: e.target.value })} /></Field>
        {ajout.nature === 'achat' && (
          <Field label="Prix HT (€)"><input type="number" min={0} step="0.5" className="input w-28" value={ajout.prix} onChange={(e) => setAjout({ ...ajout, prix: e.target.value })} /></Field>
        )}
        <Field label="Note"><input className="input" value={ajout.note} onChange={(e) => setAjout({ ...ajout, note: e.target.value })} /></Field>
        <Button onClick={ajouter}>Ajouter</Button>
      </div>
      {message && <p className="text-sm text-muted">{message}</p>}

      {mvts.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-xs">
            <tbody>
              {mvts.filter((m) => m.nature !== 'consommation').slice(0, 50).map((m) => (
                <tr key={m.id} className="border-b border-line/60">
                  <td className="px-3 py-1.5 text-muted">{new Date(m.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>{NATURES[m.nature] ?? m.nature}</td>
                  <td className="text-fg">{m.credits > 0 ? '+' : ''}{m.credits}</td>
                  <td>{m.prix_ht ? `${eur(Number(m.prix_ht))} HT` : ''}</td>
                  <td className="pr-3 text-muted">{m.note ?? ''}{m.acteur ? ` · ${m.acteur.replace(/^(client|crm):/, '')}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
