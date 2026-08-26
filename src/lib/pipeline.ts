/**
 * Colonnes du pipeline commercial — configurables depuis la page Pipeline.
 *
 * La liste ordonnée (clé + libellé) vit dans `parametres` (cle 'pipeline').
 * La clé d'une colonne est stable : renommer une colonne ne touche que le
 * libellé, les opportunités (`stage` / `colonne_manuelle`) référencent la clé.
 * Les colonnes `systeme` (nouveau, gagne, perdu) ne sont pas supprimables :
 * défaut des nouvelles opportunités, clôture automatique (set_opp_cloture),
 * statistiques du dashboard.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type PipelineColonne = { cle: string; libelle: string; systeme?: boolean };

export const COLONNES_DEFAUT: PipelineColonne[] = [
  { cle: 'nouveau', libelle: 'Nouveau', systeme: true },
  { cle: 'qualifie', libelle: 'Qualifié' },
  { cle: 'proposition', libelle: 'Proposition' },
  { cle: 'negociation', libelle: 'Négociation' },
  { cle: 'gagne', libelle: 'Gagné', systeme: true },
  { cle: 'perdu', libelle: 'Perdu', systeme: true },
];

export async function lireColonnesPipeline(): Promise<PipelineColonne[]> {
  const { data } = await supabase.from('parametres').select('valeur').eq('cle', 'pipeline').maybeSingle();
  const cols = (data?.valeur as { colonnes?: PipelineColonne[] } | null)?.colonnes;
  return Array.isArray(cols) && cols.length ? cols : COLONNES_DEFAUT;
}

export async function ecrireColonnesPipeline(colonnes: PipelineColonne[]): Promise<string | null> {
  const { error } = await supabase.from('parametres')
    .upsert({ cle: 'pipeline', valeur: { colonnes } }, { onConflict: 'cle' });
  return error?.message ?? null;
}

/** « Relance N+1 » → « relance-n-1 » : clé unique, stable, sans accent. */
export function cleDepuisLibelle(libelle: string, existantes: string[]): string {
  const base = libelle.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'colonne';
  let cle = base;
  for (let i = 2; existantes.includes(cle); i++) cle = `${base}-${i}`;
  return cle;
}

/** Colonnes du pipeline + libellés, avec repli sur la liste par défaut. */
export function usePipelineColonnes() {
  const [colonnes, setColonnes] = useState<PipelineColonne[]>(COLONNES_DEFAUT);
  useEffect(() => { void lireColonnesPipeline().then(setColonnes); }, []);
  const libelleDe = (cle: string) => colonnes.find((c) => c.cle === cle)?.libelle ?? cle;
  return { colonnes, setColonnes, libelleDe };
}
