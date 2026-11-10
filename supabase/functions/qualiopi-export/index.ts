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

    const [criteresR, indicateursR, preuvesR, documentsR, sessionsR, ddocsR, participantsR, positionnementsR, evaluationsR, emCreneauxR, emSignaturesR, orgR] =
      await Promise.all([
        sb.from("qualiopi_criteres").select("*").order("numero"),
        sb.from("qualiopi_indicateurs").select("*").order("numero"),
        sb.from("qualiopi_preuve_document").select("*"),
        sb.from("documents").select("*"),
        sb.from("sessions_formation").select("*").order("date_debut"),
        sb.from("qualiopi_dossier_docs").select("*"),
        sb.from("session_participants").select("*"),
        sb.from("positionnements").select("*"),
        sb.from("evaluations").select("*"),
        sb.from("emargement_creneaux").select("*").order("date"),
        sb.from("emargement_signatures").select("*"),
        sb.from("parametres").select("valeur").eq("cle", "organisme").maybeSingle(),
      ]);

    const criteres = criteresR.data ?? [];
    const indicateurs = indicateursR.data ?? [];
    const preuves = preuvesR.data ?? [];
    const documents = documentsR.data ?? [];
    const sessions = sessionsR.data ?? [];
    const ddocs = ddocsR.data ?? [];
    const participants = participantsR.data ?? [];
    const positionnements = positionnementsR.data ?? [];
    const evaluations = evaluationsR.data ?? [];
    const emCreneaux = emCreneauxR.data ?? [];
    const emSignatures = emSignaturesR.data ?? [];
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
        // Preuves de l'organisme + pieces de dossier faites (generees, recues, signees, validees).
        const nb = preuves.filter((p: Record<string, unknown>) => p.indicateur_numero === ind.numero).length
          + ddocs.filter((d: Record<string, unknown>) => d.indicateur_numero === ind.numero
              && ["valide", "signe", "recu", "genere"].includes(d.statut as string)).length;
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
    // Chaque piece est lue dans SON bucket : « qualiopi » (generee ou televersee
    // ici), « plans » ou « pieces » quand la synchronisation l'a cochee depuis
    // une convention, un plan ou une piece du dossier client.
    type Row = Record<string, unknown>;
    const memePersonne = (x: Row, p: Row) =>
      (!!p.contact_id && x.contact_id === p.contact_id)
      || (!!p.email && !!x.email && String(x.email).toLowerCase() === String(p.email).toLowerCase());
    const nomDe = (p: Row) => [p.prenom, p.nom].filter(Boolean).join(" ").trim() || String(p.nom ?? "");
    const libres = (r: unknown) => Object.entries((r ?? {}) as Record<string, unknown>)
      .map(([k, v]) => `- ${k} : ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);

    for (const s of sessions) {
      const sDir = `Dossiers de formation/${safe(s.titre as string)} (${String(s.date_debut).slice(0, 10)})`;
      const parts = participants.filter((p: Row) => p.session_id === s.id);
      const partById = new Map(parts.map((p: Row) => [p.id, p]));
      const sDocs = ddocs.filter((x: Row) => x.session_id === s.id);

      for (const d of sDocs) {
        if (!d.fichier_url) continue;
        const bytes = await fetchBytes(d.fichier_url as string, (d.bucket as string) || "qualiopi");
        if (!bytes) continue;
        const qui = d.participant_id ? ` - ${safe(nomDe((partById.get(d.participant_id) ?? {}) as Row))}` : "";
        files[`${sDir}/${safe(d.libelle as string)}${qui}.${extOf(d.fichier_url as string)}`] = bytes;
      }

      // Emargement : releve des signatures (aucun fichier, la preuve est la trace).
      const creneaux = emCreneaux.filter((c: Row) => c.session_id === s.id);
      if (creneaux.length) {
        const lignes = [`Emargement - ${s.titre}`, ""];
        for (const c of creneaux) {
          lignes.push(`${String(c.date).slice(0, 10)} ${c.demi_journee ?? ""} (${c.heures ?? "-"} h)`);
          for (const p of parts) {
            const sig = emSignatures.find((x: Row) => x.creneau_id === c.id && x.participant_id === p.id);
            lignes.push(`  - ${nomDe(p)} : ${sig ? `${sig.statut} (${sig.mode ?? "-"}, ${String(sig.signe_at ?? sig.code_at ?? "").slice(0, 16)})` : "non signe"}`);
          }
        }
        files[`${sDir}/Emargement - releve des signatures.txt`] = strToU8(clean(lignes.join("\n")));
      }

      // Positionnements et evaluations des participants (reponses completes).
      for (const p of parts) {
        for (const pos of positionnements.filter((x: Row) => memePersonne(x, p) || (x.session_id === s.id && String(x.nom ?? "").toLowerCase().includes(String(p.nom ?? "~").toLowerCase())))) {
          const lignes = [
            `Positionnement a l'entree - ${nomDe(p)}`, `Complete le : ${String(pos.completed_at ?? "").slice(0, 10)}`,
            `Niveau : ${pos.niveau ?? "-"} (${pos.pct ?? "-"} %)`, "", String(pos.synthese ?? ""), "", ...libres(pos.reponses),
          ];
          files[`${sDir}/Reponses/Positionnement - ${safe(nomDe(p))}.txt`] = strToU8(clean(lignes.join("\n")));
        }
        for (const ev of evaluations.filter((x: Row) => memePersonne(x, p) && (!x.session_id || x.session_id === s.id))) {
          const lignes = [
            `Evaluation ${ev.type === "froid" ? "a froid" : "a chaud"} - ${nomDe(p)}`,
            `Completee le : ${String(ev.completed_at ?? "").slice(0, 10)}`,
            `Note globale : ${ev.note_globale ?? "-"}/5 - Recommandation : ${ev.nps ?? "-"}/10`, "",
            String(ev.synthese ?? ""), "", ...libres(ev.reponses),
          ];
          files[`${sDir}/Reponses/Evaluation ${ev.type} - ${safe(nomDe(p))}.txt`] = strToU8(clean(lignes.join("\n")));
        }
      }

      // Synthese de la checklist de la session.
      if (sDocs.length) {
        const synth = sDocs.map((d: Row) =>
          `${d.libelle}${d.participant_id ? ` - ${nomDe((partById.get(d.participant_id) ?? {}) as Row)}` : ""} : ${d.statut}`).join("\n");
        files[`${sDir}/_synthese_checklist.txt`] = strToU8(clean(synth));
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
