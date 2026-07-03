// Edge Function — envoi AUTOMATIQUE des questionnaires Qualiopi (cron quotidien).
//
// Garde-fous :
//   - piloté par le paramètre `qualiopi_auto` : { enabled, depuis, site_url }.
//     enabled=false => ne fait rien. depuis = date plancher : SEULES les sessions
//     dont date_debut >= depuis sont concernées (protège les sessions passées).
//   - fenêtres d'envoi : positionnement ~J-3 avant le début ; à chaud dès la fin ;
//     à froid à J+90 de la fin. Relance unique 7 jours après un envoi sans réponse.
//
// L'e-mail part via la fonction `send-email` (config SMTP existante).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const DAY = 86400000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE);

  try {
    const { data: cfgRow } = await sb.from("parametres").select("valeur").eq("cle", "qualiopi_auto").maybeSingle();
    const cfg = (cfgRow?.valeur ?? {}) as { enabled?: boolean; depuis?: string; site_url?: string };
    if (!cfg.enabled) return json({ ok: true, skipped: "desactive (parametres.qualiopi_auto.enabled=false)" });

    const site = (cfg.site_url || "https://aissociate.re").replace(/\/+$/, "");
    const depuis = cfg.depuis ? new Date(cfg.depuis).getTime() : 0;
    const now = Date.now();

    const [envoisR, sessionsR, modelesR] = await Promise.all([
      sb.from("questionnaire_envois").select("*").in("statut", ["a_envoyer", "envoye"]),
      sb.from("sessions_formation").select("id, date_debut, date_fin, titre"),
      sb.from("questionnaire_modeles").select("code, titre, moment"),
    ]);
    const sessions = new Map((sessionsR.data ?? []).map((s: Record<string, unknown>) => [s.id, s]));
    const modeles = new Map((modelesR.data ?? []).map((m: Record<string, unknown>) => [m.code, m]));

    const startMs = (s: Record<string, unknown>) => new Date(s.date_debut as string).getTime();
    const endMs = (s: Record<string, unknown>) => new Date((s.date_fin as string) || (s.date_debut as string)).getTime();

    const sendMail = async (envoi: Record<string, unknown>, modele: Record<string, unknown>, relance: boolean) => {
      const link = `${site}/q/${envoi.token}`;
      const html = `
        <p>Bonjour ${envoi.destinataire_nom ?? ""},</p>
        <p>${relance ? "Petit rappel : merci de" : "Merci de"} prendre quelques minutes pour répondre au questionnaire
        « <strong>${modele.titre}</strong> ».</p>
        <p><a href="${link}" style="background:#ea6a1e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Répondre au questionnaire</a></p>
        <p>Ou copiez ce lien : ${link}</p>
        <p>Merci,<br/>L'équipe Aissociate</p>`;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE}` },
        body: JSON.stringify({ to: envoi.destinataire_email, subject: modele.titre, html }),
      });
      if (!r.ok) throw new Error(`send-email ${r.status}`);
      await sb.from("questionnaire_envois").update({
        statut: relance ? "relance" : "envoye",
        sent_at: new Date().toISOString(),
        relance_at: relance ? null : new Date(now + 7 * DAY).toISOString(),
      }).eq("id", envoi.id);
    };

    let sent = 0, relanced = 0, skipped = 0;

    for (const envoi of envoisR.data ?? []) {
      const s = envoi.session_id ? sessions.get(envoi.session_id) : null;
      const m = modeles.get(envoi.modele_code);
      if (!s || !m || !envoi.destinataire_email) { skipped++; continue; }
      if (startMs(s) < depuis) { skipped++; continue; }               // garde-fou sessions passées

      try {
        if (envoi.statut === "a_envoyer") {
          const moment = m.moment;
          let due = false;
          if (moment === "debut") due = startMs(s) <= now + 3 * DAY;
          else if (moment === "fin") due = endMs(s) <= now;
          else if (moment === "froid") due = endMs(s) + 90 * DAY <= now;
          if (due) { await sendMail(envoi, m, false); sent++; } else skipped++;
        } else if (envoi.statut === "envoye" && !envoi.responded_at && envoi.relance_at && new Date(envoi.relance_at).getTime() <= now) {
          await sendMail(envoi, m, true); relanced++;
        } else skipped++;
      } catch (_e) { skipped++; }
    }

    return json({ ok: true, sent, relanced, skipped });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur serveur" }, 500);
  }
});
