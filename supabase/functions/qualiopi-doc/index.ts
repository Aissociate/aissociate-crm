// Edge Function — génération d'un justificatif Qualiopi (dossier de formation)
// en PDF, personnalisé avec les données de la session / de l'apprenant / de
// l'organisme. Rendu 100% serveur (pdf-lib), upload bucket privé « qualiopi »,
// mise à jour de qualiopi_dossier_docs (statut = généré + fichier_url).
//
// Logo & signature : si `parametres.organisme` contient `logo_url` et/ou
// `signature_url` (image PNG/JPG accessible en HTTP), elles sont incrustées.
// Sinon on retombe proprement sur l'en-tête texte + la zone de signature vide.
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

// Normalise vers WinAnsi (Latin-1) : conserve les accents et « », convertit
// les caractères typographiques non supportés.
function clean(s: unknown): string {
  const str = String(s ?? "");
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c === 8217 || c === 8216) out += "'";
    else if (c === 8220 || c === 8221) out += '"';
    else if (c === 8211 || c === 8212) out += "-";
    else if (c === 8230) out += "...";
    else if (c === 8226) out += "-";
    else if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 255) || c === 8364) out += str[i];
  }
  return out;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "……………";
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

// Types de documents portant une signature de l'organisme.
const SIGNED = new Set(["convention", "attestation_fin", "certificat_realisation"]);

