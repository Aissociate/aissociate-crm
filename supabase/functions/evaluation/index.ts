// Edge Function PUBLIQUE — évaluation de fin de formation (à chaud / à froid)
// via un lien tokenisé. Calquée sur `positionnement` : l'apprenant n'a pas de
// compte et n'existe pas forcément en base, c'est le TOKEN qui fait foi. Clé
// service role côté serveur uniquement ; verify_jwt reste actif (le navigateur
// envoie la clé anon du projet).
//   action 'get'    → contexte du lien (type, libellé, destinataire, formation)
//   action 'submit' → enregistre une réponse rattachée au lien
//
// La note est calculée côté client (src/lib/evaluation.ts) et bornée ici ; les
// RÉPONSES BRUTES sont conservées pour pouvoir la recalculer.
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

const txt = (v: unknown, max = 300): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
};

const borne = (v: unknown, min: number, max: number, decimales = 0): number | null => {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || Number.isNaN(n)) return null;
  const f = 10 ** decimales;
  return Math.round(Math.max(min, Math.min(max, n)) * f) / f;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const urlToken = new URL(req.url).searchParams.get("token");
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action ?? "get";
    const token = body.token ?? urlToken;
    if (!token) return json({ error: "Token manquant" }, 400);

    const { data: lien } = await sb.from("evaluation_liens")
      .select("id, type, libelle, destinataire_nom, destinataire_email, formation_intitule, multi, actif, statut, contact_id, dossier_id, session_id")
      .eq("token", token).maybeSingle();
    if (!lien) return json({ error: "Lien invalide ou expiré" }, 404);
    if (!lien.actif) return json({ error: "Ce lien a été clos par l'organisme de formation." }, 403);

    const { count } = await sb.from("evaluations")
      .select("id", { count: "exact", head: true }).eq("lien_id", lien.id);
    const dejaRepondu = !lien.multi && (count ?? 0) > 0;

    if (action === "get") {
      return json({
        type: lien.type,
        libelle: lien.libelle,
        destinataire: lien.destinataire_nom,
        email: lien.destinataire_email,
        formation: lien.formation_intitule,
        multi: lien.multi,
        dejaRepondu,
      });
    }

    if (action === "submit") {
      if (dejaRepondu) return json({ error: "Ce questionnaire a déjà été complété." }, 409);

      const reponses = body.reponses ?? {};
      const note = body.note ?? {};
      const champs = (reponses?.champs ?? {}) as Record<string, unknown>;

      const nom = txt(champs.nom, 160) ?? lien.destinataire_nom ?? "";
      if (!nom) return json({ error: "Le nom est obligatoire." }, 400);

      const { error } = await sb.from("evaluations").insert({
        type: lien.type,
        lien_id: lien.id,
        contact_id: lien.contact_id,
        dossier_id: lien.dossier_id,
        session_id: lien.session_id,
        nom,
        email: txt(champs.email, 200) ?? lien.destinataire_email,
        organisation: txt(champs.orga, 200),
        poste: txt(champs.poste, 200),
        formation_intitule: txt(champs.formation, 200) ?? lien.formation_intitule,
        origine: "apprenant",
        reponses,
        note_globale: borne(note?.note, 1, 5, 1),
        pct: borne(note?.pct, 0, 100),
        nps: borne(note?.nps, 0, 10),
        synthese: typeof body.synthese === "string" ? body.synthese.slice(0, 40000) : null,
        completed_at: new Date().toISOString(),
      });
      if (error) return json({ error: error.message }, 500);

      // Un lien de groupe reste ouvert aux autres apprenants.
      if (!lien.multi) {
        await sb.from("evaluation_liens").update({ statut: "complete" }).eq("id", lien.id);
      } else if (lien.statut === "a_envoyer") {
        await sb.from("evaluation_liens").update({ statut: "envoye" }).eq("id", lien.id);
      }

      return json({ ok: true });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur serveur" }, 500);
  }
});
