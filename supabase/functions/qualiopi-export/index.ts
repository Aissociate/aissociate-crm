// Edge Function — export ZIP de l'ensemble des preuves Qualiopi pour l'audit.
// Structure : 00_Index_conformite.pdf + Critere X / Indicateur YY / preuves…
//             + Dossiers de formation / Session / (documents + reponses).
// Le ZIP est depose dans le bucket prive « qualiopi » et une URL signee (7 j)
// est renvoyee.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { zipSync, strToU8 } from "npm:fflate@0.8.2";

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
// Nettoyage WinAnsi par code de caractere (sans regex a echappements).
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
// Nom de fichier/dossier sur pour un ZIP : translittere les accents en ASCII
// (evite le mojibake selon l'OS qui ouvre l'archive) et retire les caracteres
// interdits.
function safe(s: string): string {
  const norm = clean(s).normalize("NFD");
  let out = "";
  const bad = "/\\:*?\"<>|";
  for (let i = 0; i < norm.length; i++) {
    const c = norm.charCodeAt(i);
    if (c >= 768 && c <= 879) continue;       // marques diacritiques combinantes
    const ch = norm[i];
    out += bad.indexOf(ch) >= 0 ? "-" : (c > 126 ? "_" : ch);
  }
  out = out.replace(/\s+/g, " ").trim().slice(0, 80);
  return out || "sans-nom";
}
function extOf(url: string): string {
  const base = url.split("?")[0];
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "pdf";
  const ext = base.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : "pdf";
}
function isHttp(u: string): boolean {
  return u.slice(0, 7) === "http://" || u.slice(0, 8) === "https://";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { annee } = await req.json().catch(() => ({ annee: new Date().getFullYear() }));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [criteresR, indicateursR, preuvesR, documentsR, sessionsR, ddocsR, envoisR, reponsesR, modelesR, orgR] =
      await Promise.all([
        sb.from("qualiopi_criteres").select("*").order("numero"),
        sb.from("qualiopi_indicateurs").select("*").order("numero"),
        sb.from("qualiopi_preuve_document").select("*"),
        sb.from("documents").select("*"),
        sb.from("sessions_formation").select("*").order("date_debut"),
        sb.from("qualiopi_dossier_docs").select("*"),
        sb.from("questionnaire_envois").select("*"),
        sb.from("questionnaire_reponses").select("*"),
        sb.from("questionnaire_modeles").select("*"),
        sb.from("parametres").select("valeur").eq("cle", "organisme").maybeSingle(),
      ]);

    const criteres = criteresR.data ?? [];
    const indicateurs = indicateursR.data ?? [];
    const preuves = preuvesR.data ?? [];
    const documents = documentsR.data ?? [];
    const sessions = sessionsR.data ?? [];
    const ddocs = ddocsR.data ?? [];
    const envois = envoisR.data ?? [];
    const reponses = reponsesR.data ?? [];
    const modeles = modelesR.data ?? [];
    const org = (orgR.data?.valeur ?? {}) as Record<string, string>;

    const docById = new Map(documents.map((d: Record<string, unknown>) => [d.id, d]));
    const files: Record<string, Uint8Array> = {};

    const fetchBytes = async (fichier_url: string, bucket: string): Promise<Uint8Array | null> => {
      try {
        if (isHttp(fichier_url)) {
          const r = await fetch(fichier_url);
          if (!r.ok) return null;
          return new Uint8Array(await r.arrayBuffer());
        }
        const { data, error } = await sb.storage.from(bucket).download(fichier_url);
        if (error || !data) return null;
        return new Uint8Array(await data.arrayBuffer());
      } catch { return null; }
    };

    const CONF: Record<string, string> = {
      conforme: "CONFORME", a_completer: "A COMPLETER", non_applicable: "NON APPLICABLE", a_verifier: "A VERIFIER",
    };

    // ── Index PDF de conformite ──
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
    const brand = rgb(0.917, 0.416, 0.118);
    let page = pdf.addPage([595, 842]);
    let y = 786;
    const line = (t: string, size = 9.5, f = font, color = rgb(0.15, 0.15, 0.2), x = 48) => {
      if (y < 56) { page = pdf.addPage([595, 842]); y = 786; }
      page.drawText(clean(t).slice(0, 110), { x, y, size, font: f, color });
      y -= size + 4;
    };
    line((org.nom || "AIssociate").toUpperCase(), 16, fontB, brand);
    line(`Dossier de preuves Qualiopi - Audit ${annee}`, 13, fontB);
    line(`NDA ${org.nda ?? ""} - SIRET ${org.siret ?? ""}`, 9, font, rgb(0.4, 0.4, 0.45));
    y -= 10;
    for (const crit of criteres) {
      line(`Critere ${crit.numero} - ${crit.libelle}`, 11, fontB, brand);
      for (const ind of indicateurs.filter((i: Record<string, unknown>) => i.critere === crit.numero)) {
        const nb = preuves.filter((p: Record<string, unknown>) => p.indicateur_numero === ind.numero).length;
        line(`  #${ind.numero} ${ind.intitule}  -  ${CONF[ind.statut as string] ?? ind.statut}  (${nb} preuve(s))`, 9);
      }
      y -= 4;
    }
    files["00_Index_conformite.pdf"] = new Uint8Array(await pdf.save());

    // ── Preuves ORGANISME par critere / indicateur ──
    for (const crit of criteres) {
      const critDir = `Critere ${crit.numero} - ${safe(crit.libelle)}`;
      for (const ind of indicateurs.filter((i: Record<string, unknown>) => i.critere === crit.numero)) {
        const indPreuves = preuves.filter((p: Record<string, unknown>) => p.indicateur_numero === ind.numero);
        for (const p of indPreuves) {
          const d = docById.get(p.document_id) as Record<string, unknown> | undefined;
          if (!d?.fichier_url) continue;
          const bucket = d.categorie === "qualiopi" ? "qualiopi" : "documents";
          const bytes = await fetchBytes(d.fichier_url as string, bucket);
          if (!bytes) continue;
          const fname = `${safe(d.titre as string)}.${extOf(d.fichier_url as string)}`;
          files[`${critDir}/Indicateur ${String(ind.numero).padStart(2, "0")}/${fname}`] = bytes;
        }
      }
    }

    // ── Dossiers de formation (niveau B) ──
    const modeleByCode = new Map(modeles.map((m: Record<string, unknown>) => [m.code, m]));
    const envoiById = new Map(envois.map((e: Record<string, unknown>) => [e.id, e]));
    for (const s of sessions) {
      const sDir = `Dossiers de formation/${safe(s.titre as string)} (${String(s.date_debut).slice(0, 10)})`;
      for (const d of ddocs.filter((x: Record<string, unknown>) => x.session_id === s.id)) {
        if (!d.fichier_url) continue;
        const bytes = await fetchBytes(d.fichier_url as string, "qualiopi");
        if (!bytes) continue;
        files[`${sDir}/${safe(d.libelle as string)}.${extOf(d.fichier_url as string)}`] = bytes;
      }
      const sEnvois = envois.filter((e: Record<string, unknown>) => e.session_id === s.id);
      for (const rep of reponses) {
        const env = envoiById.get((rep as Record<string, unknown>).envoi_id) as Record<string, unknown> | undefined;
        if (!env || env.session_id !== s.id) continue;
        const m = modeleByCode.get(env.modele_code) as Record<string, unknown> | undefined;
        const lines = [
          `Questionnaire : ${m?.titre ?? env.modele_code}`,
          `Destinataire : ${env.destinataire_nom ?? ""} (${env.destinataire_email ?? ""})`,
          `Note globale : ${(rep as Record<string, unknown>).note_globale ?? "-"}/5`, "",
          ...Object.entries(((rep as Record<string, unknown>).reponses ?? {}) as Record<string, unknown>)
            .map(([k, v]) => `- ${k} : ${String(v)}`),
        ];
        files[`${sDir}/Reponses/${safe(String(m?.titre ?? env.modele_code))} - ${safe(String(env.destinataire_nom ?? env.id))}.txt`] =
          strToU8(clean(lines.join("\n")));
      }
      if (sEnvois.length) {
        const synth = sEnvois.map((e: Record<string, unknown>) =>
          `${e.modele_code} - ${e.destinataire_nom ?? ""} - ${e.statut}`).join("\n");
        files[`${sDir}/_synthese_questionnaires.txt`] = strToU8(clean(synth));
      }
    }

    // ── Generation du ZIP ──
    const zipped = zipSync(files, { level: 6 });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const zipPath = `exports/audit-qualiopi-${annee}-${stamp}.zip`;
    const { error: upErr } = await sb.storage.from("qualiopi").upload(zipPath, zipped, {
      contentType: "application/zip", upsert: true,
    });
    if (upErr) return json({ error: upErr.message }, 500);

    const { data: signed } = await sb.storage.from("qualiopi").createSignedUrl(zipPath, 60 * 60 * 24 * 7);
    return json({ ok: true, url: signed?.signedUrl ?? null, path: zipPath, fichiers: Object.keys(files).length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur serveur" }, 500);
  }
});
