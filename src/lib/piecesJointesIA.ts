import { supabase } from './supabase';
import { fileNameOf } from './storage';

/**
 * Pièce jointe d'un email proposé par l'assistant IA. Clé « source:id », mêmes
 * sources que l'Edge Function (supabase/functions/_shared/agent/pieces_jointes.ts) :
 * piece (dossier_pieces), coffre (contact_documents), document (espace documentaire).
 */
export type PieceJointeIA = { cle: string; nom: string; origine: string };

const extensionDe = (valeur: string) => fileNameOf(valeur).match(/\.[A-Za-z0-9]{1,5}$/)?.[0] ?? '';
const nomFichier = (libelle: string, valeur: string) => {
  const ext = extensionDe(valeur);
  return ext && !libelle.toLowerCase().endsWith(ext.toLowerCase()) ? `${libelle}${ext}` : libelle;
};

/** Pièces jointes déjà retenues dans les arguments d'une proposition. */
export function piecesDeArgs(args: Record<string, unknown> | null | undefined): PieceJointeIA[] {
  const v = args?.pieces_jointes;
  if (!Array.isArray(v)) return [];
  return v.filter((p): p is PieceJointeIA => !!p && typeof p === 'object' && typeof (p as PieceJointeIA).cle === 'string');
}

/**
 * Fichiers joignables pour l'ajout manuel : pièces des dossiers du contact (ou
 * du dossier lié), coffre-fort du contact, espace documentaire. Sans contact
 * connu, on le retrouve par l'adresse du destinataire.
 */
export async function candidatsPiecesJointes(args: Record<string, unknown>): Promise<PieceJointeIA[]> {
  let contactId = typeof args.contact_id === 'string' ? args.contact_id : null;
  const dossierId = typeof args.dossier_id === 'string' ? args.dossier_id : null;
  const dest = typeof args.destinataire === 'string' ? args.destinataire.split(',')[0].trim() : '';
  if (!contactId && dest) {
    const { data } = await supabase.from('contacts').select('id').ilike('email', dest).limit(1).maybeSingle();
    contactId = data?.id ?? null;
  }
  const dossierIds = new Set<string>(dossierId ? [dossierId] : []);
  if (contactId) {
    const { data } = await supabase.from('dossiers').select('id').eq('contact_id', contactId);
    for (const d of data ?? []) dossierIds.add(d.id);
  }
  const [pieces, coffre, docs] = await Promise.all([
    dossierIds.size
      ? supabase.from('dossier_pieces').select('id, libelle, fichier_url, dossiers(reference)')
        .in('dossier_id', [...dossierIds]).not('fichier_url', 'is', null)
      : Promise.resolve({ data: [] }),
    contactId
      ? supabase.from('contact_documents').select('id, titre, fichier_url').eq('contact_id', contactId).not('fichier_url', 'is', null)
      : Promise.resolve({ data: [] }),
    supabase.from('documents').select('id, titre, categorie, fichier_url').not('fichier_url', 'is', null)
      .order('created_at', { ascending: false }).limit(60),
  ]);
  type Ligne = Record<string, unknown>;
  return [
    ...((pieces.data ?? []) as Ligne[]).map((p) => ({
      cle: `piece:${p.id}`, nom: nomFichier(String(p.libelle), String(p.fichier_url)),
      origine: `Dossier ${(p.dossiers as { reference?: string } | null)?.reference ?? ''}`.trim(),
    })),
    ...((coffre.data ?? []) as Ligne[]).map((d) => ({
      cle: `coffre:${d.id}`, nom: nomFichier(String(d.titre), String(d.fichier_url)), origine: 'Coffre-fort du contact',
    })),
    ...((docs.data ?? []) as Ligne[]).map((d) => ({
      cle: `document:${d.id}`, nom: nomFichier(String(d.titre), String(d.fichier_url)),
      origine: `Espace documentaire${d.categorie ? ` · ${d.categorie}` : ''}`,
    })),
  ];
}
