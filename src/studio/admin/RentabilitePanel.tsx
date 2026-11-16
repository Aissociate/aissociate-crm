// CRM › Studio IA clients › Rentabilité : ce que chaque client rapporte et coûte (IA).
// Coûts réels OpenRouter (USD) convertis en euros ; abonnement saisi dans la fiche de l'espace.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { Badge, Card, Spinner } from '@/components/ui';
import { derniersMois, rapportEnMarkdown, type Rapport } from '../rapport';
import { imprimerDocument } from '../exports';
import type { Entete } from '../api';

const db = supabase as unknown as SupabaseClient;
type Ligne = {
  workspace_id: string; missions: number; reponses: number; a_revoir: number; sans_cout: number;
  images: number; videos: number; cout_texte_usd: number; cout_medias_usd: number;
};
type Espace = { id: string; nom: string; actif: boolean; offre: string; abonnement_mensuel: number | null };

const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

export default function RentabilitePanel() {
  const mois = derniersMois();
  const [choix, setChoix] = useState(mois[0].valeur);
  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [taux, setTaux] = useState(0.92);
  const [demo, setDemo] = useState<{ appels: number; cout: number }>({ appels: 0, cout: 0 });
  const [erreur, setErreur] = useState('');
  const [rapportEnCours, setRapportEnCours] = useState('');

  const charger = useCallback(async () => {
    setLignes(null); setErreur('');
    const debut = `${choix}-01`;
    const [a, m] = choix.split('-').map(Number);
    const fin = new Date(Date.UTC(a, m, 1)).toISOString();
    const [w, r, t, d] = await Promise.all([
      db.from('studio_workspaces').select('id, nom, actif, offre, abonnement_mensuel').order('nom'),
      db.from('studio_rentabilite_mois').select('*').eq('mois', debut),
      db.from('studio_config').select('valeur').eq('cle', 'taux_usd_eur').maybeSingle(),
      db.from('studio_demo_appels').select('cout').gte('created_at', debut).lt('created_at', fin),
    ]);
    if (w.error || r.error) {
      setErreur((r.error ?? w.error)!.message.includes('studio_rentabilite_mois') || (r.error ?? w.error)!.message.includes('abonnement_mensuel')
        ? 'Migration « studio_couts » non appliquée : la rentabilité sera disponible après son exécution.'
        : (r.error ?? w.error)!.message);
      setLignes([]); return;
    }
    setEspaces((w.data ?? []) as Espace[]);
    setLignes((r.data ?? []) as Ligne[]);
    if (t.data?.valeur) setTaux(Number(t.data.valeur) || 0.92);
    // La démo Sam est un coût d'acquisition (pas d'espace client) : affichée à part.
    setDemo({ appels: (d.data ?? []).length, cout: (d.data ?? []).reduce((s, x) => s + (Number(x.cout) || 0), 0) });
  }, [choix]);
  useEffect(() => { charger(); }, [charger]);

  const enregistrerTaux = async (v: number) => {
    setTaux(v);
    await db.from('studio_config').upsert({ cle: 'taux_usd_eur', valeur: String(v) });
  };

  const tableau = useMemo(() => espaces.map((e) => {
    const l = lignes?.find((x) => x.workspace_id === e.id);
    const coutUsd = Number(l?.cout_texte_usd ?? 0) + Number(l?.cout_medias_usd ?? 0);
    const cout = coutUsd * taux;
    const abo = e.abonnement_mensuel != null ? Number(e.abonnement_mensuel) : null;
    return { e, l, cout, abo, marge: abo != null ? abo - cout : null };
  }).filter((x) => x.e.actif || x.l), [espaces, lignes, taux]);

  const totaux = tableau.reduce((t, x) => ({
    abo: t.abo + (x.abo ?? 0), cout: t.cout + x.cout, missions: t.missions + Number(x.l?.missions ?? 0),
  }), { abo: 0, cout: 0, missions: 0 });

  const rapport = async (e: Espace) => {
    setRapportEnCours(e.id); setErreur('');
    try {
      const { data, error } = await supabase.functions.invoke('studio', { body: { action: 'admin_rapport', workspace_id: e.id, mois: choix } });
      if (error) throw new Error(await functionErrorMessage(error));
      const { rapport: r, entete, logo_url, nom } = data as { rapport: Rapport; entete: Entete; logo_url: string | null; nom: string };
      const entreprise = entete.raison_sociale || nom.replace(/^Démo — /, '');
      await imprimerDocument({
        titre: `Rapport d'activité — ${r.libelle}`, meta: `Studio IA Aissociate · ${entreprise}`,
        contenu: rapportEnMarkdown(r, entreprise), entete, nomEspace: nom,
      }, logo_url);
    } catch (err) { setErreur(err instanceof Error ? err.message : String(err)); }
    finally { setRapportEnCours(''); }
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-4">
        <label className="text-sm text-fg">Mois
          <select className="input mt-1 capitalize" value={choix} onChange={(e) => setChoix(e.target.value)}>
            {mois.map((m) => <option key={m.valeur} value={m.valeur}>{m.libelle}</option>)}
          </select>
        </label>
        <label className="text-sm text-fg">Taux USD → EUR
          <input type="number" step="0.01" min="0.5" max="1.5" className="input mt-1 w-28" value={taux}
            onChange={(e) => enregistrerTaux(Number(e.target.value) || 0.92)} />
        </label>
        <div className="ml-auto grid grid-cols-3 gap-6 text-right text-sm">
          <div><p className="text-muted">Abonnements</p><p className="text-lg font-semibold text-fg">{eur(totaux.abo)}</p></div>
          <div><p className="text-muted">Coût IA clients</p><p className="text-lg font-semibold text-fg">{eur(totaux.cout)}</p></div>
          <div><p className="text-muted">Marge brute</p><p className={`text-lg font-semibold ${totaux.abo - totaux.cout < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{eur(totaux.abo - totaux.cout)}</p></div>
        </div>
      </Card>
      {erreur && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{erreur}</p>}
      {lignes === null ? <Spinner /> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-muted">
              <tr>
                <th className="px-4 py-3">Espace</th><th>Abonnement HT</th><th>Missions</th><th>À revoir</th>
                <th>Visuels / vidéos</th><th>Coût IA</th><th>Marge</th><th />
              </tr>
            </thead>
            <tbody>
              {tableau.map(({ e, l, cout, abo, marge }) => {
                const pctRevoir = l?.reponses ? Math.round((Number(l.a_revoir) / Number(l.reponses)) * 100) : 0;
                return (
                  <tr key={e.id} className="border-b border-line/60">
                    <td className="px-4 py-3 font-medium text-fg">
                      {e.nom}{!e.actif && <Badge tone="danger" className="ml-2">inactif</Badge>}
                      {Number(l?.sans_cout ?? 0) > 0 && (
                        <p className="text-xs font-normal text-muted">{l!.sans_cout} réponse(s) sans coût enregistré (avant le suivi ou flux interrompu)</p>
                      )}
                    </td>
                    <td>{abo != null ? eur(abo) : <span className="text-xs text-muted">à renseigner</span>}</td>
                    <td>{l?.missions ?? 0}</td>
                    <td className={pctRevoir >= 20 ? 'font-semibold text-red-600' : ''}>{l?.reponses ? `${pctRevoir} %` : '—'}</td>
                    <td>{l ? `${l.images} / ${l.videos}` : '—'}</td>
                    <td>{eur(cout)}</td>
                    <td className={marge != null && marge < 0 ? 'font-semibold text-red-600' : 'text-emerald-600'}>
                      {marge != null ? `${eur(marge)}${abo ? ` (${Math.round((marge / abo) * 100)} %)` : ''}` : '—'}
                    </td>
                    <td className="pr-4 text-right">
                      <button className="btn-ghost text-xs" disabled={rapportEnCours === e.id || !l?.missions} onClick={() => rapport(e)}
                        title={l?.missions ? 'Rapport de valeur du client (PDF), à son en-tête' : 'Aucune mission ce mois-ci'}>
                        <FileText className="mr-1 inline h-3.5 w-3.5" />{rapportEnCours === e.id ? '…' : 'Rapport'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {tableau.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-muted">Aucun espace actif.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">
        Coûts réels renvoyés par OpenRouter pour chaque réponse, visuel et vidéo (vidéos estimées à 0,08 $/s si le coût n'est pas renvoyé).
        Démo publique « Sam » ce mois-ci : {demo.appels} échange{demo.appels > 1 ? 's' : ''}, {eur(demo.cout * taux)} (coût d'acquisition, hors clients).
        Une part de « À revoir » au-delà de 20 % signale un agent ou un client à accompagner.
      </p>
    </div>
  );
}
