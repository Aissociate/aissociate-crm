// Edge Function — envoi AUTOMATIQUE des questionnaires Qualiopi (cron quotidien).
//
// Garde-fous :
//   - piloté par le paramètre `qualiopi_auto` : { enabled, depuis, site_url }.
//     enabled=false => ne fait rien. depuis = date plancher : SEULES les sessions
//     dont date_debut >= depuis sont concernées (protège les sessions passées).
//   - fenêtres d'envoi : positionnement ~J-3 avant le début ; à chaud dès la fin ;
//     à froid à J+90 de la fin. Relance unique 7 jours après un envoi sans réponse.
//   - évaluations par lien (`evaluation_liens`) : envoyées à leur échéance
//     `envoi_prevu_le` (froid = fin de formation + 30 jours).
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

    // ── Évaluations par lien (/evaluation/:token) arrivées à échéance ──────────
    // Typiquement le froid à J+30 de la fin. Liens nominatifs seulement ; même
    // garde-fou `depuis`, appliqué à la date de fin de formation.
    const today = new Date(now).toISOString().slice(0, 10);
    const { data: echus } = await sb.from("evaluation_liens")
      .select("id, type, token, libelle, destinataire_nom, destinataire_email, contact_id, dossier_id, date_fin_formation")
      .eq("statut", "a_envoyer").eq("actif", true).eq("multi", false)
      .not("destinataire_email", "is", null).lte("envoi_prevu_le", today);
    let evalSent = 0;
    for (const l of echus ?? []) {
      if (depuis && (!l.date_fin_formation || new Date(l.date_fin_formation).getTime() < depuis)) { skipped++; continue; }
      try {
        const link = `${site}/evaluation/${l.token}`;
        // Même texte que messageInvitation() (src/lib/evaluation.ts).
        const intro = l.type === "chaud"
          ? "Merci d'avoir participé à la formation. Pourriez-vous prendre 5 minutes pour nous dire ce que vous en avez pensé ? Vos réponses nous servent directement à améliorer nos formations."
          : "Il y a environ un mois, vous suiviez votre formation. Où en êtes-vous ? Ce court questionnaire (5 minutes) nous permet de mesurer ce que la formation vous a réellement apporté au quotidien.";
        const bouton = l.type === "chaud" ? "Donner mon avis" : "Répondre au questionnaire";
        const texte = [`Bonjour ${l.destinataire_nom ?? ""},`, "", intro, "", `${bouton} : ${link}`, "", "Merci,", "L'équipe Aissociate"].join("\n");
        const html = `
          <p>Bonjour ${l.destinataire_nom ?? ""},</p>
          <p>${intro}</p>
          <p><a href="${link}" style="background:#ea6a1e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${bouton}</a></p>
          <p>Ou copiez ce lien : ${link}</p>
          <p>Merci,<br/>L'équipe Aissociate</p>`;
        const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE}` },
          body: JSON.stringify({ to: l.destinataire_email, subject: l.libelle, html, text: texte }),
        });
        if (!r.ok) throw new Error(`send-email ${r.status}`);
        const envoyeLe = new Date().toISOString();
        await sb.from("evaluation_liens").update({ statut: "envoye", sent_at: envoyeLe }).eq("id", l.id);
        // Trace en Messagerie, comme un envoi depuis le CRM.
        await sb.from("emails").insert({
          destinataires: [l.destinataire_email], copie: [], sujet: l.libelle, corps: texte,
          statut: "envoye", canal: "email", direction: "sortant",
          contact_id: l.contact_id, dossier_id: l.dossier_id, sent_at: envoyeLe, attachments: [],
        });
        evalSent++;
      } catch (_e) { skipped++; }
    }

    return json({ ok: true, sent, relanced, evaluations: evalSent, skipped });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur serveur" }, 500);
  }
});
