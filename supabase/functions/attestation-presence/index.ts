// Edge Function — attestation de présence tirée des émargements enregistrés.
// L'appelant choisit la session, les participants et les demi-journées à
// retenir (une période, pas forcément tous les jours émargés). Une page par
// participant ; seules les demi-journées « présent » comptent dans le total.
//
// Lecture avec le jeton de l'appelant : la RLS reste le périmètre. Le PDF est
// renvoyé tel quel (octet-stream, que supabase-js lit en Blob).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "npm:pdf-lib@1.17.1";
import { partiesLocales } from "../_shared/heure_locale.ts";

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

// Normalise vers WinAnsi (Latin-1), comme qualiopi-doc.
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

/** « AAAA-MM-JJ » → « 12 octobre 2026 » (date calendaire, sans décalage horaire). */
function fmtJour(d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long", year: "numeric" }): string {
  if (!d) return "……………";
  return new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("fr-FR", { ...opts, timeZone: "UTC" });
}

const fmtHeures = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0$/, "").replace(".", ",")} h`;

const DEMI: Record<string, string> = { matin: "Matin", apres_midi: "Après-midi" };
const STATUT: Record<string, string> = { present: "Présent", absent: "Absent", excuse: "Excusé" };

type Creneau = { id: string; date: string; demi_journee: string; heures: number };
type Sig = { creneau_id: string; participant_id: string; statut: string; mode: string; signe_at: string };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Non authentifié" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user) return json({ error: "Non authentifié" }, 401);

    const body = await req.json() as {
      session_id?: string; participant_ids?: string[]; creneau_ids?: string[];
      date_debut?: string; date_fin?: string; lieu_signature?: string;
    };
    if (!body.session_id) return json({ error: "session_id manquant" }, 400);
    if (!body.participant_ids?.length) return json({ error: "Aucun participant choisi" }, 400);
    if (!body.creneau_ids?.length) return json({ error: "Aucune demi-journée choisie" }, 400);

    const [{ data: session }, { data: participants }, { data: creneauxRaw }, { data: orgRow }] = await Promise.all([
      sb.from("sessions_formation").select("*").eq("id", body.session_id).maybeSingle(),
      sb.from("session_participants").select("*").eq("session_id", body.session_id).in("id", body.participant_ids).order("nom"),
      sb.from("emargement_creneaux").select("id, date, demi_journee, heures").eq("session_id", body.session_id)
        .in("id", body.creneau_ids).order("date").order("demi_journee"),
      sb.from("parametres").select("valeur").eq("cle", "organisme").maybeSingle(),
    ]);
    if (!session) return json({ error: "Session introuvable" }, 404);
    if (!participants?.length) return json({ error: "Participants introuvables" }, 404);
    const creneaux = (creneauxRaw ?? []) as Creneau[];
    if (!creneaux.length) return json({ error: "Demi-journées introuvables" }, 404);

    const { data: formation } = session.formation_id
      ? await sb.from("formations").select("intitule").eq("id", session.formation_id).maybeSingle()
      : { data: null };
    const { data: sigs } = await sb.from("emargement_signatures")
      .select("creneau_id, participant_id, statut, mode, signe_at")
      .in("creneau_id", creneaux.map((c) => c.id))
      .in("participant_id", participants.map((p) => p.id));
    const sigDe = new Map(((sigs ?? []) as Sig[]).map((s) => [`${s.creneau_id}:${s.participant_id}`, s]));

    const org = (orgRow?.valeur ?? {}) as Record<string, string>;
    const orgNom = org.nom || "AIssociate";
    const intitule = (formation?.intitule as string) || session.titre || "";
    // Période affichée : celle demandée, à défaut les demi-journées retenues.
    const debut = body.date_debut || creneaux[0].date;
    const fin = body.date_fin || creneaux[creneaux.length - 1].date;
    const lieuSig = body.lieu_signature?.trim() || org.ville || "……………";
    const aujourdhui = partiesLocales().date;

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
    const brand = rgb(0.917, 0.416, 0.118);
    const ink = rgb(0.15, 0.15, 0.2);
    const muted = rgb(0.45, 0.45, 0.5);
    const logo = await embedImage(pdf, org.logo_url);
    // Cachet : celui des paramètres de l'organisme, à défaut celui déposé dans
    // la base documentaire (document intitulé « cachet + signature … »).
    let cachetUrl = org.signature_url;
    if (!cachetUrl) {
      const { data: doc } = await sb.from("documents").select("fichier_url")
        .ilike("titre", "%cachet%signature%").eq("statut", "actif")
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      cachetUrl = (doc?.fichier_url as string | undefined) ?? undefined;
    }
    const signature = await embedImage(pdf, cachetUrl);

    const W = 595, H = 842, margin = 56, width = W - margin * 2;

    for (const p of participants) {
      let page = pdf.addPage([W, H]);
      let y = H - margin;
      const nom = `${p.prenom ?? ""} ${p.nom ?? ""}`.trim();

      const text = (t: string, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; x?: number } = {}) => {
        const size = opts.size ?? 10.5;
        for (const ln of wrap(t, opts.f ?? font, size, width - ((opts.x ?? margin) - margin))) {
          if (y - size < margin + 20) { page = pdf.addPage([W, H]); y = H - margin; }
          page.drawText(ln, { x: opts.x ?? margin, y, size, font: opts.f ?? font, color: opts.color ?? ink });
          y -= size + 5;
        }
      };

      // En-tête
      if (logo) {
        const w = 110; const h = (logo.height / logo.width) * w;
        page.drawImage(logo, { x: W - margin - w, y: H - margin - h + 8, width: w, height: h });
      }
      page.drawText(clean(orgNom.toUpperCase()), { x: margin, y, size: 16, font: fontB, color: brand });
      y -= 26;
      page.drawText("Attestation de présence", { x: margin, y, size: 15, font: fontB, color: rgb(0.1, 0.1, 0.15) });
      y -= 10;
      page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 1, color: brand });
      y -= 22;

      for (const l of [
        org.siret ? `SIRET : ${org.siret}` : "",
        org.nda ? `Déclaration d'activité enregistrée sous le n° ${org.nda}` : "",
        org.adresse ? `${org.adresse} ${org.ville ?? ""}`.trim() : "",
      ].filter(Boolean)) text(l, { size: 9.5, color: muted });
      y -= 10;

      const retenus = creneaux.map((c) => ({ c, s: sigDe.get(`${c.id}:${p.id}`) }));
      const presents = retenus.filter((r) => r.s?.statut === "present");
      const totalH = presents.reduce((t, r) => t + Number(r.c.heures || 0), 0);

      text(`Je soussigné(e), représentant l'organisme de formation ${orgNom}, atteste que :`);
      y -= 6;
      text(nom, { size: 13, f: fontB });
      y -= 6;
      text(`a été présent(e) à l'action de formation « ${intitule} »${session.modalite ? `, en ${session.modalite}` : ""}${session.lieu ? `, à ${session.lieu}` : ""},`);
      text(`sur la période du ${fmtJour(debut)} au ${fmtJour(fin)}, pour une durée de ${fmtHeures(totalH)} (${presents.length} demi-journée${presents.length > 1 ? "s" : ""} de présence), selon le détail ci-dessous établi à partir des feuilles d'émargement.`);
      y -= 12;

      // Tableau des demi-journées retenues. Chaque cellule est découpée à la
      // largeur de sa colonne et la ligne prend la hauteur de la plus haute :
      // rien ne déborde sur la colonne ou la ligne voisine.
      const largeurs = [128, 68, 42, 58, width - 296];
      const cols = ["Date", "Demi-journée", "Durée", "Présence", "Émargement"].map((label, i) => ({
        label, x: margin + largeurs.slice(0, i).reduce((a, b) => a + b, 0), w: largeurs[i],
      }));
      const T = 9, PAS = T + 2.5, PAD = 4;
      // `fusion` : la première cellule s'étend sur les n premières colonnes.
      const ligne = (cells: string[], o: { bold?: boolean; fond?: ReturnType<typeof rgb>; fusion?: number } = {}) => {
        const f = o.bold ? fontB : font;
        const fusion = o.fusion ?? 1;
        const lignes = cells.map((v, i) => {
          if (i > 0 && i < fusion) return [];
          const w = i === 0 ? cols[fusion - 1].x + cols[fusion - 1].w - cols[0].x : cols[i].w;
          return wrap(v, f, T, w - PAD * 2);
        });
        const h = Math.max(...lignes.map((l) => l.length)) * PAS + PAD * 2 - 2.5;
        if (y - h < margin + 20) { page = pdf.addPage([W, H]); y = H - margin; }
        if (o.fond) page.drawRectangle({ x: margin, y: y - h, width, height: h, color: o.fond });
        lignes.forEach((ls, i) => ls.forEach((ln, k) => page.drawText(ln, {
          x: cols[i].x + PAD, y: y - PAD - T + 1.5 - k * PAS, size: T, font: f, color: ink,
        })));
        y -= h;
        page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.4, color: rgb(0.85, 0.85, 0.88) });
      };
      ligne(cols.map((c) => c.label), { bold: true, fond: rgb(0.98, 0.92, 0.87) });
      for (const { c, s } of retenus) {
        const statut = s ? STATUT[s.statut] ?? s.statut : "Non émargé";
        const mode = !s ? "-" : s.mode === "code"
          ? `Signé le ${horodatage(s.signe_at)}`
          : "Déclaré par le formateur";
        ligne([fmtJour(c.date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }),
          DEMI[c.demi_journee] ?? c.demi_journee, fmtHeures(Number(c.heures || 0)), statut, mode]);
      }
      ligne(["Total des heures de présence", "", fmtHeures(totalH), "", ""], { bold: true, fond: rgb(0.95, 0.95, 0.96), fusion: 2 });
      y -= 16;

      text("Pour servir et valoir ce que de droit.");
      y -= 6;
      text(`Fait à ${lieuSig}, le ${fmtJour(aujourdhui)}.`);
      // Le libellé et le cachet restent ensemble sur la même page.
      const sigW = 170; const sigH = signature ? (signature.height / signature.width) * sigW : 0;
      if (y - 16 - sigH < margin + 20) { page = pdf.addPage([W, H]); y = H - margin; }
      text("Signature et cachet de l'organisme :");
      if (signature) page.drawImage(signature, { x: margin, y: y - sigH, width: sigW, height: sigH });

      const foot = clean(`${orgNom} — ${org.email ?? ""} — SIRET ${org.siret ?? ""} — NDA ${org.nda ?? ""}`);
      page.drawText(foot.slice(0, 120), { x: margin, y: margin - 20, size: 7.5, font, color: rgb(0.5, 0.5, 0.55) });
    }

    const bytes = await pdf.save();
    return new Response(bytes, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/octet-stream" },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur serveur" }, 500);
  }
});

/** Horodatage d'une signature à l'heure de La Réunion : « 12/10/2026 09:14 ». */
function horodatage(iso: string): string {
  const { date, heure } = partiesLocales(new Date(iso));
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)} ${heure}`;
}

function wrap(text: string, f: PDFFont, size: number, width: number): string[] {
  const words = clean(text).split(/\s+/);
  const lines: string[] = []; let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (f.widthOfTextAtSize(test, size) > width) { if (line) lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
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

