// Harness général du Studio : le cadre commun injecté dans TOUS les agents,
// avant la fiche entreprise. Vide = texte par défaut du code (contexte.ts).
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { Button, Card, Field, Spinner } from '@/components/ui';

const db = supabase as unknown as SupabaseClient;
type Textes = { regles: string; perimetre: string };

export default function HarnessPanel() {
  const [valeurs, setValeurs] = useState<Textes | null>(null);
  const [defauts, setDefauts] = useState<Textes>({ regles: '', perimetre: '' });
  const [etat, setEtat] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data: conf }, def] = await Promise.all([
        db.from('studio_config').select('cle, valeur').in('cle', ['harness_regles', 'harness_perimetre']),
        supabase.functions.invoke('studio', { body: { action: 'admin_harness_defaut' } }),
      ]);
      const d = (def.data ?? { regles: '', perimetre: '' }) as Textes;
      if (def.error) setEtat(`Textes par défaut indisponibles : ${await functionErrorMessage(def.error)}`);
      setDefauts(d);
      const m = new Map((conf ?? []).map((r) => [r.cle as string, r.valeur as string]));
      setValeurs({ regles: m.get('harness_regles') || d.regles, perimetre: m.get('harness_perimetre') || d.perimetre });
    })();
  }, []);

  const enregistrer = async () => {
    if (!valeurs) return;
    setEtat('Enregistrement…');
    // Identique au défaut → on stocke vide : les évolutions du code s'appliqueront.
    const lignes = [
      { cle: 'harness_regles', valeur: valeurs.regles.trim() === defauts.regles.trim() ? '' : valeurs.regles },
      { cle: 'harness_perimetre', valeur: valeurs.perimetre.trim() === defauts.perimetre.trim() ? '' : valeurs.perimetre },
    ];
    const { error } = await db.from('studio_config').upsert(lignes);
    setEtat(error ? `Erreur : ${error.message}` : 'Enregistré : appliqué dès la prochaine demande de chaque client.');
  };

  if (!valeurs) return <Spinner />;
  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-fg">Harness général</h2>
        <p className="text-sm text-muted">
          Cadre commun à tous les agents de tous les clients. Ordre du prompt : identité de l'agent → périmètre → règles communes →
          fiche entreprise → consignes du client → outils connectés → ressources → contenus validés.
        </p>
      </div>
      <Field label="Règle de périmètre (spécialiste + relais)"
        hint="Variables : {{metier}}, {{super_pouvoirs}}, {{collegues}}, {{prenom}}. Garder la balise [[RELAIS:id]] : c'est elle qui affiche le bouton « Confier à … ».">
        <textarea className="input min-h-[220px] font-mono text-xs" value={valeurs.perimetre} onChange={(e) => setValeurs({ ...valeurs, perimetre: e.target.value })} />
      </Field>
      <Button variant="ghost" onClick={() => setValeurs({ ...valeurs, perimetre: defauts.perimetre })}><RotateCcw className="mr-1 inline h-3.5 w-3.5" />Texte par défaut</Button>
      <Field label="Règles communes">
        <textarea className="input min-h-[220px] font-mono text-xs" value={valeurs.regles} onChange={(e) => setValeurs({ ...valeurs, regles: e.target.value })} />
      </Field>
      <Button variant="ghost" onClick={() => setValeurs({ ...valeurs, regles: defauts.regles })}><RotateCcw className="mr-1 inline h-3.5 w-3.5" />Texte par défaut</Button>
      {!valeurs.perimetre.includes('[[RELAIS:') && <p className="text-sm text-amber-600">La règle de périmètre ne contient plus [[RELAIS:id]] : le relais entre agents ne s'affichera plus.</p>}
      <div className="flex items-center gap-3">
        <Button onClick={enregistrer}>Enregistrer</Button>
        {etat && <span className="text-sm text-muted">{etat}</span>}
      </div>
    </Card>
  );
}
