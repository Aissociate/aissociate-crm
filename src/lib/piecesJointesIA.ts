import { appelAgent } from './agentIA';

/**
 * Pièce jointe d'un email proposé par l'assistant IA. Clé « source:id » ; les
 * sources (devis, factures, plans AGEFICE, pièces de dossier, coffre-fort,
 * espace documentaire) sont définies côté serveur, dans
 * supabase/functions/_shared/agent/pieces_jointes.ts.
 */
export type PieceJointeIA = { cle: string; nom: string; origine: string };

/** Pièces jointes déjà retenues dans les arguments d'une proposition. */
export function piecesDeArgs(args: Record<string, unknown> | null | undefined): PieceJointeIA[] {
  const v = args?.pieces_jointes;
  if (!Array.isArray(v)) return [];
  return v.filter((p): p is PieceJointeIA => !!p && typeof p === 'object' && typeof (p as PieceJointeIA).cle === 'string');
}

/**
 * Fichiers joignables pour l'ajout manuel, listés par l'Edge Function `agent`
 * (mêmes règles que l'IA). Sans contact connu, il est retrouvé par l'adresse
 * du destinataire.
 */
export async function candidatsPiecesJointes(args: Record<string, unknown>): Promise<PieceJointeIA[]> {
  const { ok, data } = await appelAgent({
    mode: 'pieces_jointes', contact_id: args.contact_id, dossier_id: args.dossier_id, destinataire: args.destinataire,
  });
  if (!ok) throw new Error(String(data?.error ?? 'Liste des fichiers indisponible'));
  return (data?.pieces_jointes as PieceJointeIA[] | undefined) ?? [];
}
