// Supabase Edge Function — documents AGEFICE d'un parcours de formation.
//
// Quatre productions, aux quatre moments du parcours :
//   • `demande`     — DEMANDE PRÉALABLE DE FINANCEMENT D'UNE ACTION DE FORMATION
//     (avant la formation). Le PDF AGEFICE est un vrai AcroForm : on renseigne
//     ce que le CRM connaît et on NE L'APLATIT PAS, pour que le demandeur
//     complète sa partie (état civil, n° de sécurité sociale, diplôme…) et signe.
//   • `convention`  — CONVENTION DE FORMATION PROFESSIONNELLE (avant la formation).
//   • `emargement`  — FEUILLE D'ÉMARGEMENT (pendant la formation).
//   • `attestation` — ATTESTATION D'ASSIDUITÉ DE FORMATION ET DE RÈGLEMENT (après).
//
// Les modèles AGEFICE des trois derniers sont des PDF plats, sans champ : ils
// sont reconstruits, sur papier à en-tête de l'organisme comme l'exigent les
// modèles. Seule la demande préalable est un formulaire remplissable.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Les polices standard PDF sont encodées WinAnsi : on retire ce qui n'y entre pas.
function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
    .replace(/…/g, "...").replace(/[•·]/g, "-").replace(/ /g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\xFF€]/g, "");
}
const eur = (n: number) => `${(Number(n) || 0).toFixed(2).replace(".", ",")} €`;
const frDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");
const aujourdhui = () => new Date().toLocaleDateString("fr-FR");

const TYPES = ["demande", "convention", "emargement", "attestation"] as const;
type TypeDoc = typeof TYPES[number];
const LIBELLE: Record<TypeDoc, string> = {
  demande: "Demande préalable de financement AGEFICE",
  convention: "Convention de formation AGEFICE",
  emargement: "Feuille d'émargement AGEFICE",
  attestation: "Attestation d'assiduité et de règlement AGEFICE",
};

// URL par défaut du formulaire officiel. AGEFICE le republie chaque campagne :
// l'adresse est surchargeable dans Paramètres (clé `agefice`.demande_url).
const DEMANDE_URL_DEFAUT =
  "https://communication-agefice.fr/wp-content/uploads/2025/12/AGEFICE-Demande-de-prise-en-charge-2025-2026-Editable.pdf";

type Org = Record<string, string>;
type AgeficeCfg = {
  demande_url?: string;
  prefet_region?: string;
  responsable_civilite?: string; responsable_nom?: string; responsable_prenom?: string;
  responsable_qualite?: string; responsable_tel?: string; responsable_email?: string;
};

/** Clé de cache du gabarit dans le bucket `documents`, dérivée de son URL. */
function cacheKey(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
  return `agefice/gabarit-demande-${(h >>> 0).toString(36)}.pdf`;
}

/**
 * Gabarit officiel : servi depuis le Storage s'il y est déjà, sinon téléchargé
 * chez AGEFICE puis mis en cache. Évite de dépendre du site à chaque génération.
 */
// deno-lint-ignore no-explicit-any
async function chargerGabarit(sb: any, url: string): Promise<Uint8Array> {
  const key = cacheKey(url);
  const { data: cached } = await sb.storage.from("documents").download(key);
  if (cached) return new Uint8Array(await cached.arrayBuffer());

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Formulaire AGEFICE inaccessible (${resp.status}) à l'adresse ${url}`);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  try {
    await sb.storage.from("documents").upload(key, bytes, { contentType: "application/pdf", upsert: true });
  } catch (e) { console.error("cache gabarit", e); }
  return bytes;
}

/** Comparaison tolérante des noms de champs (espaces multiples, casse). */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const CIVILITE_MME = /^(mme|madame)$/i;

