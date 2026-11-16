// CRM › Studio IA › Paramètres : réglages globaux du Studio (studio_config).
// Valeurs par défaut appliquées à la création d'un espace depuis une demande,
// ouverture du questionnaire public et taux de conversion des coûts.
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button, Field, Spinner } from '@/components/ui';

const db = supabase as unknown as SupabaseClient;

const CHAMPS: { cle: string; label: string; aide: string; pas?: string }[] = [
  { cle: 'defaut_budget_ia_jour_eur', label: 'Plafond IA par jour et par espace (€)', aide: 'Au plafond, les agents de l\'espace s\'arrêtent jusqu\'au lendemain. Vide = sans plafond.', pas: '0.5' },
  { cle: 'defaut_quota_messages_mois', label: 'Demandes aux agents / mois', aide: 'Quota mensuel d\'un nouvel espace. Vide = illimité.' },
  { cle: 'defaut_quota_images_mois', label: 'Visuels IA / mois', aide: '0 = désactivé.' },
  { cle: 'defaut_quota_videos_mois', label: 'Vidéos IA / mois', aide: '0 = désactivé (≈ 0,50 $ la vidéo de 6 s).' },
  { cle: 'taux_usd_eur', label: 'Taux USD → EUR', aide: 'Conversion des coûts OpenRouter (plafond du jour, rentabilité).', pas: '0.01' },
];

export default function ParametresPanel() {
  const [valeurs, setValeurs] = useState<Record<string, string> | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    db.from('studio_config').select('cle, valeur').in('cle', [...CHAMPS.map((c) => c.cle), 'onboarding_ouvert'])
      .then(({ data }) => setValeurs(Object.fromEntries((data ?? []).map((r) => [r.cle, String(r.valeur ?? '')]))));
  }, []);

  const enregistrer = async () => {
    if (!valeurs) return;
    setMessage('');
    const lignes = [...CHAMPS.map((c) => c.cle), 'onboarding_ouvert'].map((cle) => ({ cle, valeur: (valeurs[cle] ?? '').trim() }));
    const { error } = await db.from('studio_config').upsert(lignes);
    setMessage(error ? `Erreur : ${error.message}` : 'Paramètres enregistrés. Ils s\'appliquent aux prochains espaces créés (les espaces existants gardent leurs réglages).');
  };

  if (!valeurs) return <Spinner />;
  return (
    <div className="card max-w-3xl space-y-4">
      <div>
        <h3 className="font-semibold text-fg">Paramètres du Studio</h3>
        <p className="text-sm text-muted">Valeurs appliquées à chaque espace créé depuis une demande d'onboarding. Chaque espace reste modifiable dans sa fiche.</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" checked={valeurs.onboarding_ouvert !== 'false'}
          onChange={(e) => setValeurs({ ...valeurs, onboarding_ouvert: e.target.checked ? 'true' : 'false' })} />
        Questionnaire public d'onboarding ouvert (/studio/demarrer)
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {CHAMPS.map((c) => (
          <Field key={c.cle} label={c.label} hint={c.aide}>
            <input type="number" min={0} step={c.pas ?? '1'} className="input" value={valeurs[c.cle] ?? ''}
              onChange={(e) => setValeurs({ ...valeurs, [c.cle]: e.target.value })} />
          </Field>
        ))}
      </div>
      {message && <p className="text-sm text-muted">{message}</p>}
      <Button onClick={enregistrer}>Enregistrer</Button>
    </div>
  );
}
