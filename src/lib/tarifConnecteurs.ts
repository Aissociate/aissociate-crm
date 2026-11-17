// Tarif des connecteurs du Studio IA : réglé dans CRM › Studio IA › Paramètres (studio_config),
// lu par la page publique /agents-ia via la fonction `studio` (action « tarif_public »).
// Les valeurs ci-dessous ne servent qu'en repli (chargement, hors ligne, prérendu SEO).
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Types facturables, dans l'ordre d'affichage (mêmes clés que supabase/functions/studio/facturation.ts). */
export const TYPES_CONNECTEURS: { type: string; libelle: string; court: string }[] = [
  { type: 'google', libelle: 'Google Workspace (Gmail, Agenda, Drive)', court: 'Google Workspace' },
  { type: 'microsoft', libelle: 'Outlook / Microsoft 365', court: 'Outlook' },
  { type: 'facebook', libelle: 'Facebook', court: 'Facebook' },
  { type: 'instagram', libelle: 'Instagram', court: 'Instagram' },
  { type: 'tiktok', libelle: 'TikTok', court: 'TikTok' },
  { type: 'linkedin', libelle: 'LinkedIn', court: 'LinkedIn' },
  { type: 'imap', libelle: 'Autre messagerie (OVH, IONOS, Orange…)', court: 'autre messagerie' },
  { type: 'mcp', libelle: 'Serveur MCP de votre logiciel', court: 'serveur MCP' },
  { type: 'app', libelle: 'Autres applications, sur demande', court: 'autre application' },
];

export type TarifConnecteurs = { prix: number; inclus: string[] };
export const TARIF_DEFAUT: TarifConnecteurs = {
  prix: 9.99,
  inclus: ['google', 'microsoft', 'facebook', 'instagram', 'tiktok', 'linkedin'],
};

export const libelle = (type: string, court = false) => {
  const t = TYPES_CONNECTEURS.find((x) => x.type === type);
  return t ? (court ? t.court : t.libelle) : type;
};

/** Liste lisible : « A, B et C ». */
export const enumerer = (l: string[]) => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}`);

/** Tarif en vigueur, lu sans connexion ; repli sur TARIF_DEFAUT. */
export function useTarifConnecteurs(): TarifConnecteurs {
  const [tarif, setTarif] = useState(TARIF_DEFAUT);
  useEffect(() => {
    let vivant = true;
    supabase.functions.invoke('studio', { body: { action: 'tarif_public' } }).then(({ data }) => {
      const d = data as Partial<TarifConnecteurs> | null;
      if (!vivant || !d || typeof d.prix !== 'number' || !Array.isArray(d.inclus)) return;
      setTarif({ prix: d.prix, inclus: d.inclus.filter((t) => TYPES_CONNECTEURS.some((x) => x.type === t)) });
    }).catch(() => undefined);
    return () => { vivant = false; };
  }, []);
  return tarif;
}