/** Forme juridique CRM → option exacte de la liste déroulante AGEFICE. */
const FORME_JURIDIQUE: Record<string, string> = {
  EI: "ENTREPRISE INDIVIDUELLE",
  "ENTREPRISE INDIVIDUELLE": "ENTREPRISE INDIVIDUELLE",
  "MICRO-ENTREPRISE": "MICRO-ENTREPRISE / AUTO-ENTREPRISE",
  "AUTO-ENTREPRISE": "MICRO-ENTREPRISE / AUTO-ENTREPRISE",
  SARL: "SARL",
  EURL: "SARL", // EURL = SARL à associé unique
  EIRL: "EIRL",
  SA: "SA",
  SAS: "SAS",
  SASU: "SASU",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json();
    const planId: string | undefined = body.planId;
    const type = (body.type ?? "demande") as TypeDoc;
    const userId: string | null = body.userId ?? null;
    if (!planId) return json({ error: "planId manquant" }, 400);
    if (!TYPES.includes(type)) return json({ error: `type inconnu (${TYPES.join(" | ")})` }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Contexte commun ──
    const { data: plan } = await sb.from("plans_formation").select("*").eq("id", planId).maybeSingle();
    if (!plan) return json({ error: "Plan de formation introuvable" }, 404);

    const { data: contact } = plan.contact_id
      ? await sb.from("contacts").select("*").eq("id", plan.contact_id).maybeSingle() : { data: null };
    let { data: entreprise } = plan.entreprise_id
      ? await sb.from("entreprises").select("*").eq("id", plan.entreprise_id).maybeSingle() : { data: null };
    if (!entreprise && contact?.entreprise_id) {
      const r = await sb.from("entreprises").select("*").eq("id", contact.entreprise_id).maybeSingle();
      entreprise = r.data;
    }
    const { data: formation } = plan.formation_id
      ? await sb.from("formations").select("*").eq("id", plan.formation_id).maybeSingle() : { data: null };
    // Prix : devis du même dossier, à défaut celui du contact — le plus récent.
    let devis = null;
    if (plan.dossier_id) {
      const r = await sb.from("devis").select("*").eq("dossier_id", plan.dossier_id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      devis = r.data;
    }
    if (!devis && plan.contact_id) {
      const r = await sb.from("devis").select("*").eq("contact_id", plan.contact_id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      devis = r.data;
    }
    // Sessions planifiées du dossier → dates réelles de l'action de formation.
    let sessions: { id: string; date_debut: string; date_fin: string | null; lieu: string | null; formateur: string | null }[] = [];
    if (plan.dossier_id) {
      const r = await sb.from("sessions_formation")
        .select("id, date_debut, date_fin, lieu, formateur").eq("dossier_id", plan.dossier_id).order("date_debut");
      sessions = r.data ?? [];
    }

    // Émargements réellement collectés : demi-journées, participants et
    // signatures (par code du stagiaire ou déclarées par le formateur). La
    // feuille d'émargement générée les reprend, plutôt que d'imprimer une
    // grille vierge quand la présence a déjà été recueillie en ligne.
    type Creneau = { id: string; session_id: string; date: string; demi_journee: string; heures: number };
    type Participant = { id: string; session_id: string; nom: string; prenom: string | null };
    type Presence = { creneau_id: string; participant_id: string; statut: string; mode: string; signe_at: string };
    let creneaux: Creneau[] = [];
    let participants: Participant[] = [];
    let presences: Presence[] = [];
    const sessionIds = sessions.map((s) => s.id);
    if (type === "emargement" && sessionIds.length) {
      const [rc, rp] = await Promise.all([
        sb.from("emargement_creneaux").select("id, session_id, date, demi_journee, heures")
          .in("session_id", sessionIds).order("date").order("demi_journee"),
        sb.from("session_participants").select("id, session_id, nom, prenom")
          .in("session_id", sessionIds).order("nom"),
      ]);
      creneaux = rc.data ?? [];
      participants = rp.data ?? [];
      if (creneaux.length) {
        const rs = await sb.from("emargement_signatures")
          .select("creneau_id, participant_id, statut, mode, signe_at")
          .in("creneau_id", creneaux.map((c) => c.id));
        presences = rs.data ?? [];
      }
    }
    const { data: orgRow } = await sb.from("parametres").select("valeur").eq("cle", "organisme").maybeSingle();
    const org = (orgRow?.valeur ?? {}) as Org;
    const { data: cfgRow } = await sb.from("parametres").select("valeur").eq("cle", "agefice").maybeSingle();
    const cfg = (cfgRow?.valeur ?? {}) as AgeficeCfg;
    const { data: auteur } = userId
      ? await sb.from("profiles").select("nom, prenom, telephone, email").eq("id", userId).maybeSingle()
      : { data: null };

    const apprenant = [contact?.prenom, contact?.nom].filter(Boolean).join(" ");
    const intitule = plan.nom || formation?.intitule || "Formation";
    const prixHT = Number(devis?.total_ht ?? 0);
    const dureeH = Number(plan.duree_heures ?? formation?.duree_heures ?? 0);
    const formateur = String(body.formateur ?? sessions[0]?.formateur ?? formation?.formateur ?? "");
    const dateDebut = sessions[0]?.date_debut ?? null;
    const dateFin = sessions.at(-1)?.date_fin ?? sessions.at(-1)?.date_debut ?? null;
    const datesTexte = plan.dates_session
      || (dateDebut ? `du ${frDate(dateDebut)}${dateFin && dateFin !== dateDebut ? ` au ${frDate(dateFin)}` : ""}` : "");
    const lieuFormation = String(
      body.lieu ?? sessions[0]?.lieu
      ?? [entreprise?.adresse, entreprise?.code_postal, entreprise?.ville].filter(Boolean).join(" ")
      ?? "",
    ) || [org.adresse, org.code_postal, org.ville].filter(Boolean).join(" ");
    const representant = [cfg.responsable_prenom, cfg.responsable_nom].filter(Boolean).join(" ");

    // ═════════════════════════════════════════════════════════════════════════
    // Demande préalable : remplissage du formulaire officiel, laissé éditable
    // ═════════════════════════════════════════════════════════════════════════
    async function construireDemande(): Promise<Uint8Array> {
      const gabarit = await chargerGabarit(sb, cfg.demande_url || DEMANDE_URL_DEFAUT);
      const pdf = await PDFDocument.load(gabarit, { ignoreEncryption: true });
      const form = pdf.getForm();

      // Index tolérant : le formulaire AGEFICE contient des doubles espaces et
      // des suffixes irréguliers dans les noms de champs.
      const index = new Map<string, string>();
      for (const f of form.getFields()) index.set(norm(f.getName()), f.getName());
      const nomReel = (label: string) => index.get(norm(label));

      const setText = (label: string, value: unknown) => {
        let v = clean(value).trim();
        if (!v) return;
        const name = nomReel(label);
        if (!name) { console.error(`champ absent: ${label}`); return; }
        try {
          const tf = form.getTextField(name);
          // Plusieurs champs (téléphones, SIRET) imposent une longueur maximale :
          // on compacte les espaces puis on tronque plutôt que d'échouer.
          const max = tf.getMaxLength();
          if (max != null && v.length > max) {
            const compact = v.replace(/\s/g, "");
            v = (compact.length <= max ? compact : compact.slice(0, max));
          }
          tf.setText(v);
        } catch (e) { console.error(`champ texte ${label}`, e); }
      };
      const setCheck = (label: string, on: boolean) => {
        if (!on) return;
        const name = nomReel(label);
        if (!name) { console.error(`case absente: ${label}`); return; }
        try { form.getCheckBox(name).check(); } catch (e) { console.error(`case ${label}`, e); }
      };
      const setChoix = (label: string, value: string | undefined) => {
        if (!value) return;
        const name = nomReel(label);
        if (!name) return;
        try {
          const dd = form.getDropdown(name);
          if (dd.getOptions().includes(value)) dd.select(value);
        } catch (e) { console.error(`liste ${label}`, e); }
      };

      // Entreprise du bénéficiaire
      setText("Nom / Raison Sociale de L'entreprise (Entreprise)", entreprise?.raison_sociale);
      setText("Code APE - NAF (Entreprise)", entreprise?.naf);
      setText("N° SIRET (Entreprise)", entreprise?.siret || contact?.siret);
      setText("Activité Professionnelle (Entreprise)", entreprise?.secteur);
      setChoix("Forme juridique (Entreprise)", FORME_JURIDIQUE[String(entreprise?.statut_juridique ?? "").toUpperCase()]);
      setText("Adresse Entreprise", entreprise?.adresse);
      setText("Code Postal (Entreprise)", entreprise?.code_postal);
      setText("Ville (Entreprise)", entreprise?.ville);

      // Stagiaire — l'état civil détaillé reste à compléter par le demandeur.
      const civ = String(contact?.civilite ?? "").trim();
      setCheck("MME (Stagiaire)", CIVILITE_MME.test(civ));
      setCheck("MR (Stagiaire)", Boolean(civ) && !CIVILITE_MME.test(civ));
      setText("Nom (Stagiaire)", contact?.nom);
      setText("Prénom (Stagiaire)", contact?.prenom);
      setText("N° de Téléphone (Stagiaire)", contact?.telephone);
      setText("Adresse Email (Stagiaire)", contact?.email);

      // Organisme de formation (nous)
      setText("Raison Sociale ( OF)", org.nom);
      setText("NDA (OF)", org.nda);
      setText("N° SIRET (OF)", org.siret);
      setText("Adresse (OF)", org.adresse);
      setText("Code Postal (OF)", org.code_postal);
      setText("Ville (OF)", org.ville);

      // Représentant légal de l'organisme (réglé une fois dans Paramètres)
      const rc = String(cfg.responsable_civilite ?? "").trim();
      setCheck("MME (Resp.OF)", CIVILITE_MME.test(rc));
      setCheck("MR (Resp.OF)", Boolean(rc) && !CIVILITE_MME.test(rc));
      setText("Nom Responsable (OF)", cfg.responsable_nom);
      setText("Prénom Responsable (OF)", cfg.responsable_prenom);
      setText("N° de Téléphone - Responsable (OF)", cfg.responsable_tel || org.telephone);
      setText("Adresse Email - Responsable (OF)", cfg.responsable_email || org.email);

      // Interlocuteur du dossier = utilisateur qui génère le document
      setText("Nom - Contact (OF)", auteur?.nom);
      setText("Prénom - Contact (OF)", auteur?.prenom);
      setText("N° de Téléphone - Contact (OF)", auteur?.telephone || org.telephone);
      setText("Adresse Email - Contact (OF)", auteur?.email || org.email);

      // Action de formation
      setCheck("Action de Formation", true);
      setText("Intitulé Exact ( Formation)", intitule);
      setText("Thématique (Formation)", formation?.intitule || plan.objectifs);
      setText("Nom du formateur", formateur);
      setText("Prix Ht (Formation)", prixHT ? eur(prixHT) : "");
      setText("Date de Début (Formation)", frDate(dateDebut));
      setText("Date de Fin (Formation)", frDate(dateFin));

      // Répartition de la durée selon la modalité du plan.
      const modalite = String(plan.modalite ?? "presentiel");
      if (dureeH > 0) {
        if (modalite === "distanciel" || modalite === "e-learning") setText("Durée ( FOAD Synchrone - Formation)", `${dureeH} h`);
        else setText("Durée ( Présentiel Collectif - Formation)", `${dureeH} h`);
      }

      setText("Code Postal (Lieu de Formation)", entreprise?.code_postal || org.code_postal);
      setText("Ville (Lieu de Formation)", entreprise?.ville || org.ville);
      setText("Nom et Adresse exacte du lieu de formation", lieuFormation);

      // Modalités pédagogiques et suivi (nom de champ à suffixe irrégulier)
      setText("Déroulement Pédagogique (Formation) - 1 -", (plan.contenu ?? []).join(" / "));
      setCheck("Feuilles de présence", true);
      setCheck("Attestation de Stage", true);
      setCheck("Sans Qualification", true);

      setText("Lieu de Signature", org.ville);
      setText("Date de Signature", aujourdhui());

      // `NeedAppearances` : les visionneuses regénèrent l'apparence des champs
      // remplis par programme. Surtout : PAS de form.flatten(), le document doit
      // rester complétable et signable par le demandeur.
      form.acroForm.dict.set(pdf.context.obj("NeedAppearances"), pdf.context.obj(true));
      return await pdf.save();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Convention / émargement / attestation : modèles AGEFICE reconstruits
    // ═════════════════════════════════════════════════════════════════════════
    async function construirePdfPlat(kind: Exclude<TypeDoc, "demande">): Promise<Uint8Array> {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const A4: [number, number] = [595.28, 841.89];
      const paysage: [number, number] = [841.89, 595.28];
      const ink = rgb(0.12, 0.12, 0.16);
      const muted = rgb(0.42, 0.42, 0.47);
      const line = rgb(0.78, 0.78, 0.82);
      const zebra = rgb(0.96, 0.96, 0.97);

      // La feuille d'émargement est un tableau large → format paysage.
      const format = kind === "emargement" ? paysage : A4;
      const W = format[0], H = format[1], M = 44;
      let page: PDFPage = pdf.addPage(format);
      let y = H - M;

      const T = (s: string, x: number, yy: number, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb> } = {}) => {
        page.drawText(clean(s), { x, y: yy, size: o.size ?? 10, font: o.f ?? font, color: o.color ?? ink });
      };
      const saut = (n = 1) => { y -= n * 14; if (y < M + 50) { page = pdf.addPage(format); y = H - M; } };
      const para = (s: string, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number } = {}) => {
        const size = o.size ?? 10, f = o.f ?? font, maxW = W - 2 * M - (o.indent ?? 0);
        for (const bloc of clean(s).split("\n")) {
          let ln = "";
          for (const w of bloc.split(/\s+/)) {
            const test = ln ? `${ln} ${w}` : w;
            if (f.widthOfTextAtSize(test, size) > maxW && ln) { T(ln, M + (o.indent ?? 0), y, { size, f, color: o.color }); saut(); ln = w; }
            else ln = test;
          }
          if (ln) { T(ln, M + (o.indent ?? 0), y, { size, f, color: o.color }); saut(); }
        }
      };
      /** Ligne « libellé : valeur » ; pointillés à compléter si la valeur manque. */
      const champ = (label: string, value: unknown, o: { size?: number } = {}) => {
        const size = o.size ?? 10;
        const v = clean(value).trim();
        T(label, M, y, { size, f: bold });
        const x = M + bold.widthOfTextAtSize(clean(label), size) + 4;
        const dispo = W - M - x;
        if (!v) {
          T(".".repeat(Math.max(0, Math.floor(dispo / (size * 0.28)))), x, y, { size, color: muted });
          saut();
          return;
        }
        // Une valeur trop longue pour tenir à droite du libellé (intitulé de
        // formation, adresse complète) déborderait de la page : on la renvoie
        // à la ligne, où `para` se charge de la découper.
        if (font.widthOfTextAtSize(v, size) <= dispo) {
          T(v, x, y, { size });
          saut();
          return;
        }
        saut();
        para(v, { size, indent: 12 });
      };
      /** En-tête « papier à en-tête de l'organisme », exigé par les modèles. */
      const enTete = (titre: string, modele: string) => {
        T(clean(org.nom ?? ""), M, y, { size: 14, f: bold }); saut();
        T(clean([org.adresse, [org.code_postal, org.ville].filter(Boolean).join(" ")].filter(Boolean).join(" - ")), M, y, { size: 9, color: muted }); saut(0.8);
        T(clean([org.telephone ? `Tél. ${org.telephone}` : "", org.email, org.site_web].filter(Boolean).join(" - ")), M, y, { size: 9, color: muted }); saut(0.8);
        T(clean([org.nda ? `NDA ${org.nda}` : "", org.siret ? `SIRET ${org.siret}` : ""].filter(Boolean).join(" - ")), M, y, { size: 9, color: muted }); saut(1.2);
        page.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.8, color: line });
        saut(0.6);
        T(titre, M, y, { size: 13, f: bold }); saut();
        T(modele, M, y, { size: 8, color: muted }); saut(1.5);
      };
      const signatures = (gauche: string, droite: string) => {
        saut(1.2);
        champ("Fait à :", org.ville);
        champ("Le :", aujourdhui());
        saut(1.6);
        T(gauche, M, y, { size: 10, f: bold });
        T(droite, W / 2 + 10, y, { size: 10, f: bold }); saut(0.9);
        T("(signature, nom et qualité du signataire)", M, y, { size: 8, color: muted });
        T("(signature, nom et qualité du signataire)", W / 2 + 10, y, { size: 8, color: muted }); saut(0.9);
        T("Cachet", M, y, { size: 8, color: muted });
        T("Cachet", W / 2 + 10, y, { size: 8, color: muted });
      };

      if (kind === "convention") {
        enTete("CONVENTION DE FORMATION PROFESSIONNELLE", "Modèle AGEFICE - Mars 2018");

        para("Entre les soussignés :", { f: bold }); saut(0.3);
        para(`1 - Organisme de formation : ${clean(org.nom)}, ${clean([org.adresse, org.code_postal, org.ville].filter(Boolean).join(" "))}`);
        champ("Enregistré sous le n° de déclaration d'activité :", org.nda);
        champ("auprès du préfet de région :", cfg.prefet_region);
        champ("représenté par :", representant);
        saut(0.4);
        para(`2 - L'entreprise : ${clean(entreprise?.raison_sociale ?? "")}${entreprise?.adresse ? `, ${clean([entreprise.adresse, entreprise.code_postal, entreprise.ville].filter(Boolean).join(" "))}` : ""}`);
        champ("représentée par :", apprenant);
        saut(0.5);

        para("Est conclue la convention suivante :", { f: bold }); saut(0.4);
        T("Article 1 :", M, y, { size: 11, f: bold }); saut();
        para("L'organisme de formation organise l'action de formation suivante :"); saut(0.3);
        champ("1 - Intitulé :", intitule);
        champ("2 - Nature de l'action (art. L.6313-1) :", "Action de formation");
        champ("3 - Dates de l'action de formation :", datesTexte);
        champ("4 - Durée et horaires :", dureeH ? `${dureeH} heures` : "");
        champ("5 - Lieu de l'action de formation :", lieuFormation);
        T("6 - Modalités de déroulement (moyens techniques et pédagogiques) :", M, y, { size: 10, f: bold }); saut();
        para((plan.contenu ?? []).length ? (plan.contenu as string[]).map((c) => `- ${c}`).join("\n") : "", { size: 9.5, indent: 10 });
        champ("7 - Type de formation :", plan.modalite);
        champ("8 - Sanction et modalités d'évaluation :", "Attestation de fin de formation - évaluation continue");
        champ("9 - Effectif (nom et prénom du/des stagiaire/s) :", apprenant);
        champ("10 - Moyen de contrôle de l'assiduité :", "Attestation d'assiduité et feuilles d'émargement");
        saut(0.6);

        T("Article 2 :", M, y, { size: 11, f: bold }); saut();
        para("En contrepartie de cette action de formation, le cocontractant s'engage à acquitter les frais suivants :"); saut(0.3);
        champ("Frais de formation (total) :", prixHT ? `${eur(prixHT)} H.T.` : "");
        champ("TVA :", "Exonérée (art. 261-4-4° a du CGI)");
        champ("TOTAL GENERAL :", prixHT ? `${eur(prixHT)} T.T.C.` : "");
        saut(0.6);

        T("Article 3 : Clause de dédit", M, y, { size: 11, f: bold }); saut();
        para("En cas d'inexécution totale ou partielle de la prestation de formation du fait du cocontractant, les sommes correspondant aux prestations non réalisées ne sont pas dues à l'organisme de formation, sauf annulation notifiée moins de 10 jours ouvrés avant le démarrage de l'action.", { size: 9.5 });
        saut(0.5);
        T("Article 4 :", M, y, { size: 11, f: bold }); saut();
        para("La présente convention prend effet à compter de sa signature par l'entreprise. Fait en double exemplaire.");
        signatures("Pour l'entreprise", "Pour l'organisme de formation");
      }

      if (kind === "attestation") {
        enTete("ATTESTATION D'ASSIDUITÉ DE FORMATION ET DE RÈGLEMENT", "Modèle AGEFICE - 2025/2026");

        para(`Je soussigné(e) ${clean(representant) || "..............................."} agissant en qualité de ${clean(cfg.responsable_qualite) || "..............................."} de ${clean(org.nom)}, enregistré sous le numéro de déclaration d'activité ${clean(org.nda) || "................"} auprès de la DREETS/DRIEETS/DEETS de ${clean(cfg.prefet_region) || "..............................."}, atteste que :`);
        saut(0.5);
        champ("- Madame ou Monsieur :", apprenant);
        champ("- de :", entreprise?.raison_sociale);
        para("- a bien suivi l'action de formation telle que détaillée ci-dessous.");
        saut(0.6);

        T("Formation concernée", M, y, { size: 11, f: bold }); saut(0.9);
        champ("Intitulé de formation :", intitule);
        champ("Date de démarrage :", frDate(dateDebut));
        champ("Date de fin :", frDate(dateFin));
        champ("Nom et qualité du formateur :", formateur);
        champ("Nombre de participants :", "1");
        saut(0.5);

        // Tableau des durées prévues / réalisées
        const cols = [M, M + 250, M + 355, W - M];
        const ligneTab = (l: string, prevu: string, realise: string, o: { f?: PDFFont; fond?: boolean } = {}) => {
          if (o.fond) page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 15, color: zebra });
          T(l, cols[0] + 4, y, { size: 9, f: o.f });
          T(prevu, cols[1] + 4, y, { size: 9, f: o.f });
          T(realise, cols[2] + 4, y, { size: 9, f: o.f });
          page.drawLine({ start: { x: M, y: y - 5 }, end: { x: W - M, y: y - 5 }, thickness: 0.5, color: line });
          saut(1.05);
        };
        ligneTab("Durée en heure(s)", "Prévue", "Réalisée", { f: bold, fond: true });
        const modalite = String(plan.modalite ?? "presentiel");
        const enPresentiel = modalite !== "distanciel" && modalite !== "e-learning";
        ligneTab("Durée en présentiel individuel", "", "");
        ligneTab("Durée en présentiel collectif", enPresentiel && dureeH ? `${dureeH} h` : "", enPresentiel && dureeH ? `${dureeH} h` : "");
        ligneTab("Durée en distanciel synchrone", !enPresentiel && dureeH ? `${dureeH} h` : "", !enPresentiel && dureeH ? `${dureeH} h` : "");
        ligneTab("Durée en distanciel asynchrone", "", "");
        saut(0.5);

        para("L'organisme de formation assure avoir réalisé la formation conformément aux modalités détaillées dans la demande préalable de financement d'action de formation et/ou dans la convention de formation signée avec le stagiaire et dans le respect des critères de financement de l'AGEFICE. Il assure avoir fourni la double assistance technique et pédagogique prévue par les textes et s'engage à conserver l'ensemble des pièces justificatives permettant de démontrer la réalité et le suivi de l'action, de l'accompagnement et de l'assistance du stagiaire.", { size: 8.5, color: muted });
        saut(0.4);

        T("Si la facture acquittée n'est pas transmise :", M, y, { size: 10, f: bold }); saut();
        para("J'atteste également que le bénéficiaire de cette action a bien réglé la totalité du coût pédagogique H.T. (ou de sa participation au coût pédagogique H.T.) pour un montant de :", { size: 9 });
        champ("Montant :", prixHT ? eur(prixHT) : "", { size: 9 });
        champ("En lettres :", "", { size: 9 });
        champ("Payé par :", "", { size: 9 });
        champ("En date(s) du :", "", { size: 9 });
        saut(0.4);
        para("L'AGEFICE se réserve le droit de suspendre les paiements en cas de non-conformité, de procéder à tout signalement auprès des autorités compétentes et d'initier toutes procédures, y compris juridictionnelles, en cas de fausses déclarations ou justificatifs mensongers.", { size: 8, color: muted });
        signatures("L'organisme de formation", "Le stagiaire");
      }

      if (kind === "emargement") {
        enTete("FEUILLE D'ÉMARGEMENT", "Modèle AGEFICE - Février 2016");

        champ("Intitulé de l'action de formation :", intitule);
        champ("Date(s) de l'action de formation :", datesTexte);
        champ("Durée de l'action de formation :", dureeH ? `${dureeH} heures` : "");
        champ("Horaires :", body.horaires ?? "");
        champ("Lieu de l'action de formation :", lieuFormation);
        saut(0.8);

        // Colonnes = journées réellement planifiées (demi-journées créées dans
        // le CRM), sinon les dates fournies ou celles des sessions, sinon une
        // grille vierge à signer à la main.
        const joursReels = [...new Set(creneaux.map((c) => c.date))].sort();
        const joursSaisis: string[] = joursReels.length
          ? joursReels
          : Array.isArray(body.dates) && body.dates.length
            ? (body.dates as string[])
            : sessions.map((s) => String(s.date_debut).slice(0, 10));
        const jours = (joursSaisis.length ? joursSaisis : ["", "", ""]).slice(0, 4);

        // Lignes = participants inscrits, sinon le bénéficiaire du plan.
        const lignes = participants.length
          ? participants.map((p) => ({ id: p.id, nom: [p.prenom, p.nom].filter(Boolean).join(" ") }))
          : [{ id: "", nom: apprenant || "" }];

        const creneauDe = new Map(creneaux.map((c) => [`${c.date}:${c.demi_journee}`, c.id]));
        const presenceDe = new Map(presences.map((s) => [`${s.creneau_id}:${s.participant_id}`, s]));
        const aDesSignatures = presences.length > 0;

        const xNom = M, wNom = 210;
        const wJour = (W - 2 * M - wNom) / jours.length;
        const xJour = (i: number) => M + wNom + i * wJour;

        page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 30, color: zebra });
        T("Nom et prénom", xNom + 4, y + 12, { size: 9, f: bold });
        jours.forEach((j, i) => {
          T(j ? `Date : ${frDate(j)}` : "Date :", xJour(i) + 4, y + 12, { size: 9, f: bold });
          T("Matin", xJour(i) + 4, y, { size: 8, color: muted });
          T("Après-midi", xJour(i) + wJour / 2 + 4, y, { size: 8, color: muted });
        });
        saut(1.6);

        /** Contenu d'une demi-journée : signature recueillie, ou case à signer. */
        const cellule = (participantId: string, jour: string, demi: string, x: number, yb: number, w: number) => {
          const cid = creneauDe.get(`${jour}:${demi}`);
          const s = cid && participantId ? presenceDe.get(`${cid}:${participantId}`) : undefined;
          if (!s) return;
          if (s.statut !== "present") {
            T(s.statut === "absent" ? "Absent" : "Excusé", x + 3, yb + 20, { size: 7.5, color: muted });
            return;
          }
          const quand = new Date(s.signe_at);
          const heure = `${String(quand.getHours()).padStart(2, "0")}:${String(quand.getMinutes()).padStart(2, "0")}`;
          T(s.mode === "code" ? "Signé en ligne" : "Déclaré par l'OF", x + 3, yb + 22, { size: 7, f: bold });
          T(`${frDate(s.signe_at)} ${heure}`, x + 3, yb + 13, { size: 6.5, color: muted });
          void w;
        };

        const ligneSig = (nom: string, participantId: string, hauteur = 34) => {
          const yb = y - hauteur + 12;
          page.drawRectangle({ x: M, y: yb, width: W - 2 * M, height: hauteur, borderColor: line, borderWidth: 0.6 });
          T(nom, xNom + 4, y, { size: 9 });
          for (let i = 0; i < jours.length; i++) {
            page.drawLine({ start: { x: xJour(i), y: yb }, end: { x: xJour(i), y: yb + hauteur }, thickness: 0.6, color: line });
            page.drawLine({ start: { x: xJour(i) + wJour / 2, y: yb }, end: { x: xJour(i) + wJour / 2, y: yb + hauteur }, thickness: 0.6, color: line });
            if (jours[i]) {
              cellule(participantId, jours[i], "matin", xJour(i), yb, wJour / 2);
              cellule(participantId, jours[i], "apres_midi", xJour(i) + wJour / 2, yb, wJour / 2);
            }
          }
          y = yb - 2;
          if (y < M + 90) { page = pdf.addPage(format); y = H - M; }
        };

        T("Formateur(s)", M, y, { size: 9, f: bold, color: muted }); saut(0.9);
        ligneSig(formateur || "", "");
        saut(0.4);
        T("Stagiaire(s)", M, y, { size: 9, f: bold, color: muted }); saut(0.9);
        for (const l of lignes) ligneSig(l.nom, l.id);
        // Une ligne vierge pour un participant ajouté sur place.
        if (!aDesSignatures) ligneSig("", "");

        saut(0.6);
        para(
          aDesSignatures
            ? "Les mentions « Signé en ligne » attestent d'un émargement électronique horodaté (lien privé et code à usage unique adressés au stagiaire). Les mentions « Déclaré par l'OF » signalent une présence attestée par le formateur. Le détail des preuves est conservé par l'organisme."
            : "Nombre d'heures par demi-journée à reporter sous chaque colonne.",
          { size: 8, color: muted },
        );
        saut(0.4);
        champ("Fait à :", org.ville);
        champ("Le :", aujourdhui());
        saut(0.8);
        T("Signature et cachet de l'organisme de formation", M, y, { size: 9, f: bold });
      }

      return await pdf.save();
    }

    let pdfBytes: Uint8Array;

    if (type === "demande") {
      pdfBytes = await construireDemande();
    } else {
      pdfBytes = await construirePdfPlat(type);
    }

    // ── Dépôt du fichier + référencement à côté des PDF de plans ──
    const chemin = `agefice-${type}-${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await sb.storage.from("plans")
      .upload(chemin, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (upErr) return json({ error: `Dépôt du fichier impossible : ${upErr.message}` }, 500);

    const titre = `${LIBELLE[type]} — ${apprenant || intitule}`;
    const { error: insErr } = await sb.from("plan_pdfs").insert({
      plan_id: planId, titre, kind: type,
      apprenant: apprenant || null,
      organisme: entreprise?.raison_sociale ?? org.nom ?? null,
      fichier_url: chemin, created_by: userId,
    });
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ ok: true, titre, fichier_url: chemin, kind: type });

  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
