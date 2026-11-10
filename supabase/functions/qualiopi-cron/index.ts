// Edge Function — envoi AUTOMATIQUE des évaluations de formation (cron quotidien).
//
// Un seul système de questionnaires : les liens `evaluation_liens`
// (/evaluation/:token). L'ancien système `questionnaire_envois` (/q/:token),
// jamais utilisé, n'est plus servi.
//
// Garde-fous :
//   - piloté par le paramètre `qualiopi_auto` : { enabled, depuis, site_url }.
//     enabled=false => ne fait rien. depuis = date plancher : SEULES les sessions
//     dont date_debut >= depuis sont concernées (protège les sessions passées).
//   - à la fin d'une session, chaque participant ayant un e-mail reçoit un lien
//     « à chaud » (échéance : le jour même) et un lien « à froid » (échéance :
//     fin de formation + 30 jours). Jamais deux liens du même type pour la même
//     personne et la même session ; rien si elle a déjà répondu.
//   - les liens arrivés à échéance (`envoi_prevu_le`) partent par e-mail, y
//     compris ceux programmés à la main depuis le dossier client.
//
// L'e-mail part via la fonction `send-email` (config SMTP existante). Chaque
// passage est journalisé dans `job_runs` (« Santé des jobs »).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

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
const DELAI_FROID_JOURS = 30; // même valeur que src/lib/evaluation.ts
const LIBELLES: Record<string, string> = {
  chaud: "Évaluation de fin de formation",
  froid: "Votre formation, un mois après",
};
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function logRun(sb: SupabaseClient, startedAt: string, ok: boolean, message: string, detail?: unknown) {
  try {
    await sb.from("job_runs").insert({
      fonction: "qualiopi-cron", started_at: startedAt, finished_at: new Date().toISOString(),
      ok, message, detail: detail ?? null,
    });
  } catch { /* le journal ne doit jamais faire échouer le job */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const startedAt = new Date().toISOString();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE);

  try {
    const { data: cfgRow } = await sb.from("parametres").select("valeur").eq("cle", "qualiopi_auto").maybeSingle();
    const cfg = (cfgRow?.valeur ?? {}) as { enabled?: boolean; depuis?: string; site_url?: string };
    if (!cfg.enabled) {
      await logRun(sb, startedAt, true, "désactivé (parametres.qualiopi_auto.enabled=false)");
      return json({ ok: true, skipped: "desactive (parametres.qualiopi_auto.enabled=false)" });
    }

    const site = (cfg.site_url || "https://aissociate.re").replace(/\/+$/, "");
    const depuis = cfg.depuis ? new Date(cfg.depuis).getTime() : 0;
    const now = Date.now();
    const today = ymd(now);
    let skipped = 0;

    // ── 1. Sessions terminées : un lien à chaud et un lien à froid par participant ──
    const [{ data: sessions }, { data: participants }, { data: liensExistants }, { data: reponses }] = await Promise.all([
      sb.from("sessions_formation").select("id, titre, date_debut, date_fin"),
      sb.from("session_participants").select("id, session_id, contact_id, nom, prenom, email"),
      sb.from("evaluation_liens").select("type, contact_id, destinataire_email, session_id, date_fin_formation").eq("multi", false),
      sb.from("evaluations").select("type, contact_id, email, session_id"),
    ]);
    const memePersonne = (
      x: { contact_id?: string | null; email?: string | null },
      p: { contact_id?: string | null; email?: string | null },
    ) => (!!p.contact_id && x.contact_id === p.contact_id)
      || (!!p.email && !!x.email && x.email.toLowerCase() === p.email.toLowerCase());

    let provisionnes = 0;
    for (const s of sessions ?? []) {
      const debut = new Date(s.date_debut as string).getTime();
      const fin = new Date((s.date_fin as string) || (s.date_debut as string)).getTime();
      if (Number.isNaN(debut) || Number.isNaN(fin)) continue;
      if (debut < depuis || fin > now) continue;            // garde-fou + session terminée seulement
      const finYmd = ymd(fin);
      for (const p of (participants ?? []).filter((x) => x.session_id === s.id)) {
        if (!p.email) { skipped++; continue; }
        for (const type of ["chaud", "froid"]) {
          const dejaLien = (liensExistants ?? []).some((l) => l.type === type
            && memePersonne({ contact_id: l.contact_id, email: l.destinataire_email }, p)
            && (l.session_id === s.id || l.date_fin_formation === finYmd));
          const dejaRepondu = (reponses ?? []).some((e) => e.type === type
            && memePersonne(e, p) && (!e.session_id || e.session_id === s.id));
          if (dejaLien || dejaRepondu) continue;
          const { error } = await sb.from("evaluation_liens").insert({
            type, libelle: LIBELLES[type],
            contact_id: p.contact_id, session_id: s.id,
            destinataire_nom: [p.prenom, p.nom].filter(Boolean).join(" ").trim() || p.nom,
            destinataire_email: p.email,
            formation_intitule: s.titre, date_fin_formation: finYmd,
            envoi_prevu_le: type === "chaud" ? today : ymd(fin + DELAI_FROID_JOURS * DAY),
          });
          if (error) skipped++; else provisionnes++;
        }
      }
    }

    // ── 2. Liens arrivés à échéance : envoi par e-mail ──
    const { data: echus } = await sb.from("evaluation_liens")
      .select("id, type, token, libelle, destinataire_nom, destinataire_email, contact_id, dossier_id, date_fin_formation")
      .eq("statut", "a_envoyer").eq("actif", true).eq("multi", false)
      .not("destinataire_email", "is", null).lte("envoi_prevu_le", today);
    let envoyes = 0;
    const erreurs: string[] = [];
    for (const l of echus ?? []) {
      if (depuis && (!l.date_fin_formation || new Date(l.date_fin_formation).getTime() < depuis - DAY)) { skipped++; continue; }
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
        envoyes++;
      } catch (e) {
        erreurs.push(e instanceof Error ? e.message : String(e));
      }
    }

    const bilan = { provisionnes, envoyes, skipped, erreurs: erreurs.length };
    await logRun(sb, startedAt, erreurs.length === 0,
      `${provisionnes} lien(s) créé(s), ${envoyes} évaluation(s) envoyée(s)${erreurs.length ? `, ${erreurs.length} échec(s)` : ""}`,
      { ...bilan, exemples: erreurs.slice(0, 3) });
    return json({ ok: true, ...bilan });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    await logRun(sb, startedAt, false, message);
    return json({ error: message }, 500);
  }
});
