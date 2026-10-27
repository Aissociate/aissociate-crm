// Edge Function — suppression d'un utilisateur du back office (Administration).
// Réservée aux admins (vérifié sur le profil de l'appelant). Supprime le compte
// auth.users, ce qui supprime le profil en cascade ; les enregistrements dont il
// était propriétaire passent à « non attribué » (FK ON DELETE SET NULL), sauf
// s'ils sont d'abord réattribués à un autre utilisateur (reassign_to).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Colonnes « portefeuille » transférées au repreneur.
const REATTRIBUABLES: [string, string][] = [
  ["entreprises", "owner_id"], ["contacts", "owner_id"], ["contacts", "responsable_id"],
  ["opportunites", "owner_id"], ["plans_formation", "owner_id"], ["dossiers", "owner_id"],
  ["documents", "owner_id"], ["devis", "owner_id"], ["factures", "owner_id"],
  ["emails", "owner_id"], ["kanban_boards", "owner_id"], ["kanban_cartes", "assignee_id"],
  ["offres_recrutement", "owner_id"], ["questionnaire_envois", "owner_id"],
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json({ error: "Non authentifié" }, 401);
    const { data: moi } = await sb.from("profiles").select("role, actif").eq("id", user.id).maybeSingle();
    if (moi?.role !== "admin" || !moi.actif) return json({ error: "Réservé aux administrateurs" }, 403);

    const { action, user_id, reassign_to } = await req.json();
    if (action !== "delete" || !user_id) return json({ error: "Requête invalide" }, 400);
    if (user_id === user.id) return json({ error: "Impossible de supprimer votre propre compte" }, 400);

    const { data: cible } = await sb.from("profiles").select("id, email, prenom, nom, role").eq("id", user_id).maybeSingle();
    if (!cible) return json({ error: "Utilisateur introuvable" }, 404);
    if (cible.role === "admin") {
      const { count } = await sb.from("profiles").select("id", { count: "exact", head: true })
        .eq("role", "admin").eq("actif", true).neq("id", user_id);
      if (!count) return json({ error: "Impossible de supprimer le dernier administrateur actif" }, 400);
    }

    let reattribues = 0;
    if (reassign_to) {
      if (reassign_to === user_id) return json({ error: "Le repreneur doit être un autre utilisateur" }, 400);
      const { data: rep } = await sb.from("profiles").select("id").eq("id", reassign_to).maybeSingle();
      if (!rep) return json({ error: "Repreneur introuvable" }, 404);
      for (const [table, col] of REATTRIBUABLES) {
        const { count, error } = await sb.from(table).update({ [col]: reassign_to }, { count: "exact" }).eq(col, user_id);
        if (error) throw new Error(`Réattribution ${table}.${col} : ${error.message}`);
        reattribues += count ?? 0;
      }
    }

    // Trace avant suppression (audit_log.user_id = auteur de l'action).
    await sb.from("audit_log").insert({
      user_id: user.id, action: "suppression_utilisateur", entite: "profiles", entite_id: user_id,
      details: { email: cible.email, nom: `${cible.prenom ?? ""} ${cible.nom ?? ""}`.trim(), reassign_to: reassign_to ?? null, reattribues },
    }).then(() => {}, () => {});

    const { error } = await sb.auth.admin.deleteUser(user_id);
    if (error) throw new Error(error.message);
    return json({ ok: true, reattribues });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
