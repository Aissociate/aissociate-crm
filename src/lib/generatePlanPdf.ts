import { supabase } from './supabase';
import { functionErrorMessage } from './invokeError';

interface GenInput {
  planId: string | null;
  contexte: Record<string, unknown>; // données du plan envoyées à l'IA
  apprenant: string;
  organismePartenaire: string;
  userId: string | null;
  // Références pour rassembler le contexte client complet côté serveur.
  contactId?: string | null;
  entrepriseId?: string | null;
  financeurId?: string | null;
}

/**
 * Demande la génération du plan en PDF. Tout est fait côté serveur par
 * l'Edge Function `generate-plan` : appel OpenRouter, rendu PDF (pdf-lib),
 * upload dans le bucket privé `plans` et enregistrement. Le navigateur n'a
 * aucune dépendance PDF et la clé API n'est jamais exposée.
 */
export async function generatePlanPdf(input: GenInput): Promise<{ titre: string }> {
  const { data, error } = await supabase.functions.invoke('generate-plan', {
    body: {
      plan: input.contexte,
      meta: {
        planId: input.planId,
        apprenant: input.apprenant,
        organismePartenaire: input.organismePartenaire,
        userId: input.userId,
        contactId: input.contactId ?? null,
        entrepriseId: input.entrepriseId ?? null,
        financeurId: input.financeurId ?? null,
      },
    },
  });
  if (error) {
    const msg = await functionErrorMessage(error, '');
    throw new Error(
      "Génération indisponible : déployez l'Edge Function « generate-plan » et configurez la clé OpenRouter (Paramètres > IA). " + msg,
    );
  }
  const res = data as { ok?: boolean; titre?: string; error?: string };
  if (res?.error) throw new Error(res.error);
  return { titre: res?.titre ?? 'Plan de formation' };
}
