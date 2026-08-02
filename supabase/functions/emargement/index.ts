// Edge Function PUBLIQUE — émargement par demi-journée.
// verify_jwt=false : le stagiaire n'a pas de compte.
//
// Particularité voulue : le code reste valable plusieurs jours (7 par défaut,
// réglable dans Paramètres). En formation, les stagiaires n'ont pas toujours
// accès à leur messagerie sur le créneau lui-même — ils régularisent ensuite,
// en cochant les demi-journées réellement suivies. Le repli déclaratif (le
// formateur atteste à leur place, avec motif) se pilote depuis le CRM.
//
//   action 'get'  → session, participant, demi-journées émargeables et leur état
//   action 'code' → génère et envoie le code
//   action 'sign' → vérifie le code puis enregistre les demi-journées cochées
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const esc = (s: unknown) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));

const MAX_TENTATIVES = 8;      // plus permissif : la saisie est différée
const VALIDITE_JOURS_DEFAUT = 7;

async function sha256(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const hashCode = (token: string, code: string) => sha256(`${token}:${code}`);
const genCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "inconnue";
}
const LIB_DEMI: Record<string, string> = { matin: "Matin", apres_midi: "Après-midi" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE);

  try {
    const urlToken = new URL(req.url).searchParams.get("token");
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = body.action ?? "get";
    const token: string | undefined = body.token ?? urlToken ?? undefined;
    if (!token) return json({ error: "Lien invalide." }, 400);

    const { data: acces } = await sb.from("emargement_acces").select("*").eq("token", token).maybeSingle();
    if (!acces) return json({ error: "Lien invalide ou émargement supprimé." }, 404);

    const { data: cfgRow } = await sb.from("parametres").select("valeur").eq("cle", "emargement").maybeSingle();
    const validiteJours = Number((cfgRow?.valeur as { code_validite_jours?: number } | null)?.code_validite_jours
      ?? VALIDITE_JOURS_DEFAUT);

    const [{ data: session }, { data: participant }] = await Promise.all([
      sb.from("sessions_formation").select("titre, date_debut, date_fin, lieu, modalite, formateur")
        .eq("id", acces.session_id).maybeSingle(),
      sb.from("session_participants").select("nom, prenom, email").eq("id", acces.participant_id).maybeSingle(),
    ]);
    if (!participant) return json({ error: "Participant introuvable." }, 404);

    const { data: creneaux } = await sb.from("emargement_creneaux")
      .select("id, date, demi_journee, heures").eq("session_id", acces.session_id)
      .order("date").order("demi_journee");
    const { data: deja } = await sb.from("emargement_signatures")
      .select("creneau_id, statut, mode, signe_at, motif").eq("participant_id", acces.participant_id);
    const parCreneau = new Map((deja ?? []).map((s) => [s.creneau_id, s]));

    // Seules les demi-journées écoulées sont émargeables : on ne signe pas
    // une présence à venir.
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const liste = (creneaux ?? []).map((c) => ({
      id: c.id,
      date: c.date,
      demi_journee: c.demi_journee,
      libelle: `${new Date(`${c.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} — ${LIB_DEMI[c.demi_journee] ?? c.demi_journee}`,
      heures: Number(c.heures),
      echu: c.date <= aujourdhui,
      signature: parCreneau.get(c.id) ?? null,
    }));

    const expire = new Date(acces.expire_at).getTime() < Date.now();
    const codeValide = Boolean(acces.code_expire_at) && new Date(acces.code_expire_at).getTime() > Date.now();
    const etat = {
      session: session
        ? { titre: session.titre, lieu: session.lieu, modalite: session.modalite, formateur: session.formateur }
        : null,
      participant: { nom: participant.nom, prenom: participant.prenom },
      email_masque: String(participant.email ?? "").replace(/^(.).*(@.*)$/, "$1•••$2"),
      creneaux: liste,
      expire,
      code_actif: codeValide,
      code_expire_at: acces.code_expire_at,
      validite_jours: validiteJours,
    };

    if (action === "get") return json(etat);
    if (expire) return json({ ...etat, error: "Cet émargement est clôturé. Rapprochez-vous de votre formateur." }, 410);

    // ── Envoi du code, valable plusieurs jours ──
    if (action === "code") {
      if (!participant.email) return json({ error: "Aucune adresse e-mail n'est enregistrée pour vous." }, 400);
      const code = genCode();
      const expireLe = new Date(Date.now() + validiteJours * 86_400_000);
      const { error } = await sb.from("emargement_acces").update({
        code_hash: await hashCode(token, code),
        code_envoye_at: new Date().toISOString(),
        code_expire_at: expireLe.toISOString(),
        tentatives: 0,
      }).eq("id", acces.id);
      if (error) return json({ error: error.message }, 500);

      const html = `
        <p>Bonjour ${esc(participant.prenom ?? participant.nom)},</p>
        <p>Voici votre code d'émargement pour la formation «&nbsp;<strong>${esc(session?.titre ?? "")}</strong>&nbsp;» :</p>
        <p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:20px 0">${code}</p>
        <p>Ce code reste valable <strong>${validiteJours} jours</strong> : vous pouvez émarger les demi-journées
        suivies même après coup, si vous n'avez pas eu accès à votre messagerie pendant la formation.</p>
        <p style="color:#64748b;font-size:13px">Conservez ce message jusqu'à la fin de votre formation.</p>
        <p>L'équipe Aissociate</p>`;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE}` },
        body: JSON.stringify({ to: participant.email, subject: `Code d'émargement — ${session?.titre ?? "formation"}`, html }),
      });
      if (!r.ok) return json({ error: "Envoi du code impossible. Vérifiez la configuration SMTP." }, 502);
      return json({ ...etat, code_actif: true, code_expire_at: expireLe.toISOString() });
    }

    // ── Enregistrement des demi-journées cochées ──
    if (action === "sign") {
      const code = String(body.code ?? "").trim();
      const choix = Array.isArray(body.creneaux) ? (body.creneaux as string[]) : [];
      if (!code) return json({ error: "Saisissez le code reçu par e-mail." }, 400);
      if (choix.length === 0) return json({ error: "Cochez au moins une demi-journée." }, 400);
      if (!acces.code_hash) return json({ error: "Demandez d'abord l'envoi du code." }, 400);
      if (acces.tentatives >= MAX_TENTATIVES) return json({ error: "Trop de tentatives. Demandez un nouveau code." }, 429);
      if (acces.code_expire_at && new Date(acces.code_expire_at).getTime() < Date.now()) {
        return json({ error: "Code expiré. Demandez-en un nouveau." }, 410);
      }
      if ((await hashCode(token, code)) !== acces.code_hash) {
        await sb.from("emargement_acces").update({ tentatives: acces.tentatives + 1 }).eq("id", acces.id);
        const reste = MAX_TENTATIVES - acces.tentatives - 1;
        return json({ error: `Code incorrect. ${reste > 0 ? `${reste} tentative(s) restante(s).` : "Demandez un nouveau code."}` }, 400);
      }

      // On n'accepte que des créneaux de cette session, échus et non déjà signés.
      const autorises = new Set(liste.filter((c) => c.echu && !c.signature).map((c) => c.id));
      const retenus = choix.filter((id) => autorises.has(id));
      if (retenus.length === 0) {
        return json({ error: "Ces demi-journées sont déjà émargées ou ne sont pas encore échues." }, 409);
      }

      const ip = clientIp(req);
      const ua = req.headers.get("user-agent") ?? "inconnu";
      const maintenant = new Date().toISOString();
      const { error: insErr } = await sb.from("emargement_signatures").insert(
        retenus.map((creneau_id) => ({
          creneau_id, participant_id: acces.participant_id,
          statut: "present", mode: "code",
          signe_at: maintenant, code_at: maintenant,
          ip, user_agent: ua,
        })),
      );
      if (insErr) return json({ error: insErr.message }, 500);

      return json({ ok: true, enregistrees: retenus.length });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
