// Edge Function — production d'un document de dossier par PUBLIPOSTAGE sur un
// modèle Word (.docx). Remplace les champs [TOKEN] du modèle par les données du
// dossier (organisme / entreprise / formation / session / apprenant) et renvoie
// un .docx fidèle à votre charte. Upload bucket privé « qualiopi ».
//
// Appelée par le front UNIQUEMENT quand un modèle actif existe pour le type_doc
// (sinon le front appelle « qualiopi-doc », génération pdf-lib générique).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";
import PizZip from "npm:pizzip@3.1.7";
import Docxtemplater from "npm:docxtemplater@3.50.0";

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
function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return String(d); }
}

function buildMergeData(o: Record<string, string>, e: Record<string, unknown> | null,
  f: Record<string, unknown> | null, s: Record<string, unknown>, p: Record<string, unknown> | null): Record<string, string> {
  const app = p ? `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() : "";
  const debut = fmtDate(s.date_debut as string);
  const fin = fmtDate(s.date_fin as string);
  const intitule = (f?.intitule as string) ?? (s.titre as string) ?? "";
  const duree = f?.duree_heures ? String(f.duree_heures) : "";
  return {
    "NOM ORGANISME": o.nom ?? "", "ORGANISME": o.nom ?? "", "SIRET": o.siret ?? "",
    "ADRESSE": [o.adresse, o.ville].filter(Boolean).join(" "), "VILLE": o.ville ?? "",
    "NUMERO DECLARATION": o.nda ?? "", "NDA": o.nda ?? "", "REGION": o.region ?? "La Réunion",
    "REPRESENTANT": o.representant ?? o.gerant ?? "", "EMAIL": o.email ?? "", "TELEPHONE": o.telephone ?? "",
    "NOM ENTREPRISE": (e?.raison_sociale as string) ?? "", "SIRET ENTREPRISE": (e?.siret as string) ?? "",
    "INTITULE FORMATION": intitule, "INTITULE": intitule,
    "OBJECTIFS PEDAGOGIQUES": (f?.objectifs as string) ?? "", "OBJECTIFS": (f?.objectifs as string) ?? "",
    "NOMBRE HEURES": duree, "DUREE": duree ? `${duree} heures` : "",
    "DATE DEBUT": debut, "DATE FIN DE FORMATION": fin, "DATE FIN": fin,
    "DATES": `du ${debut} au ${fin}`,
    "LIEU": (s.lieu as string) ?? "", "ADRESSE SALLE": (s.lieu as string) ?? "",
    "MODALITE": (s.modalite as string) ?? (f?.modalite as string) ?? "présentiel",
    "FORMATEUR": (s.formateur as string) ?? "",
    "PRENOM NOM": app, "STAGIAIRE": app, "APPRENANT": app,
    "NOM": (p?.nom as string) ?? "", "PRENOM": (p?.prenom as string) ?? "",
    "TARIF": f?.prix ? String(f.prix) : "", "PRIX": f?.prix ? String(f.prix) : "",
    "TYPE D'ACTION": "action de formation", "TYPE D’ACTION": "action de formation",
    "DATE DU JOUR": fmtDate(new Date().toISOString()),
  };
}

function publipostage(modelBytes: Uint8Array, data: Record<string, string>): Uint8Array {
  const zip = new PizZip(modelBytes);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "[", end: "]" },
    paragraphLoop: true,
    linebreaks: true,
    // Parser « clé littérale » : gère les tokens contenant des espaces.
    parser: (tag: string) => ({ get: (scope: Record<string, unknown>) => (tag in scope ? scope[tag] : undefined) }),
    nullGetter: (part: { value?: string }) => `[${part?.value ?? ""}]`,
  });
  doc.render(data);
  return doc.getZip().generate({ type: "uint8array" }) as Uint8Array;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { docId } = await req.json();
    if (!docId) return json({ error: "docId manquant" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: doc } = await sb.from("qualiopi_dossier_docs").select("*").eq("id", docId).maybeSingle();
    if (!doc) return json({ error: "Document introuvable" }, 404);

    const { data: modele } = await sb.from("qualiopi_modeles_doc")
      .select("fichier_url, actif").eq("type_doc", doc.type_doc).maybeSingle();
    if (!modele?.actif || !modele.fichier_url) return json({ error: "no_model" }, 409);

    const { data: sessionRow } = await sb.from("sessions_formation").select("*").eq("id", doc.session_id).maybeSingle();
    const { data: formation } = sessionRow?.formation_id
      ? await sb.from("formations").select("*").eq("id", sessionRow.formation_id).maybeSingle()
      : { data: null };
    const { data: participant } = doc.participant_id
      ? await sb.from("session_participants").select("*").eq("id", doc.participant_id).maybeSingle()
      : { data: null };
    const { data: orgRow } = await sb.from("parametres").select("valeur").eq("cle", "organisme").maybeSingle();
    const org = (orgRow?.valeur ?? {}) as Record<string, string>;

    // Entreprise : via le dossier de la session, sinon via le contact de l'apprenant.
    let entreprise: Record<string, unknown> | null = null;
    if (sessionRow?.dossier_id) {
      const { data: dos } = await sb.from("dossiers").select("entreprise_id").eq("id", sessionRow.dossier_id).maybeSingle();
      if (dos?.entreprise_id) {
        const { data: ent } = await sb.from("entreprises").select("*").eq("id", dos.entreprise_id).maybeSingle();
        entreprise = ent ?? null;
      }
    }
    if (!entreprise && participant?.contact_id) {
      const { data: ct } = await sb.from("contacts").select("entreprise_id").eq("id", participant.contact_id).maybeSingle();
      if (ct?.entreprise_id) {
        const { data: ent } = await sb.from("entreprises").select("*").eq("id", ct.entreprise_id).maybeSingle();
        entreprise = ent ?? null;
      }
    }

    let out: Uint8Array;
    try {
      const { data: file, error: dlErr } = await sb.storage.from("qualiopi").download(modele.fichier_url as string);
      if (dlErr || !file) throw new Error(dlErr?.message ?? "modèle introuvable");
      const modelBytes = new Uint8Array(await file.arrayBuffer());
      const data = buildMergeData(org, entreprise, formation, sessionRow ?? {}, participant);
      out = publipostage(modelBytes, data);
    } catch (e) {
      return json({ error: "publipostage: " + (e instanceof Error ? e.message : String(e)) }, 500);
    }

    const path = `${doc.session_id}/${doc.type_doc}-${docId}.docx`;
    const { error: upErr } = await sb.storage.from("qualiopi").upload(path, out, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
    if (upErr) return json({ error: upErr.message }, 500);

    await sb.from("qualiopi_dossier_docs").update({
      fichier_url: path, statut: "genere", genere_at: new Date().toISOString(),
    }).eq("id", docId);

    return json({ ok: true, path, mode: "publipostage" });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur serveur" }, 500);
  }
});
