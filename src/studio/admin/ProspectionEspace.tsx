// CRM › fiche d'un espace Studio : contacts de l'option Prospection de Sam (solde reporté),
// ajout manuel (geste commercial, achat hors ligne, correction).
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button, Field } from '@/components/ui';

const db = supabase as unknown as SupabaseClient;
type Mvt = { id: string; nature: string; contacts: number; prix_ht: number | null; note: string | null; acteur: string | null; created_at: string };

const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const NATURES: Record<string, string> = { achat: 'Achat', offert: 'Offert', decouverte: 'Découverte (Stage)', correction: 'Correction', consommation: 'Consommation' };

export default function ProspectionEspace({ workspaceId }: { workspaceId: string }) {
  const [mvts, setMvts] = useState<Mvt[] | null>(null);
  const [ajout, setAjout] = useState({ nature: 'offert', contacts: '', prix: '', note: '' });
  const [message, setMessage] = useState('');
  const [indisponible, setIndisponible] = useState(false);

  const charger = useCallback(async () => {
    const m = await db.from('studio_prospection_contacts').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1000);
    if (m.error) { setIndisponible(true); setMvts([]); return; }
    setMvts((m.data ?? []) as Mvt[]);
  }, [workspaceId]);
  useEffect(() => { void charger(); }, [charger]);

  if (indisponible) return <p className="text-sm text-muted">Option Prospection indisponible : migration « studio_prospection_option » non appliquée.</p>;
  if (!mvts) return null;

  const solde = mvts.reduce((t, m) => t + m.contacts, 0);
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const utilises = -mvts.filter((m) => m.nature === 'consommation' && m.created_at >= debutMois).reduce((t, m) => t + m.contacts, 0);
  const achats = mvts.filter((m) => m.nature === 'achat').reduce((t, m) => t + Number(m.prix_ht ?? 0), 0);

  const ajouter = async () => {
    setMessage('');
    const contacts = Math.round(Number(ajout.contacts));
    if (!contacts) { setMessage('Indiquez un nombre de contacts (négatif pour retirer).'); return; }
    const { data: me } = await supabase.auth.getUser();
    const { error } = await db.from('studio_prospection_contacts').insert({
      workspace_id: workspaceId, nature: ajout.nature, contacts,
      prix_ht: ajout.nature === 'achat' && ajout.prix ? Number(ajout.prix) : null,
      note: ajout.note.trim() || null, acteur: `crm:${me.user?.email ?? ''}`,
    });
    if (error) { setMessage(`Erreur : ${error.message}`); return; }
    setAjout({ nature: 'offert', contacts: '', prix: '', note: '' });
    await charger();
  };

  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-fg">Option Prospection (Sam)</h3>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-line p-3"><p className="text-muted">Solde (reporté)</p><p className="text-lg font-semibold text-fg">{solde.toLocaleString('fr-FR')} contacts</p></div>
        <div className="rounded-lg border border-line p-3"><p className="text-muted">Utilisés ce mois</p><p className="text-lg font-semibold text-fg">{utilises.toLocaleString('fr-FR')}</p></div>
        <div className="rounded-lg border border-line p-3"><p className="text-muted">Achats (cumul)</p><p className="text-lg font-semibold text-fg">{eur(achats)} HT</p></div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
        <Field label="Ajouter">
          <select className="input" value={ajout.nature} onChange={(e) => setAjout({ ...ajout, nature: e.target.value })}>
            <option value="offert">Contacts offerts</option><option value="achat">Achat hors ligne</option><option value="correction">Correction</option>
          </select>
        </Field>
        <Field label="Contacts"><input type="number" className="input w-28" value={ajout.contacts} onChange={(e) => setAjout({ ...ajout, contacts: e.target.value })} /></Field>
        {ajout.nature === 'achat' && (
          <Field label="Prix HT (€)"><input type="number" min={0} step="0.5" className="input w-28" value={ajout.prix} onChange={(e) => setAjout({ ...ajout, prix: e.target.value })} /></Field>
        )}
        <Field label="Note"><input className="input" value={ajout.note} onChange={(e) => setAjout({ ...ajout, note: e.target.value })} /></Field>
        <Button onClick={ajouter}>Ajouter</Button>
      </div>
      {message && <p className="text-sm text-muted">{message}</p>}

      {mvts.some((m) => m.nature !== 'consommation') && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-xs">
            <tbody>
              {mvts.filter((m) => m.nature !== 'consommation').slice(0, 50).map((m) => (
                <tr key={m.id} className="border-b border-line/60">
                  <td className="px-3 py-1.5 text-muted">{new Date(m.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>{NATURES[m.nature] ?? m.nature}</td>
                  <td className="text-fg">{m.contacts > 0 ? '+' : ''}{m.contacts}</td>
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
