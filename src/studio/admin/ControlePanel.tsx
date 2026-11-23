// CRM › Studio IA clients › Contrôle : contrôle quotidien du parcours client (06:00, La Réunion).
// Affiche le dernier passage (job_runs, fonction « studio-controle ») et permet de le relancer.
// Le contrôle crée un client fictif, le fait passer par tout le parcours puis le supprime
// (voir supabase/functions/studio/controle.ts).
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PlayCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { Badge, Button, Card, Spinner, type Tone } from '@/components/ui';

const db = supabase as unknown as SupabaseClient;

type Resultat = {
  id: string; etape: string; titre: string; niveau: 'ok' | 'alerte' | 'erreur' | 'ignore'; detail: string;
  diagnostic?: string; solution?: string; duree_ms: number; verification?: 'confirme' | 'intermittent';
};
type Passage = { started_at: string; ok: boolean; message: string | null; detail: { resultats?: Resultat[]; mail?: boolean } | null };

const TONS: Record<Resultat['niveau'], [Tone, string]> = {
  ok: ['success', 'OK'], alerte: ['warning', 'À surveiller'], erreur: ['danger', 'Problème'], ignore: ['neutral', 'Non testé'],
};

export default function ControlePanel() {
  const [passage, setPassage] = useState<Passage | null | undefined>(undefined);
  const [enCours, setEnCours] = useState(false);
  const [envoyer, setEnvoyer] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    const { data } = await db.from('job_runs').select('started_at, ok, message, detail')
      .eq('fonction', 'studio-controle').order('started_at', { ascending: false }).limit(1).maybeSingle();
    setPassage((data as Passage | null) ?? null);
  }, []);
  useEffect(() => { void charger(); }, [charger]);

  const lancer = async () => {
    setEnCours(true); setErreur('');
    const { error } = await supabase.functions.invoke('studio', { body: { action: 'admin_controle', envoyer } });
    if (error) setErreur(await functionErrorMessage(error));
    await charger();
    setEnCours(false);
  };

  const resultats = passage?.detail?.resultats ?? [];
  const etapes = [...new Set(resultats.map((r) => r.etape))];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Contrôle du parcours client</h3>
            <p className="text-sm text-gray-500">
              Chaque jour à 6 h (La Réunion), un client fictif passe par tout le parcours (questionnaire, essai, CGV, fin d'essai, paiement)
              puis il est supprimé. Les services externes sont aussi vérifiés. En cas de problème confirmé, un e-mail détaille le constat,
              la cause probable et la solution préconisée.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input type="checkbox" checked={envoyer} onChange={(e) => setEnvoyer(e.target.checked)} />
              Envoyer l'e-mail si problème
            </label>
            <Button onClick={lancer} disabled={enCours}>
              <PlayCircle className="mr-1 inline h-4 w-4" />{enCours ? 'Contrôle en cours (jusqu\'à 2 min)…' : 'Lancer maintenant'}
            </Button>
          </div>
        </div>
        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      </Card>

      {passage === undefined ? <Spinner /> : passage === null ? (
        <Card><p className="text-sm text-gray-500">Aucun contrôle n'a encore eu lieu.</p></Card>
      ) : (
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone={passage.ok ? 'success' : 'danger'}>{passage.ok ? 'Parcours fonctionnel' : 'Problème détecté'}</Badge>
            <span className="text-sm text-gray-600">
              {new Date(passage.started_at).toLocaleString('fr-FR', { timeZone: 'Indian/Reunion' })} · {passage.message}
              {passage.detail?.mail ? ' · alerte envoyée' : ''}
            </span>
          </div>
          {etapes.map((etape) => (
            <div key={etape} className="mb-4">
              <h4 className="mb-1 text-sm font-semibold text-gray-700">{etape}</h4>
              <ul className="divide-y divide-gray-100">
                {resultats.filter((r) => r.etape === etape).map((r) => (
                  <li key={r.id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TONS[r.niveau][0]}>{TONS[r.niveau][1]}</Badge>
                      {r.verification === 'intermittent' && <Badge tone="info">Passager</Badge>}
                      <span className="font-medium">{r.titre}</span>
                      <span className="text-xs text-gray-400">{(r.duree_ms / 1000).toFixed(1)} s</span>
                    </div>
                    <p className="mt-1 text-gray-600">{r.detail}</p>
                    {r.diagnostic && r.niveau !== 'ok' && <p className="mt-1"><b>Cause probable :</b> {r.diagnostic}</p>}
                    {r.solution && r.niveau !== 'ok' && <p className="mt-1"><b>Solution :</b> {r.solution}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
