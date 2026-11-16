// Lecture du flux SSE d'OpenRouter avec appels de fonctions — partie PURE (testée).
//
// En flux, un appel d'outil arrive en morceaux : `delta.tool_calls[i]` porte
// l'id et le nom au premier fragment, puis les arguments JSON par bouts. On les
// recolle par `index`.

export type AppelOutil = { id: string; type: "function"; function: { name: string; arguments: string } };
export type FragmentAppel = { index?: number; id?: string; function?: { name?: string; arguments?: string } };

export function accumulerAppels(acc: AppelOutil[], fragments: FragmentAppel[] | undefined): AppelOutil[] {
  for (const f of fragments ?? []) {
    const i = f.index ?? acc.length;
    const a = acc[i] ??= { id: "", type: "function", function: { name: "", arguments: "" } };
    if (f.id) a.id = f.id;
    if (f.function?.name) a.function.name += f.function.name;
    if (f.function?.arguments) a.function.arguments += f.function.arguments;
  }
  return acc;
}

/** Appels complets (nom présent), avec un id de secours si le fournisseur n'en donne pas. */
export const appelsValides = (acc: AppelOutil[]) =>
  acc.filter(Boolean).filter((a) => a.function.name).map((a, k) => ({ ...a, id: a.id || `appel_${k}` }));

/** Le modèle choisi ne sait pas appeler d'outils : on relance sans. */
export const refusOutils = (statut: number, message: string) =>
  (statut === 404 || statut === 400) && /tool|function/i.test(message);

export type Usage = { cost?: number; prompt_tokens?: number; completion_tokens?: number };
export function cumulerUsage(total: Usage, u?: Usage | null): Usage {
  if (!u) return total;
  return {
    cost: (total.cost ?? 0) + (u.cost ?? 0),
    prompt_tokens: (total.prompt_tokens ?? 0) + (u.prompt_tokens ?? 0),
    completion_tokens: (total.completion_tokens ?? 0) + (u.completion_tokens ?? 0),
  };
}
