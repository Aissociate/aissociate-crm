// Edge Function PUBLIQUE — Espace client / apprenant (verify_jwt=false).
// Le client ouvre /espace/:token (lien généré depuis sa fiche contact) et
// retrouve : sessions, devis, factures, documents, questionnaires à répondre,
// demandes de signature, liens d'émargement. Chaque ouverture est consignée
// dans espace_consultations (traçabilité Qualiopi).
//   action 'get'      → données de l'espace
//   action 'download' → URL signée d'un fichier autorisé (devis/facture/document)
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const urlToken = new URL(req.url).searchParams.get("token");
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action ?? "get";
    const token = body.token ?? urlToken;
    if (!token) return json({ error: "Token manquant" }, 400);

    const { data: acces } = await sb.from("espace_acces")
      .select("id, contact_id, actif").eq("token", token).maybeSingle();
    if (!acces || !acces.actif) return json({ error: "Lien invalide ou désactivé" }, 404);

    const { data: contact } = await sb.from("contacts")
      .select("id, prenom, nom, email, email2, email3").eq("id", acces.contact_id).maybeSingle();
    if (!contact) return json({ error: "Contact introuvable" }, 404);
    const emails = [contact.email, contact.email2, contact.email3]
      .filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase());

    const trace = (ressource: string, detail?: string) =>
      sb.from("espace_consultations").insert({ acces_id: acces.id, ressource, detail: detail ?? null });

    if (action === "download") {
      // Seuls les fichiers réellement rattachés au contact sont signables.
      const { bucket, path } = body as { bucket?: string; path?: string };
      if (!bucket || !path) return json({ error: "Fichier manquant" }, 400);
      let autorise = false;
      if (bucket === "devis") {
        const { data } = await sb.from("devis").select("id").eq("contact_id", contact.id).eq("fichier_url", path).maybeSingle();
        autorise = Boolean(data);
      } else if (bucket === "factures") {
        const { data } = await sb.from("factures").select("id").eq("contact_id", contact.id).eq("fichier_url", path).maybeSingle();
        autorise = Boolean(data);
      } else if (bucket === "coffre") {
        const { data } = await sb.from("contact_documents").select("id").eq("contact_id", contact.id).eq("fichier_url", path).maybeSingle();
        autorise = Boolean(data);
      }
      if (!autorise) return json({ error: "Fichier non autorisé" }, 403);
      const { data: signed, error } = await sb.storage.from(bucket).createSignedUrl(path, 600);
      if (error || !signed) return json({ error: "Fichier indisponible" }, 500);
      await trace("telechargement", `${bucket}/${path}`);
      return json({ url: signed.signedUrl });
    }

    // ── action 'get' ──
    await sb.from("espace_acces").update({ last_seen_at: new Date().toISOString() }).eq("id", acces.id);
    await trace("ouverture");

    // Sessions du contact (participant direct ou via e-mail).
    const { data: participations } = await sb.from("session_participants")
      .select("session_id, statut, contact_id, email").or(
        [`contact_id.eq.${contact.id}`, ...(emails.length ? [`email.in.(${emails.join(",")})`] : [])].join(","),
      );
    const sessionIds = [...new Set((participations ?? []).map((p) => p.session_id))];
    const { data: sessions } = sessionIds.length
      ? await sb.from("sessions_formation")
          .select("id, titre, date_debut, date_fin, lieu, modalite, formateur")
          .in("id", sessionIds).order("date_debut", { ascending: false })
      : { data: [] };

    // Devis et factures (numéro + statut + fichier → téléchargeable via 'download').
    const { data: devis } = await sb.from("devis")
      .select("numero, date_emission, statut, total_ht, fichier_url")
      .eq("contact_id", contact.id).neq("statut", "brouillon").order("date_emission", { ascending: false });
    const { data: factures } = await sb.from("factures")
      .select("numero, date_emission, date_echeance, statut, total_ttc, fichier_url")
      .eq("contact_id", contact.id).neq("statut", "brouillon").order("date_emission", { ascending: false });

    // Documents partagés (déposés sur la fiche contact).
    const { data: documentsContact } = await sb.from("contact_documents")
      .select("titre, fichier_url, created_at").eq("contact_id", contact.id).order("created_at", { ascending: false });

    // Questionnaires à répondre (Qualiopi) : liens tokenisés existants.
    const { data: questionnaires } = await sb.from("questionnaire_envois")
      .select("token, modele_code, statut, sent_at, questionnaire_modeles(titre)")
      .eq("contact_id", contact.id).neq("statut", "repondu").order("sent_at", { ascending: false });

    // Demandes de signature en attente.
    const { data: signatures } = await sb.from("signatures")
      .select("token, libelle, statut, created_at")
      .eq("contact_id", contact.id).eq("statut", "en_attente").order("created_at", { ascending: false });

    // Émargements : accès du participant sur ses sessions.
    const { data: emargements } = sessionIds.length
      ? await sb.from("emargement_acces")
          .select("token, session_id, expire_at, session_participants!inner(contact_id, email)")
          .in("session_id", sessionIds)
      : { data: [] };
    const mesEmargements = (emargements ?? []).filter((e) => {
      const sp = e.session_participants as unknown as { contact_id: string | null; email: string | null };
      return sp?.contact_id === contact.id || (sp?.email && emails.includes(sp.email.toLowerCase()));
    }).map((e) => ({ token: e.token, session_id: e.session_id, expire_at: e.expire_at }));

    return json({
      prenom: contact.prenom, nom: contact.nom,
      sessions: sessions ?? [],
      devis: devis ?? [],
      factures: factures ?? [],
      documents: documentsContact ?? [],
      questionnaires: (questionnaires ?? []).map((q) => ({
        token: q.token, statut: q.statut, sent_at: q.sent_at,
        titre: (q.questionnaire_modeles as unknown as { titre: string } | null)?.titre ?? q.modele_code,
      })),
      signatures: signatures ?? [],
      emargements: mesEmargements,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
