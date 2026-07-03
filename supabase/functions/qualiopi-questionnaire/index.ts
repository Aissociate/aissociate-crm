// Edge Function PUBLIQUE — répondre à un questionnaire via un lien tokenisé.
// verify_jwt=false : accessible aux apprenants sans compte. Utilise la clé
// service role (jamais exposée) pour lire/écrire malgré la RLS.
//   action 'get'    → renvoie le modèle (titre, schéma) + état de l'envoi
//   action 'submit' → enregistre la réponse et marque l'envoi « répondu »
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Note moyenne (échelles 1-5) pour agréger la satisfaction.
function computeNote(schema: { id: string; type: string; echelle?: number }[], reponses: Record<string, unknown>): number | null {
  const vals: number[] = [];
  for (const q of schema) {
    if (q.type === "echelle") {
      const v = Number(reponses[q.id]);
      if (!Number.isNaN(v) && v > 0) vals.push(v);
    }
  }
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // Le token peut arriver en query (GET) ou dans le corps (POST).
    const urlToken = new URL(req.url).searchParams.get("token");
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action ?? (req.method === "GET" ? "get" : "get");
    const token = body.token ?? urlToken;
    if (!token) return json({ error: "Token manquant" }, 400);

    const { data: envoi } = await sb.from("questionnaire_envois")
      .select("id, modele_code, destinataire_nom, statut, session_id")
      .eq("token", token).maybeSingle();
    if (!envoi) return json({ error: "Lien invalide ou expiré" }, 404);

    const { data: modele } = await sb.from("questionnaire_modeles")
      .select("code, titre, description, schema").eq("code", envoi.modele_code).maybeSingle();

    if (action === "get") {
      const { data: existing } = await sb.from("questionnaire_reponses")
        .select("id").eq("envoi_id", envoi.id).maybeSingle();
      return json({
        titre: modele?.titre ?? "Questionnaire",
        description: modele?.description ?? null,
        schema: modele?.schema ?? [],
        destinataire: envoi.destinataire_nom,
        alreadyAnswered: Boolean(existing) || envoi.statut === "repondu",
      });
    }

    if (action === "submit") {
      const reponses = (body.reponses ?? {}) as Record<string, unknown>;
      const schema = (modele?.schema ?? []) as { id: string; type: string; echelle?: number }[];
      const note = computeNote(schema, reponses);

      const { error: upErr } = await sb.from("questionnaire_reponses").upsert({
        envoi_id: envoi.id,
        reponses,
        note_globale: note,
        commentaire: body.commentaire ?? null,
      }, { onConflict: "envoi_id" });
      if (upErr) return json({ error: upErr.message }, 500);

      await sb.from("questionnaire_envois").update({
        statut: "repondu", responded_at: new Date().toISOString(),
      }).eq("id", envoi.id);

      return json({ ok: true });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur serveur" }, 500);
  }
});
