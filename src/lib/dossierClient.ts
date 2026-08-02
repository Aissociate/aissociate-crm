import { supabase } from './supabase';
import { genReference } from './utils';

/**
 * Pièces justificatives générées par défaut à la création d'un dossier
 * (checklist Qualiopi / financeur). Partagé avec la page « Dossiers ».
 */
export const DEFAULT_PIECES = [
  'Devis signé', 'Programme de formation', 'Convention / contrat de formation',
  "Pièce d'identité du bénéficiaire", "Justificatif d'éligibilité", 'Demande de prise en charge',
  // Exigées au remboursement par l'AGEFICE, produites en fin de parcours.
  "Feuille d'émargement", "Attestation d'assiduité",
];

export type DossierRef = { id: string; reference: string; intitule: string };

export interface EnsureDossierInput {
  contactId: string | null | undefined;
  contactName: string;            // « Prénom Nom » du prospect (référence / intitulé)
  formationId?: string | null;    // clé d'unicité : contact + formation
  formationName?: string | null;
  entrepriseId?: string | null;
  financeurId?: string | null;
  ownerId?: string | null;
}

/**
 * Garantit l'existence d'un dossier client « au nom du prospect ».
 *
 * Règle d'unicité : un dossier par couple (contact, formation). Si un dossier
 * correspondant existe déjà, il est réutilisé ; sinon il est créé silencieusement
 * avec sa référence, son intitulé et la checklist de pièces par défaut.
 *
 * Renvoie `null` si aucun contact n'est fourni (impossible de nommer le dossier).
 */
export async function ensureDossierClient(input: EnsureDossierInput): Promise<DossierRef | null> {
  const { contactId } = input;
  if (!contactId) return null;

  // 1) Dossier existant pour ce prospect + cette formation ?
  let q = supabase.from('dossiers').select('id, reference, intitule').eq('contact_id', contactId);
  q = input.formationId ? q.eq('formation_id', input.formationId) : q.is('formation_id', null);
  const { data: existing } = await q.limit(1).maybeSingle();
  if (existing) return existing as DossierRef;

  // 2) Création silencieuse du dossier client.
  const intitule = input.formationName
    ? `${input.contactName} — ${input.formationName}`
    : `Dossier ${input.contactName}`;
  // Suffixe aléatoire court pour éviter toute collision de référence si plusieurs
  // dossiers sont créés dans la même seconde (différents déclencheurs).
  const reference = `${genReference('DOS')}-${Math.random().toString(36).slice(2, 5)}`;

  const { data: created, error } = await supabase.from('dossiers').insert({
    reference,
    intitule,
    contact_id: contactId,
    formation_id: input.formationId ?? null,
    entreprise_id: input.entrepriseId ?? null,
    financeur_id: input.financeurId ?? null,
    statut: 'brouillon',
    owner_id: input.ownerId ?? null,
  }).select('id, reference, intitule').single();

  if (error || !created) return null;

  await supabase.from('dossier_pieces').insert(
    DEFAULT_PIECES.map((libelle) => ({
      dossier_id: created.id, libelle, obligatoire: true, statut: 'manquante' as const,
    })),
  );

  return created as DossierRef;
}
