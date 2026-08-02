// Edge Function PUBLIQUE — signature électronique d'un document.
// verify_jwt=false : le signataire n'a pas de compte. La clé service_role est
// utilisée côté serveur (jamais exposée) pour lire/écrire malgré la RLS.
//
// Niveau eIDAS « simple » : lien tokenisé + code à usage unique envoyé par
// e-mail. Le code n'est jamais stocké en clair. Chaque signature laisse un
// journal de preuve (horodatage, IP, agent, empreinte SHA-256 du document avant
// et après), et une page « Preuve de signature électronique » est ajoutée au PDF.
//
//   action 'get'  → état de la demande (libellé, signataire, statut)
//   action 'code' → génère et envoie le code
//   action 'sign' → vérifie le code, incruste la preuve, archive le document signé
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
    .replace(/…/g, "...").replace(/[•·]/g, "-").replace(/ /g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\xFF€]/g, "");
}

const MAX_TENTATIVES = 5;
const CODE_VALIDITE_MIN = 30;

/** Empreinte hexadécimale SHA-256. */
async function sha256(data: Uint8Array | string): Promise<string> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Le code est lié au jeton : une empreinte volée ne vaut pour aucune autre demande. */
const hashCode = (token: string, code: string) => sha256(`${token}:${code}`);
const genCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");

