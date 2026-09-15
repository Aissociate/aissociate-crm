// Edge Function PUBLIQUE — test de positionnement via un lien tokenisé.
// L'apprenant n'a pas de compte et n'existe pas forcément en base : c'est le
// TOKEN qui fait foi. La fonction utilise la clé service role (jamais exposée)
// pour lire/écrire malgré la RLS, en ne donnant accès qu'à ce que le token
// désigne. verify_jwt reste actif comme sur les autres fonctions publiques du
// CRM : le navigateur envoie la clé anon du projet, ce qui écarte les appels
// hors application sans jamais exiger de compte utilisateur.
//   action 'get'    → contexte du lien (libellé, destinataire, formation)
//   action 'submit' → enregistre une réponse rattachée au lien
//
// Note sur le score : il est calculé côté client et transmis ici, mais les
// RÉPONSES BRUTES sont stockées avec lui. Un positionnement est déclaratif et
// sans enjeu de note — le questionnaire le dit explicitement à l'apprenant —
// et conserver le brut permet de tout recalculer si le barème évolue.
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const urlToken = new URL(req.url).searchParams.get("token");
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action ?? "get";
    const token = body.token ?? urlToken;
    if (!token) return json({ error: "Token manquant" }, 400);

    const { data: lien } = await sb.from("positionnement_liens")
      .select("id, libelle, destinataire_nom, destinataire_email, formation_intitule, multi, actif, statut, contact_id, dossier_id, session_id")
      .eq("token", token).maybeSingle();
    if (!lien) return json({ error: "Lien invalide ou expiré" }, 404);
    if (!lien.actif) return json({ error: "Ce lien a été clos par l'organisme de formation." }, 403);

    // Un lien nominatif n'attend qu'une réponse ; un lien de groupe en accepte
    // autant qu'il y a d'apprenants.
    const { count } = await sb.from("positionnements")
      .select("id", { count: "exact", head: true }).eq("lien_id", lien.id);
    const dejaRepondu = !lien.multi && (count ?? 0) > 0;

    if (action === "get") {
      return json({
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
      const score = body.score ?? null;
      const champs = (reponses?.champs ?? {}) as Record<string, unknown>;

      const nom = txt(champs.nom, 160) ?? lien.destinataire_nom ?? "";
      if (!nom) return json({ error: "Le nom est obligatoire." }, 400);
      const email = txt(champs.email, 200) ?? lien.destinataire_email;

      const pct = typeof score?.pct === "number" ? Math.max(0, Math.min(100, Math.round(score.pct))) : null;

      const { error } = await sb.from("positionnements").insert({
        lien_id: lien.id,
        contact_id: lien.contact_id,
        dossier_id: lien.dossier_id,
        session_id: lien.session_id,
        nom,
        email,
        organisation: txt(champs.orga, 200),
        poste: txt(champs.poste, 200),
        secteur: txt(champs.secteur, 120),
        formation_intitule: txt(champs.formation, 200) ?? lien.formation_intitule,
        origine: "apprenant",
        reponses,
        score,
        niveau: txt(score?.niveau, 40),
        pct,
        synthese: typeof body.synthese === "string" ? body.synthese.slice(0, 40000) : null,
        completed_at: new Date().toISOString(),
      });
      if (error) return json({ error: error.message }, 500);

      // Un lien de groupe reste ouvert : d'autres apprenants doivent pouvoir
      // répondre après le premier.
      if (!lien.multi) {
        await sb.from("positionnement_liens").update({ statut: "complete" }).eq("id", lien.id);
      } else if (lien.statut === "a_envoyer") {
        await sb.from("positionnement_liens").update({ statut: "envoye" }).eq("id", lien.id);
      }

      return json({ ok: true });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur serveur" }, 500);
  }
});
