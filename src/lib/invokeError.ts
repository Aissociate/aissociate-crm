/**
 * Extrait le vrai motif d'une erreur d'Edge Function.
 *
 * `supabase.functions.invoke()` ne renvoie qu'un message générique sur une
 * réponse non-2xx (« Edge Function returned a non-2xx status code »). Le motif
 * réel (clé OpenRouter invalide → 401, modèle inconnu → 502, non déployée…) est
 * dans le corps de la réponse, exposé via `error.context` (un objet Response).
 */
export async function functionErrorMessage(error: unknown, fallback = 'Erreur'): Promise<string> {
  let detail = (error as { message?: string } | null)?.message ?? fallback;
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.text === 'function') {
    try {
      const body = (await ctx.text()).trim();
      if (body) {
        try {
          const parsed = JSON.parse(body);
          detail = parsed?.error ?? parsed?.message ?? body.slice(0, 400);
        } catch {
          detail = body.slice(0, 400); // corps non-JSON : on montre le texte brut
        }
      }
    } catch { /* lecture du corps impossible : on garde le message générique */ }
  }
  return detail;
}