function buildContent(type: string, c: Ctx): { title: string; blocks: string[] } {
  const orgNom = c.org.nom || "AIssociate";
  const nda = c.org.nda ? `Déclaration d'activité enregistrée sous le n° ${c.org.nda}` : "";
  const app = c.participant ? `${c.participant.prenom ?? ""} ${c.participant.nom ?? ""}`.trim() : "……………";
  const intitule = (c.formation?.intitule as string) ?? (c.session.titre as string) ?? "";
  const duree = c.formation?.duree_heures ? `${c.formation.duree_heures} heures` : "……… heures";
  const modalite = (c.session.modalite as string) ?? (c.formation?.modalite as string) ?? "présentiel";
  const lieu = (c.session.lieu as string) || "……………";
  const debut = fmtDate(c.session.date_debut as string);
  const fin = fmtDate(c.session.date_fin as string);
  const formateur = (c.session.formateur as string) || "……………";
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
          "Entre les soussignés :",
          `1) ${orgNom}, organisme de formation, ${nda}`,
          `2) Le bénéficiaire : ${app}`, "",
          "## Article 1 — Objet",
          `En exécution de la présente convention, l'organisme organise l'action de formation intitulée « ${intitule} ».`,
          "## Article 2 — Nature et caractéristiques",
          `Objectifs : ${objectifs || "voir programme annexé"}.`,
          `Durée : ${duree}. Modalité : ${modalite}. Dates : du ${debut} au ${fin}. Lieu : ${lieu}.`,
          "## Article 3 — Modalités de déroulement et de sanction",
          "L'action est sanctionnée par une attestation de fin de formation et un certificat de réalisation. L'assiduité est justifiée par les feuilles d'émargement.",
          "## Article 4 — Dispositions financières",
          "Le prix est précisé au devis / bon de commande annexé.", "", "",
          "Fait à ……………, le …………… en deux exemplaires.",
          "Pour l'organisme :                                Le bénéficiaire :",
        ],
      };
    case "convocation":
      return {
        title: "Convocation à une action de formation",
        blocks: [
          ...entete, "", `À l'attention de : ${app}`, "",
          `Nous avons le plaisir de vous convoquer à la formation « ${intitule} ».`, "",
          `Dates : du ${debut} au ${fin}`,
          `Durée : ${duree}`,
          `Modalité : ${modalite}`,
          `Lieu : ${lieu}`,
          `Formateur : ${formateur}`, "",
          "Merci de vous présenter muni(e) de cette convocation. En cas d'empêchement ou de besoin d'aménagement (situation de handicap), contactez notre référent handicap.", "",
          `${c.org.email ? "Contact : " + c.org.email : ""}`,
        ],
      };
    case "attestation_fin":
      return {
        title: "Attestation de fin de formation",
        blocks: [
          ...entete, "",
          `Je soussigné(e), représentant l'organisme ${orgNom}, atteste que :`, "",
          `${app}`, "",
          `a suivi l'action de formation « ${intitule} »,`,
          `d'une durée de ${duree}, du ${debut} au ${fin}, en ${modalite}.`, "",
          "## Objectifs de la formation",
          objectifs || "Voir programme de formation.", "",
          "## Résultats de l'évaluation des acquis",
          "Les acquis ont été évalués (voir document d'évaluation des acquis). Niveau d'atteinte des objectifs : Acquis / Partiellement acquis / Non acquis.", "", "",
          `Fait à ${c.org.ville || "……………"}, le ${fmtDate(c.session.date_fin as string)}.`,
          "Signature et cachet de l'organisme :",
        ],
      };
    case "certificat_realisation":
      return {
        title: "Certificat de réalisation",
        blocks: [
          ...entete, "",
          `Je soussigné(e), représentant l'organisme concourant au développement des compétences ${orgNom}, atteste que :`, "",
          `${app}`, "",
          `a réalisé l'action « ${intitule} » (action de formation).`, "",
          `Nature : action de formation`,
          `Dates : du ${debut} au ${fin}`,
          `Durée totale : ${duree}`, "", "",
          "Pour valoir ce que de droit.",
          `Fait à ${c.org.ville || "……………"}, le ${fmtDate(c.session.date_fin as string)}.`,
          "Cachet et signature :",
        ],
      };
    case "livret_accueil":
      return {
        title: "Livret d'accueil de l'apprenant",
        blocks: [
          ...entete, "", `Formation : ${intitule}`, "",
          "## Bienvenue",
          `Ce livret vous informe sur le déroulement de votre formation au sein de ${orgNom}.`,
          "## Déroulement",
          `Dates : du ${debut} au ${fin} — Durée : ${duree} — Modalité : ${modalite} — Lieu : ${lieu}.`,
          "## Règlement intérieur",
          "Les règles de fonctionnement, d'hygiène et de sécurité sont applicables durant toute la formation.",
          "## Accessibilité et handicap",
          "Un référent handicap est à votre disposition pour toute demande d'adaptation.",
          "## Réclamations",
          "Toute réclamation peut être adressée à l'organisme, qui s'engage à la traiter selon sa procédure dédiée.",
          "## Contacts",
          `${orgNom} — ${c.org.email ?? ""} ${c.org.adresse ?? ""}`,
        ],
      };
    case "livret_suivi":
      return {
        title: "Livret de suivi pédagogique individualisé",
        blocks: [
          ...entete, "", `Apprenant : ${app}`, `Formation : ${intitule}`, "",
          "## Positionnement à l'entrée",
          "Niveau initial et objectifs individualisés : ……………………………………………………",
          "## Suivi des séances",
          "Séance 1 — Date : ……… Acquis / difficultés : …………………………………",
          "Séance 2 — Date : ……… Acquis / difficultés : …………………………………",
          "Séance 3 — Date : ……… Acquis / difficultés : …………………………………",
          "## Adaptations pédagogiques mises en œuvre",
          "……………………………………………………………………………………………",
          "## Bilan de fin de parcours",
          "Atteinte des objectifs : Acquis / Partiellement / Non acquis. Suites envisagées : …………",
        ],
      };
    case "emargement":
      return {
        title: "État d'émargement",
        blocks: [
          ...entete, "", `Formation : ${intitule}`,
          `Dates : du ${debut} au ${fin} — Durée : ${duree} — Modalité : ${modalite}`,
          `Formateur : ${formateur}`, "",
          "Demi-journée | Date | Nom de l'apprenant | Signature apprenant | Signature formateur",
          "Matin      | ……… | ……………………… | ………………… | …………………",
          "Après-midi  | ……… | ……………………… | ………………… | …………………",
          "Matin      | ……… | ……………………… | ………………… | …………………",
          "Après-midi  | ……… | ……………………… | ………………… | …………………", "",
          "L'émargement atteste de la présence effective des participants.",
        ],
      };
    default:
      return {
        title: c.libelle || "Document Qualiopi",
        blocks: [...entete, "", `Formation : ${intitule}`, `Apprenant : ${app}`, `Dates : du ${debut} au ${fin}`],
      };
  }
}

// Télécharge et incruste une image PNG/JPG. Renvoie null si absente/illisible.
async function embedImage(pdf: PDFDocument, url: string | undefined) {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf[0] === 0x89 && buf[1] === 0x50) return await pdf.embedPng(buf);
    if (buf[0] === 0xFF && buf[1] === 0xD8) return await pdf.embedJpg(buf);
    return null;
  } catch { return null; }
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
    const logo = await embedImage(pdf, org.logo_url);
    const signature = SIGNED.has(doc.type_doc) ? await embedImage(pdf, org.signature_url) : null;

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

    // En-tête : logo à droite si dispo.
    if (logo) {
      const w = 110; const h = (logo.height / logo.width) * w;
      page.drawImage(logo, { x: 595 - margin - w, y: 842 - margin - h + 8, width: w, height: h });
    }
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

    // Signature de l'organisme (documents signés).
    if (signature) {
      const w = 150; const h = (signature.height / signature.width) * w;
      newPageIfNeeded(h + 10);
      page.drawImage(signature, { x: margin, y: y - h, width: w, height: h });
      y -= h + 6;
    }

    y = margin - 20;
    const foot = clean(`${org.nom || "AIssociate"} — ${org.email ?? ""} — SIRET ${org.siret ?? ""} — NDA ${org.nda ?? ""}`);
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