/** IP réelle derrière le proxy Supabase. */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "inconnue";
}

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

    const { data: dem } = await sb.from("signatures").select("*").eq("token", token).maybeSingle();
    if (!dem) return json({ error: "Lien invalide ou demande supprimée." }, 404);

    const expire = new Date(dem.expire_at).getTime() < Date.now();
    const etat = {
      libelle: dem.libelle,
      signataire_nom: dem.signataire_nom,
      // L'adresse n'est renvoyée que masquée : le lien peut circuler.
      email_masque: String(dem.signataire_email).replace(/^(.).*(@.*)$/, "$1•••$2"),
      statut: dem.statut,
      signe_at: dem.signe_at,
      expire,
      code_envoye: Boolean(dem.code_envoye_at) && !expire,
    };

    if (action === "get") return json(etat);

    if (dem.statut === "signee") return json({ ...etat, error: "Ce document est déjà signé." }, 409);
    if (dem.statut === "annulee") return json({ ...etat, error: "Cette demande a été annulée." }, 409);
    if (expire) return json({ ...etat, error: "Ce lien a expiré. Demandez-en un nouveau à votre conseiller." }, 410);

    // ── Envoi (ou renvoi) du code à usage unique ──
    if (action === "code") {
      const code = genCode();
      const { error } = await sb.from("signatures").update({
        code_hash: await hashCode(token, code),
        code_envoye_at: new Date().toISOString(),
        code_expire_at: new Date(Date.now() + CODE_VALIDITE_MIN * 60_000).toISOString(),
        tentatives: 0,
      }).eq("id", dem.id);
      if (error) return json({ error: error.message }, 500);

      const html = `
        <p>Bonjour ${clean(dem.signataire_nom)},</p>
        <p>Voici votre code de signature pour le document «&nbsp;<strong>${clean(dem.libelle)}</strong>&nbsp;» :</p>
        <p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:20px 0">${code}</p>
        <p>Ce code est valable ${CODE_VALIDITE_MIN} minutes. Saisissez-le sur la page de signature pour valider.</p>
        <p style="color:#64748b;font-size:13px">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : sans le code, aucune signature n'est possible.</p>
        <p>L'équipe Aissociate</p>`;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE}` },
        body: JSON.stringify({ to: dem.signataire_email, subject: `Code de signature — ${dem.libelle}`, html }),
      });
      if (!r.ok) return json({ error: "Envoi du code impossible. Vérifiez la configuration SMTP." }, 502);
      return json({ ...etat, code_envoye: true, validite_minutes: CODE_VALIDITE_MIN });
    }

    // ── Vérification du code et signature ──
    if (action === "sign") {
      const code = String(body.code ?? "").trim();
      const nomSaisi = String(body.nom ?? "").trim();
      if (!code) return json({ error: "Saisissez le code reçu par e-mail." }, 400);
      if (nomSaisi.length < 3) return json({ error: "Saisissez vos nom et prénom." }, 400);
      if (!dem.code_hash) return json({ error: "Demandez d'abord l'envoi du code." }, 400);
      if (dem.tentatives >= MAX_TENTATIVES) {
        return json({ error: "Trop de tentatives. Demandez un nouveau code." }, 429);
      }
      if (dem.code_expire_at && new Date(dem.code_expire_at).getTime() < Date.now()) {
        return json({ error: "Code expiré. Demandez-en un nouveau." }, 410);
      }
      if ((await hashCode(token, code)) !== dem.code_hash) {
        await sb.from("signatures").update({ tentatives: dem.tentatives + 1 }).eq("id", dem.id);
        const reste = MAX_TENTATIVES - dem.tentatives - 1;
        return json({ error: `Code incorrect. ${reste > 0 ? `${reste} tentative(s) restante(s).` : "Demandez un nouveau code."}` }, 400);
      }

      // Document d'origine
      const { data: blob, error: dlErr } = await sb.storage.from(dem.bucket).download(dem.fichier_url);
      if (dlErr || !blob) return json({ error: "Document introuvable." }, 404);
      const avant = new Uint8Array(await blob.arrayBuffer());
      const hashAvant = await sha256(avant);

      const ip = clientIp(req);
      const ua = req.headers.get("user-agent") ?? "inconnu";
      const quand = new Date();

      // Page de preuve ajoutée au document — la signature reste lisible même
      // si le PDF est ré-imprimé ou transmis hors du CRM.
      const pdf = await PDFDocument.load(avant, { ignoreEncryption: true });
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const page = pdf.addPage([595.28, 841.89]);
      const M = 52;
      let y = 841.89 - M;
      const ink = rgb(0.12, 0.12, 0.16);
      const muted = rgb(0.42, 0.42, 0.47);
      const T = (s: string, size = 10, f = font, color = ink) => {
        page.drawText(clean(s), { x: M, y, size, font: f, color });
        y -= size * 1.7;
      };

      T("PREUVE DE SIGNATURE ÉLECTRONIQUE", 15, bold);
      y -= 6;
      page.drawLine({ start: { x: M, y: y + 8 }, end: { x: 595.28 - M, y: y + 8 }, thickness: 0.8, color: rgb(0.8, 0.8, 0.84) });
      y -= 10;
      T(`Document : ${dem.libelle}`, 11, bold);
      y -= 4;
      T(`Signé par : ${nomSaisi}`);
      T(`Destinataire de la demande : ${dem.signataire_nom} <${dem.signataire_email}>`);
      T(`Date et heure : ${quand.toLocaleString("fr-FR", { timeZone: "Indian/Reunion" })} (heure de La Réunion)`);
      T(`Adresse IP : ${ip}`);
      T(`Navigateur : ${ua.slice(0, 90)}`, 8, font, muted);
      y -= 6;
      T("Méthode de vérification", 11, bold);
      y -= 4;
      T("Code à usage unique à 6 chiffres transmis à l'adresse e-mail ci-dessus,");
      T(`saisi et validé le ${quand.toLocaleString("fr-FR", { timeZone: "Indian/Reunion" })}.`);
      y -= 6;
      T("Intégrité du document", 11, bold);
      y -= 4;
      T("Empreinte SHA-256 du document avant signature :", 9);
      T(hashAvant, 7.5, font, muted);
      y -= 10;
      T(
        "Signature électronique simple au sens du règlement (UE) n° 910/2014 (eIDAS).",
        8, font, muted,
      );
      T(
        "Ce document et son journal de preuve sont conservés par l'organisme de formation.",
        8, font, muted,
      );

      const apres = await pdf.save();
      const hashApres = await sha256(apres);

      const cheminSigne = `signe-${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await sb.storage.from(dem.bucket)
        .upload(cheminSigne, apres, { contentType: "application/pdf", upsert: false });
      if (upErr) return json({ error: `Archivage impossible : ${upErr.message}` }, 500);

      const { error: majErr } = await sb.from("signatures").update({
        statut: "signee",
        signe_at: quand.toISOString(),
        signature_nom: nomSaisi,
        fichier_signe_url: cheminSigne,
        hash_avant: hashAvant,
        hash_apres: hashApres,
        ip, user_agent: ua,
        code_hash: null,            // le code est consommé
        code_expire_at: null,
      }).eq("id", dem.id);
      if (majErr) return json({ error: majErr.message }, 500);

      return json({ ok: true, statut: "signee", signe_at: quand.toISOString(), libelle: dem.libelle });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
