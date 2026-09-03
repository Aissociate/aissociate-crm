// Edge Function — génération quotidienne des notifications in-app + e-mail de
// synthèse. Appelée par pg_cron (03:00 UTC = 07:00 Réunion) ou manuellement.
//   - Relances du jour (contact_actions non faites, échues) → propriétaire du contact
//   - Devis « envoyé » sans réponse depuis 7 jours → créateur du devis
//   - Factures échues non réglées → créateur + direction
//   - Propositions IA en attente → direction
// Déduplication via notifications.dedupe_key ; journalise dans job_runs.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

type Notif = { user_id: string; type: string; titre: string; corps: string | null; lien: string | null; dedupe_key: string };

async function logRun(sb: SupabaseClient, startedAt: string, ok: boolean, message: string, detail?: unknown) {
  try {
    await sb.from("job_runs").insert({
      fonction: "notifications-cron", started_at: startedAt, finished_at: new Date().toISOString(),
      ok, message, detail: detail ?? null,
    });
  } catch { /* le journal ne doit jamais faire échouer le job */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const startedAt = new Date().toISOString();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const today = new Date().toISOString().slice(0, 10);
    const notifs: Notif[] = [];

    // Utilisateurs actifs (cible des notifications). Direction = admin/directeur.
    const { data: profiles } = await sb.from("profiles")
      .select("id, email, prenom, role, is_admin, actif, approved, statut_conseiller");
    const actifs = (profiles ?? []).filter((p) =>
      p.actif !== false && p.approved !== false &&
      p.statut_conseiller !== "inactif" && p.statut_conseiller !== "ancien");
    const actifIds = new Set(actifs.map((p) => p.id));
    const managers = actifs.filter((p) => p.is_admin || p.role === "admin" || p.role === "directeur_commercial");

    // 1) Relances échues (une notification par jour et par utilisateur).
    const { data: actions } = await sb.from("contact_actions")
      .select("id, contact_id, auteur_id, date_action, contacts(owner_id)")
      .eq("faite", false).lte("date_action", today);
    const parUser = new Map<string, number>();
    for (const a of actions ?? []) {
      const owner = (a.contacts as { owner_id: string | null } | null)?.owner_id ?? a.auteur_id;
      if (!owner || !actifIds.has(owner)) continue;
      parUser.set(owner, (parUser.get(owner) ?? 0) + 1);
    }
    for (const [uid, n] of parUser) {
      notifs.push({
        user_id: uid, type: "relance",
        titre: `${n} action${n > 1 ? "s" : ""} à traiter`,
        corps: `Vous avez ${n} relance${n > 1 ? "s" : ""} planifiée${n > 1 ? "s" : ""} arrivée${n > 1 ? "s" : ""} à échéance.`,
        lien: "/actions", dedupe_key: `relances-${today}`,
      });
    }

    // 2) Devis envoyés sans réponse depuis 7 jours.
    const seuilDevis = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: devisEnAttente } = await sb.from("devis")
      .select("id, numero, owner_id, updated_at").eq("statut", "envoye").lt("updated_at", seuilDevis);
    for (const d of devisEnAttente ?? []) {
      if (!d.owner_id || !actifIds.has(d.owner_id)) continue;
      notifs.push({
        user_id: d.owner_id, type: "devis",
        titre: `Devis ${d.numero} sans réponse`,
        corps: "Envoyé il y a plus de 7 jours : pensez à relancer le client.",
        lien: "/devis", dedupe_key: `devis-relance-${d.id}`,
      });
    }

    // 3) Factures échues non réglées → créateur + direction.
    const { data: facturesEchues } = await sb.from("factures")
      .select("id, numero, owner_id, date_echeance, total_ttc")
      .eq("statut", "envoyee").lt("date_echeance", today);
    for (const f of facturesEchues ?? []) {
      const cibles = new Set<string>(managers.map((m) => m.id));
      if (f.owner_id && actifIds.has(f.owner_id)) cibles.add(f.owner_id);
      for (const uid of cibles) {
        notifs.push({
          user_id: uid, type: "facture",
          titre: `Facture ${f.numero} échue`,
          corps: `Échéance dépassée (${f.date_echeance}) — règlement non reçu.`,
          lien: "/factures", dedupe_key: `facture-echue-${f.id}`,
        });
      }
    }

    // 4) Propositions de l'agent IA en attente → direction.
    const { data: propositions } = await sb.from("ai_actions").select("id").eq("statut", "proposee");
    if ((propositions ?? []).length > 0) {
      const n = propositions!.length;
      for (const m of managers) {
        notifs.push({
          user_id: m.id, type: "ia",
          titre: `${n} proposition${n > 1 ? "s" : ""} IA en attente`,
          corps: "Des actions proposées par l'assistant attendent votre validation (expiration sous 24 h).",
          lien: "/assistant", dedupe_key: `ia-en-attente-${today}`,
        });
      }
    }

    // Déduplication : on ne réinsère pas une notification dont la clé existe déjà.
    let inserees = 0;
    if (notifs.length) {
      const users = [...new Set(notifs.map((n) => n.user_id))];
      const { data: existantes } = await sb.from("notifications")
        .select("user_id, dedupe_key").in("user_id", users).not("dedupe_key", "is", null);
      const deja = new Set((existantes ?? []).map((e) => `${e.user_id}|${e.dedupe_key}`));
      const nouvelles = notifs.filter((n) => !deja.has(`${n.user_id}|${n.dedupe_key}`));
      if (nouvelles.length) {
        const { error } = await sb.from("notifications").insert(nouvelles);
        if (error) throw new Error(`Insertion notifications : ${error.message}`);
        inserees = nouvelles.length;
      }
    }

    // E-mail de synthèse : un mail par utilisateur ayant des notifications non lues.
    const appUrl = Deno.env.get("APP_URL") ?? "https://aissociate.fr";
    let mails = 0;
    for (const p of actifs) {
      if (!p.email) continue;
      const { data: nonLues } = await sb.from("notifications")
        .select("titre, corps").eq("user_id", p.id).eq("lu", false)
        .order("created_at", { ascending: false }).limit(20);
      if (!nonLues?.length) continue;
      const lignes = nonLues.map((n) => `<li><strong>${n.titre}</strong>${n.corps ? ` — ${n.corps}` : ""}</li>`).join("");
      const html = `<p>Bonjour ${p.prenom ?? ""},</p>
<p>Votre synthèse Aissociate du jour :</p><ul>${lignes}</ul>
<p><a href="${appUrl}/dashboard">Ouvrir le CRM</a></p>`;
      try {
        const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            to: p.email,
            subject: `Aissociate — ${nonLues.length} point${nonLues.length > 1 ? "s" : ""} d'attention aujourd'hui`,
            html,
          }),
        });
        if (r.ok) mails++;
      } catch { /* SMTP non configuré : les notifications in-app restent */ }
    }

    const message = `${inserees} notification(s) créée(s), ${mails} e-mail(s) de synthèse`;
    await logRun(sb, startedAt, true, message, { inserees, mails });
    return json({ ok: true, inserees, mails });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRun(sb, startedAt, false, message);
    return json({ error: message }, 500);
  }
});
