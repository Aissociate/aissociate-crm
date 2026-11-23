// En-têtes CORS et réponse JSON des fonctions serveur.
//
// Chaque fonction recopiait ces dix lignes ; elles vivent ici une seule fois.
//   const corsHeaders = enTetesCors();              // POST, OPTIONS
//   const json = reponseJson(corsHeaders);
//   …
//   if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
//   return json({ ok: true });

/** En-têtes de requête acceptés par défaut (ceux qu'envoie supabase-js). */
export const ENTETES_ACCEPTES = "Content-Type, Authorization, X-Client-Info, Apikey";

/** En-têtes CORS d'une fonction : toutes origines, méthodes et en-têtes au choix. */
export function enTetesCors(methodes = "POST, OPTIONS", entetes = ENTETES_ACCEPTES): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methodes,
    "Access-Control-Allow-Headers": entetes,
  };
}

/** Fabrique `json(corps, statut?, enTetesEnPlus?)` : une réponse JSON portant les en-têtes CORS donnés. */
export function reponseJson(cors: Record<string, string>) {
  return (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", ...extra } });
}
