// Edge Function — generation d'un justificatif Qualiopi (dossier de formation)
// en PDF, personnalise avec les donnees de la session / de l'apprenant / de
// l'organisme. Rendu 100% serveur (pdf-lib), upload bucket prive « qualiopi »,
// mise a jour de qualiopi_dossier_docs (statut = genere + fichier_url).
//
// NB : le texte des modeles est volontairement en ASCII simple (deploiement
// via MCP). clean() preserve les accents Latin-1 (<=255) : on peut les
// reintroduire dans buildContent() sans risque cote rendu PDF.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

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

function clean(s: unknown): string {
  const str = String(s ?? "");
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c === 8217 || c === 8216) out += "'";
    else if (c === 8220 || c === 8221) out += '"';
    else if (c === 8211 || c === 8212) out += "-";
    else if (c === 8230) out += "...";
    else if (c === 8226 || c === 183) out += "-";
    else if (c === 160) out += " ";
    else if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 255) || c === 8364) out += str[i];
  }
  return out;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "......";
  try { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return String(d); }
}

interface Ctx {
  org: Record<string, string>;
  session: Record<string, unknown>;
  formation: Record<string, unknown> | null;
  participant: Record<string, unknown> | null;
  libelle: string;
}

function buildContent(type: string, c: Ctx): { title: string; blocks: string[] } {
  const orgNom = c.org.nom || "AIssociate";
  const nda = c.org.nda ? `Declaration d'activite enregistree sous le n ${c.org.nda}` : "";
  const app = c.participant ? `${c.participant.prenom ?? ""} ${c.participant.nom ?? ""}`.trim() : "......";
  const intitule = (c.formation?.intitule as string) ?? (c.session.titre as string) ?? "";
  const duree = c.formation?.duree_heures ? `${c.formation.duree_heures} heures` : "... heures";
  const modalite = (c.session.modalite as string) ?? (c.formation?.modalite as string) ?? "presentiel";
  const lieu = (c.session.lieu as string) || "......";
  const debut = fmtDate(c.session.date_debut as string);
  const fin = fmtDate(c.session.date_fin as string);
  const formateur = (c.session.formateur as string) || "......";
  const objectifs = (c.formation?.objectifs as string) || "";

  const entete = [
    `Organisme de formation : ${orgNom}`,
    c.org.siret ? `SIRET : ${c.org.siret}` : "",
    nda,
    c.org.adresse ? `${c.org.adresse} ${c.org.ville ?? ""}`.trim() : "",
  ].filter(Boolean);

  switch (type) {
    case "convention":
      return {
        title: "Convention de formation professionnelle",
        blocks: [
          ...entete, "",
          "Entre les soussignes :",
          `1) ${orgNom}, organisme de formation, ${nda}`,
          `2) Le beneficiaire : ${app}`, "",
          "## Article 1 - Objet",
          `En execution de la presente convention, l'organisme organise l'action de formation intitulee \"${intitule}\".`,
          "## Article 2 - Nature et caracteristiques",
          `Objectifs : ${objectifs || "voir programme annexe"}.`,
          `Duree : ${duree}. Modalite : ${modalite}. Dates : du ${debut} au ${fin}. Lieu : ${lieu}.`,
          "## Article 3 - Modalites de deroulement et de sanction",
          "L'action est sanctionnee par une attestation de fin de formation et un certificat de realisation. L'assiduite est justifiee par les feuilles d'emargement.",
          "## Article 4 - Dispositions financieres",
          "Le prix est precise au devis / bon de commande annexe.", "", "",
          "Fait a ......, le ...... en deux exemplaires.",
          "Pour l'organisme :                                Le beneficiaire :",
        ],
      };
    case "convocation":
      return {
        title: "Convocation a une action de formation",
        blocks: [
          ...entete, "", `A l'attention de : ${app}`, "",
          `Nous avons le plaisir de vous convoquer a la formation \"${intitule}\".`, "",
          `Dates : du ${debut} au ${fin}`,
          `Duree : ${duree}`,
          `Modalite : ${modalite}`,
          `Lieu : ${lieu}`,
          `Formateur : ${formateur}`, "",
          "Merci de vous presenter muni(e) de cette convocation. En cas d'empechement ou de besoin d'amenagement (situation de handicap), contactez notre referent handicap.", "",
          `${c.org.email ? "Contact : " + c.org.email : ""}`,
        ],
      };
    case "attestation_fin":
      return {
        title: "Attestation de fin de formation",
        blocks: [
          ...entete, "",
          `Je soussigne(e), representant l'organisme ${orgNom}, atteste que :`, "",
          `${app}`, "",
          `a suivi l'action de formation \"${intitule}\",`,
          `d'une duree de ${duree}, du ${debut} au ${fin}, en ${modalite}.`, "",
          "## Objectifs de la formation",
          objectifs || "Voir programme de formation.", "",
          "## Resultats de l'evaluation des acquis",
          "Les acquis ont ete evalues (voir document d'evaluation des acquis). Niveau d'atteinte des objectifs : Acquis / Partiellement acquis / Non acquis.", "", "",
          `Fait a ${c.org.ville || "......"}, le ${fmtDate(c.session.date_fin as string)}.`,
          "Signature et cachet de l'organisme :",
        ],
      };
    case "certificat_realisation":
      return {
        title: "Certificat de realisation",
        blocks: [
          ...entete, "",
          `Je soussigne(e), representant l'organisme concourant au developpement des competences ${orgNom}, atteste que :`, "",
          `${app}`, "",
          `a realise l'action \"${intitule}\" (action de formation).`, "",
          `Nature : action de formation`,
          `Dates : du ${debut} au ${fin}`,
          `Duree totale : ${duree}`, "", "",
          "Pour valoir ce que de droit.",
          `Fait a ${c.org.ville || "......"}, le ${fmtDate(c.session.date_fin as string)}.`,
          "Cachet et signature :",
        ],
      };
    case "livret_accueil":
      return {
        title: "Livret d'accueil de l'apprenant",
        blocks: [
          ...entete, "", `Formation : ${intitule}`, "",
          "## Bienvenue",
          `Ce livret vous informe sur le deroulement de votre formation au sein de ${orgNom}.`,
          "## Deroulement",
          `Dates : du ${debut} au ${fin} - Duree : ${duree} - Modalite : ${modalite} - Lieu : ${lieu}.`,
          "## Reglement interieur",
          "Les regles de fonctionnement, d'hygiene et de securite sont applicables durant toute la formation.",
          "## Accessibilite et handicap",
          "Un referent handicap est a votre disposition pour toute demande d'adaptation.",
          "## Reclamations",
          "Toute reclamation peut etre adressee a l'organisme, qui s'engage a la traiter selon sa procedure dediee.",
          "## Contacts",
          `${orgNom} - ${c.org.email ?? ""} ${c.org.adresse ?? ""}`,
        ],
      };
    case "livret_suivi":
      return {
        title: "Livret de suivi pedagogique individualise",
        blocks: [
          ...entete, "", `Apprenant : ${app}`, `Formation : ${intitule}`, "",
          "## Positionnement a l'entree",
          "Niveau initial et objectifs individualises : ......",
          "## Suivi des seances",
          "Seance 1 - Date : ... Acquis / difficultes : ......",
          "Seance 2 - Date : ... Acquis / difficultes : ......",
          "Seance 3 - Date : ... Acquis / difficultes : ......",
          "## Adaptations pedagogiques mises en oeuvre",
          "......",
          "## Bilan de fin de parcours",
          "Atteinte des objectifs : Acquis / Partiellement / Non acquis. Suites envisagees : ......",
        ],
      };
    case "emargement":
      return {
        title: "Etat d'emargement",
        blocks: [
          ...entete, "", `Formation : ${intitule}`,
          `Dates : du ${debut} au ${fin} - Duree : ${duree} - Modalite : ${modalite}`,
          `Formateur : ${formateur}`, "",
          "Demi-journee | Date | Nom de l'apprenant | Signature apprenant | Signature formateur",
          "Matin      | ... | ...... | ...... | ......",
          "Apres-midi  | ... | ...... | ...... | ......",
          "Matin      | ... | ...... | ...... | ......",
          "Apres-midi  | ... | ...... | ...... | ......", "",
          "L'emargement atteste de la presence effective des participants.",
        ],
      };
    default:
      return {
        title: c.libelle || "Document Qualiopi",
        blocks: [...entete, "", `Formation : ${intitule}`, `Apprenant : ${app}`, `Dates : du ${debut} au ${fin}`],
      };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { docId } = await req.json();
    if (!docId) return json({ error: "docId manquant" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: doc } = await sb.from("qualiopi_dossier_docs").select("*").eq("id", docId).maybeSingle();
    if (!doc) return json({ error: "Document introuvable" }, 404);

    const { data: sessionRow } = await sb.from("sessions_formation").select("*").eq("id", doc.session_id).maybeSingle();
    const formationId = sessionRow?.formation_id;
    const { data: formation } = formationId
      ? await sb.from("formations").select("*").eq("id", formationId).maybeSingle()
      : { data: null };
    const { data: participant } = doc.participant_id
      ? await sb.from("session_participants").select("*").eq("id", doc.participant_id).maybeSingle()
      : { data: null };
    const { data: orgRow } = await sb.from("parametres").select("valeur").eq("cle", "organisme").maybeSingle();
    const org = (orgRow?.valeur ?? {}) as Record<string, string>;

    const { title, blocks } = buildContent(doc.type_doc, {
      org, session: sessionRow ?? {}, formation, participant, libelle: doc.libelle,
    });

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
    const brand = rgb(0.917, 0.416, 0.118);
    let page = pdf.addPage([595, 842]);
    const margin = 56;
    const width = 595 - margin * 2;
    let y = 842 - margin;

    const newPageIfNeeded = (needed: number) => {
      if (y - needed < margin) { page = pdf.addPage([595, 842]); y = 842 - margin; }
    };
    const wrap = (text: string, f: typeof font, size: number): string[] => {
      const words = clean(text).split(/\s+/);
      const lines: string[] = []; let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (f.widthOfTextAtSize(test, size) > width) { if (line) lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      return lines.length ? lines : [""];
    };

    page.drawText(clean((org.nom || "AIssociate").toUpperCase()), { x: margin, y, size: 16, font: fontB, color: brand });
    y -= 26;
    page.drawText(clean(title), { x: margin, y, size: 15, font: fontB, color: rgb(0.1, 0.1, 0.15) });
    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: 595 - margin, y }, thickness: 1, color: brand });
    y -= 22;

    for (const block of blocks) {
      if (block === "") { y -= 8; continue; }
      const isHead = block.slice(0, 3) === "## ";
      const text = isHead ? block.slice(3) : block;
      const size = isHead ? 12 : 10.5;
      const f = isHead ? fontB : font;
      const lines = wrap(text, f, size);
      for (const ln of lines) {
        newPageIfNeeded(16);
        page.drawText(ln, { x: margin, y, size, font: f, color: isHead ? brand : rgb(0.15, 0.15, 0.2) });
        y -= size + 5;
      }
      if (isHead) y -= 3;
    }

    y = margin - 20;
    const foot = clean(`${org.nom || "AIssociate"} - ${org.email ?? ""} - SIRET ${org.siret ?? ""} - NDA ${org.nda ?? ""}`);
    page.drawText(foot.slice(0, 120), { x: margin, y, size: 7.5, font, color: rgb(0.5, 0.5, 0.55) });

    const bytes = await pdf.save();
    const path = `${doc.session_id}/${doc.type_doc}-${docId}.pdf`;
    const { error: upErr } = await sb.storage.from("qualiopi").upload(path, bytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (upErr) return json({ error: upErr.message }, 500);

    await sb.from("qualiopi_dossier_docs").update({
      fichier_url: path, statut: "genere", genere_at: new Date().toISOString(),
    }).eq("id", docId);

    return json({ ok: true, path });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur serveur" }, 500);
  }
});
