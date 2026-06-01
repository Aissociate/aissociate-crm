import { supabase } from './supabase';

interface GenInput {
  planId: string | null;
  contexte: Record<string, unknown>; // données envoyées à l'IA
  apprenant: string;
  organismePartenaire: string;
  userId: string | null;
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
      },
    },
  });
  if (error) {
    const msg = (error as { message?: string }).message ?? '';
    throw new Error(
      "Génération indisponible : déployez l'Edge Function « generate-plan » et configurez la clé OpenRouter (Paramètres > IA). " + msg,
    );
  }
  const res = data as { ok?: boolean; titre?: string; error?: string };
  if (res?.error) throw new Error(res.error);
  return { titre: res?.titre ?? 'Plan de formation' };
}
