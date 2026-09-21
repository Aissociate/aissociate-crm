// Convention de formation professionnelle continue — modèle AIssociate.
//
// Reproduit la convention type de l'organisme (Word « 5. Convention de
// formation ») : papier à en-tête (logo + pied de page légal sur chaque page),
// numéro de convention, onze articles, programme détaillé en annexe. Tout ce
// que le CRM connaît est renseigné ; ce qu'il ne connaît pas reste en
// pointillés, à compléter à la main, plutôt que d'imprimer une valeur fausse.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "npm:pdf-lib@1.17.1";

export type ConventionCtx = {
  org: Record<string, string>;
  /** Représentant légal de l'organisme (Paramètres > AGEFICE). */
  responsable: { civilite?: string; prenom?: string; nom?: string; qualite?: string };
  /** Autorité de délivrance du NDA, ex. « DEETS La Réunion ». */
  autoriteNda: string;
  numero: string;
  entreprise: { raison_sociale?: string | null; adresse?: string | null; code_postal?: string | null; ville?: string | null } | null;
  /** « Madame Jeanne DUPONT, Gérante » — vide si inconnu. */
  representantEntreprise: string;
  intitule: string;
  objectifs: string | null;
  programme: unknown[];
  dureeH: number;
  /** Journées de formation (AAAA-MM-JJ). */
  jours: string[];
  /** Dates saisies en clair sur le plan, à défaut de journées planifiées. */
  datesTexte?: string;
  /** Nombre de jours saisi : prime sur les journées planifiées et sur durée / 7. */
  nbJours?: number;
  horaires: string;
  lieu: string;
  /** Lieu saisi en toutes lettres : imprimé tel quel, sans « présentiel au ». */
  lieuTexte?: string;
  formateur?: string;
  distanciel: boolean;
  effectif: string[];
  /** Coût total net de taxes ; null → à compléter. */
  prix: number | null;
};

// Polices standard = encodage WinAnsi : on garde accents, €, tirets et
// guillemets typographiques (présents dans WinAnsi), on retire le reste.
function txt(s: unknown): string {
  return String(s ?? "")
    .replace(/[  ]/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\xFF€–—‘’“”…]/g, "");
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const et = (l: string[]) => (l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}`);

/** « 2, 3 et 4 mars 2026 » ; plusieurs mois : « 30 septembre et 1er octobre 2026 ». */
export function datesEnLettres(jours: string[]): string {
  const ds = [...new Set(jours.map((d) => d.slice(0, 10)))].sort();
  const groupes: { cle: string; mois: number; an: number; j: string[] }[] = [];
  for (const d of ds) {
    const [an, mois, jour] = d.split("-").map(Number);
    const cle = `${an}-${mois}`;
    let g = groupes.find((x) => x.cle === cle);
    if (!g) { g = { cle, mois, an, j: [] }; groupes.push(g); }
    g.j.push(jour === 1 ? "1er" : String(jour));
  }
  const memeAn = groupes.every((g) => g.an === groupes[0]?.an);
  return et(groupes.map((g, i) =>
    `${et(g.j)} ${MOIS[g.mois - 1]}${!memeAn || i === groupes.length - 1 ? ` ${g.an}` : ""}`));
}

const montant = (n: number) => {
  const [e, c] = n.toFixed(2).split(".");
  return `${e.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${c === "00" ? "" : `,${c}`}`;
};

/** Un module du programme : chaîne, ou objet { titre, contenu } du catalogue. */
function module(x: unknown): { titre: string; contenu: string } {
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return { titre: String(o.titre ?? o.title ?? ""), contenu: String(o.contenu ?? o.description ?? "") };
  }
  // Ligne d'un plan : « Titre — contenu » (voir PlansFormation), sinon titre seul.
  const [titre, ...reste] = String(x ?? "").split(" — ");
  return { titre: titre.trim(), contenu: reste.join(" — ").trim() };
}

async function image(pdf: PDFDocument, url: string | undefined): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const b = new Uint8Array(await r.arrayBuffer());
    if (b[0] === 0x89 && b[1] === 0x50) return await pdf.embedPng(b);
    if (b[0] === 0xff && b[1] === 0xd8) return await pdf.embedJpg(b);
  } catch (e) { console.error("logo", e); }
  return null;
}

type Run = { t: string; b?: boolean; i?: boolean };

export async function construireConvention(c: ConventionCtx): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const logo = await image(pdf, c.org.logo_url);
  const ink = rgb(0.1, 0.1, 0.12);
  const gris = rgb(0.45, 0.45, 0.5);
  const trait = rgb(0.55, 0.55, 0.6);

  const W = 595.28, H = 841.89, M = 64;
  const HAUT = H - 118, BAS = 92; // zone utile entre en-tête et pied de page
  const org = c.org;
  const fonte = (r: Run) => (r.b ? bold : r.i ? ital : reg);

  let page!: PDFPage;
  let y = 0;

  const enTete = () => {
    if (logo) {
      // Le logo est un carré à larges marges blanches : on l'agrandit pour que
      // la partie dessinée ait la taille de celle du modèle Word.
      const h = 104, w = (logo.width / logo.height) * h;
      page.drawImage(logo, { x: M - 2, y: H - 12 - h, width: w, height: h });
      const x = M - 2 + w + 2;
      page.drawText(txt(org.slogan_1 ?? "FORMATIONS IA"), { x, y: H - 62, size: 15, font: reg, color: ink });
      page.drawText(txt(org.slogan_2 ?? "LA REUNION"), { x, y: H - 80, size: 15, font: reg, color: ink });
    } else {
      page.drawText(txt(org.nom ?? ""), { x: M, y: H - 70, size: 18, font: bold, color: ink });
    }
  };
  const piedDePage = () => {
    const lignes: Run[][] = [
      [{ t: (org.titulaire || org.nom || "").toUpperCase(), b: true },
        { t: ` – ${[org.forme_juridique, org.capital ? `au Capital Social de ${org.capital}` : ""].filter(Boolean).join(" ")} – ${[org.adresse, org.code_postal, org.ville].filter(Boolean).join(" ")}` }],
      [{ t: [org.telephone ? `Tél ${org.telephone}` : "", org.email, org.site_web].filter(Boolean).join(" – ") }],
      [{ t: [org.nda ? `NDA ${org.nda} ${c.autoriteNda}`.trim() : "", org.rcs ? `RCS ${org.rcs}` : "", org.naf ? `APE ${org.naf}` : ""].filter(Boolean).join(" – ") }],
    ];
    let yy = 58;
    for (const l of lignes) {
      const w = l.reduce((s, r) => s + fonte(r).widthOfTextAtSize(txt(r.t), 7.5), 0);
      let x = (W - w) / 2;
      for (const r of l) {
        page.drawText(txt(r.t), { x, y: yy, size: 7.5, font: fonte(r), color: ink });
        x += fonte(r).widthOfTextAtSize(txt(r.t), 7.5);
      }
      yy -= 10;
    }
  };
  const nouvellePage = () => { page = pdf.addPage([W, H]); enTete(); piedDePage(); y = HAUT; };
  const place = (h: number) => { if (y - h < BAS) nouvellePage(); };
  const espace = (h: number) => { y -= h; };

  /** Découpe des segments (gras / italique) en lignes tenant dans `maxW`. */
  const couper = (runs: Run[], size: number, maxW: number): Run[][] => {
    const lignes: Run[][] = [[]];
    let largeur = 0;
    for (const r of runs) {
      const mots = txt(r.t).split(/(\s+)/).filter((m) => m.length);
      for (const m of mots) {
        const w = fonte(r).widthOfTextAtSize(m, size);
        const blanc = /^\s+$/.test(m);
        if (!blanc && largeur + w > maxW && largeur > 0) { lignes.push([]); largeur = 0; }
        if (blanc && largeur === 0) continue;
        lignes[lignes.length - 1].push({ ...r, t: blanc ? " " : m });
        largeur += blanc ? fonte(r).widthOfTextAtSize(" ", size) : w;
      }
    }
    return lignes;
  };
  const largeurLigne = (l: Run[], size: number) => l.reduce((s, r) => s + fonte(r).widthOfTextAtSize(r.t, size), 0);
  const para = (contenu: string | Run[], o: { size?: number; indent?: number; centre?: boolean; apres?: number; souligne?: boolean } = {}) => {
    const size = o.size ?? 10.5, indent = o.indent ?? 0, interligne = size * 1.38;
    const runs = typeof contenu === "string" ? [{ t: contenu }] : contenu;
    for (const l of couper(runs, size, W - 2 * M - indent)) {
      place(interligne);
      let x = o.centre ? (W - largeurLigne(l, size)) / 2 : M + indent;
      for (const r of l) {
        page.drawText(r.t, { x, y: y - size, size, font: fonte(r), color: ink });
        const w = fonte(r).widthOfTextAtSize(r.t, size);
        if (o.souligne) page.drawLine({ start: { x, y: y - size - 1.5 }, end: { x: x + w, y: y - size - 1.5 }, thickness: 0.5, color: ink });
        x += w;
      }
      y -= interligne;
    }
    espace(o.apres ?? 6);
  };
  const article = (titre: string) => {
    place(60);
    espace(8);
    page.drawText(txt(titre), { x: M, y: y - 13, size: 13, font: bold, color: ink });
    y -= 19;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: trait });
    espace(12);
  };
  const puces = (items: (string | Run[])[], size = 10.5) => {
    for (const it of items) {
      const runs = typeof it === "string" ? [{ t: it }] : it;
      const lignes = couper(runs, size, W - 2 * M - 40);
      place(size * 1.38);
      page.drawCircle({ x: M + 22, y: y - size * 0.62, size: 1.8, color: ink });
      lignes.forEach((l, i) => {
        if (i) place(size * 1.38);
        let x = M + 40;
        for (const r of l) { page.drawText(r.t, { x, y: y - size, size, font: fonte(r), color: ink }); x += fonte(r).widthOfTextAtSize(r.t, size); }
        y -= size * 1.38;
      });
    }
    espace(6);
  };
  /** « Libellé : valeur », ou pointillés jusqu'à la marge si la valeur manque. */
  const champ = (libelle: Run[], valeur: string, size = 10.5) => {
    if (valeur.trim()) { para([...libelle, { t: ` ${valeur}` }], { size, apres: 1 }); return; }
    place(size * 1.38);
    let x = M;
    for (const r of libelle) { page.drawText(txt(r.t), { x, y: y - size, size, font: fonte(r), color: ink }); x += fonte(r).widthOfTextAtSize(txt(r.t), size); }
    x += 3;
    const point = reg.widthOfTextAtSize(".", size);
    page.drawText(".".repeat(Math.max(0, Math.floor((W - M - x) / point))), { x, y: y - size, size, font: reg, color: gris });
    y -= size * 1.38 + 1;
  };
  const encadre = (texte: string) => {
    const size = 10.5, lignes = couper([{ t: texte, b: true }], size, W - 2 * M - 24), h = lignes.length * size * 1.38 + 10;
    place(h + 6);
    page.drawRectangle({ x: M, y: y - h, width: W - 2 * M, height: h, borderColor: ink, borderWidth: 0.7 });
    let yy = y - 5;
    for (const l of lignes) {
      page.drawText(l.map((r) => r.t).join(""), { x: (W - largeurLigne(l, size)) / 2, y: yy - size, size, font: bold, color: ink });
      yy -= size * 1.38;
    }
    y -= h + 10;
  };

  // ── Données mises en forme ──
  const civ = (s?: string) => (/^(mme|madame)/i.test(s ?? "") ? "Madame" : s ? "Monsieur" : "");
  const r = c.responsable;
  const responsable = [civ(r.civilite), r.prenom, (r.nom ?? "").toUpperCase()].filter(Boolean).join(" ")
    + (r.qualite ? `, ${r.qualite}` : "");
  const ent = c.entreprise;
  const adresseEnt = ent ? [ent.adresse, [ent.code_postal, ent.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
  const objectifs = (c.objectifs ?? "").split(/[;\n]+/).map((s) => s.trim().replace(/\.$/, "")).filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  const modules = c.programme.map(module).filter((m) => m.titre || m.contenu);
  const nbJours = c.nbJours || c.jours.length || (c.dureeH ? Math.ceil(c.dureeH / 7) : 0);
  const n = c.effectif.length;

  // ═══ Page 1 ═══
  nouvellePage();
  para([{ t: "CONVENTION DE FORMATION PROFESSIONNELLE CONTINUE", b: true }], { size: 12, centre: true, apres: 0 });
  para([{ t: "(Article L.6353-1 du Code du travail – Décret n°2018-1341 du 28 décembre 2018)", i: true }], { size: 9.5, centre: true, apres: 12 });
  para(`N° de Convention ${c.numero}`, { centre: true, apres: 14 });

  para("Entre les soussignés :", { souligne: true, apres: 10 });
  para([
    { t: `L'Organisme de formation ${org.nom ?? ""}`, b: true },
    { t: ` ${org.forme_juridique ?? ""}${org.rcs ? ` immatriculée au RCS ${org.rcs}` : ""}, dont le siège est situé ${[org.adresse, org.code_postal, org.ville].filter(Boolean).join(" ")}, enregistrée sous le NDA ${org.nda ?? "……………"}${c.autoriteNda ? ` délivré par la ${c.autoriteNda}` : ""}, et représentée par : ${responsable || "……………………………………………"}` },
  ], { apres: 10 });
  para("Et", { souligne: true, apres: 10 });
  champ([{ t: "L'Entreprise / le Bénéficiaire", b: true }, { t: " Nom / Raison sociale :" }], ent?.raison_sociale ?? "");
  champ([{ t: "Adresse :" }], adresseEnt);
  champ([{ t: "Représentée par :" }], c.representantEntreprise);
  espace(8);
  para("Est conclue selon les modalités ci-dessous la convention de formation professionnelle suivante en application des dispositions du code du travail portant sur la formation professionnelle continue.");

  article("Article 1 – Objet de la convention");
  para("La présente convention a pour objet la réalisation d'une action de formation professionnelle continue, au sens de l'article L.6313-1 du Code du travail, dont l'intitulé est :", { apres: 8 });
  encadre(`« ${c.intitule} »`);
  if (objectifs.length) {
    para([{ t: "Objectifs de la formation :", b: true }], { apres: 6 });
    para(`À l'issue de la formation, ${n > 1 ? "les bénéficiaires seront capables" : "le bénéficiaire sera capable"} de :`, { apres: 6 });
    puces(objectifs);
  }

  article("Article 2 – Nature, durée et organisation de l'action");
  const effectifTexte = n > 1 ? `${n} participants` : n === 1 ? `1 participant / individuel : ${c.effectif[0]}` : "";
  puces([
    "Nature de l'action : action de formation",
    `Durée totale : ${[nbJours ? `${nbJours} jour${nbJours > 1 ? "s" : ""}` : "", c.dureeH ? `${c.dureeH} heures` : ""].filter(Boolean).join(" – ") || "……………"}`,
    `Dates : ${datesEnLettres(c.jours) || c.datesTexte || "……………………………"}`,
    `Horaires : ${c.horaires}`,
    `Lieu de formation : ${c.lieuTexte
      || (c.distanciel ? "à distance (classe virtuelle)" : `présentiel au ${c.lieu || "……………………………"}`)}`,
    ...(c.formateur ? [`Formateur : ${c.formateur}`] : []),
    `Effectif : ${effectifTexte || "……………"}`,
  ]);
  if (n > 1) {
    para([{ t: "Liste des participants :", b: true }], { apres: 4 });
    puces(c.effectif);
  }

  article("Article 3 – Programme de la formation");
  para("Le programme détaillé de la formation est annexé à la présente convention. Il précise les contenus, séquences pédagogiques, méthodes mobilisées et modalités d'évaluation.");

  article("Article 4 – Moyens pédagogiques et techniques");
  para("La formation mobilise des méthodes pédagogiques actives et participatives, incluant :");
  puces(["Apports théoriques", "Études de cas", "Mises en situation pratiques", "Exercices guidés sur outils d'intelligence artificielle générative"]);
  para("Moyens techniques :");
  puces(c.distanciel
    ? ["Plateforme de classe virtuelle", "Ordinateur et connexion internet du participant", "Supports pédagogiques remis aux participants"]
    : ["Salle de formation équipée", "Ordinateur, vidéoprojecteur", "Connexion internet", "Supports pédagogiques remis aux participants"]);

  article("Article 5 – Modalités d'évaluation des acquis");
  para(`Les acquis ${n > 1 ? "des bénéficiaires" : "du bénéficiaire"} sont évalués au moyen :`);
  puces(["D'un positionnement initial", "D'évaluations formatives tout au long de la formation", "D'une évaluation finale permettant de vérifier l'atteinte des objectifs pédagogiques"]);

  article("Article 6 – Suivi de l'exécution de l'action");
  para(`La présence ${n > 1 ? "des bénéficiaires" : "du bénéficiaire"} est attestée par une feuille d'émargement signée par demi-journée par ${n > 1 ? "chaque bénéficiaire" : "le bénéficiaire"} et le formateur.`);

  article("Article 7 – Sanction de la formation");
  para(`À l'issue de la formation, il est remis ${n > 1 ? "à chaque bénéficiaire" : "au bénéficiaire"} une attestation de fin de formation et une attestation d'assiduité.`);

  article("Article 8 – Prix de la formation et modalités de paiement");
  para([
    { t: "Le coût total de la formation est fixé à " },
    { t: c.prix ? `${montant(c.prix)} € net de taxes` : "……………… € net de taxes", b: true },
    { t: " (non soumis à la TVA – article 261-4-4° a du CGI). L'intégralité du montant doit être réglée au plus tard 15 jours avant le début de la formation." },
  ]);

  article("Article 9 – Règlement intérieur");
  para(`${n > 1 ? "Les bénéficiaires reconnaissent" : "Le bénéficiaire reconnaît"} avoir pris connaissance du règlement intérieur applicable aux formations et s'engage${n > 1 ? "nt" : ""} à en respecter les dispositions.`);

  article("Article 10 – Annulation et résiliation");
  para("Toute annulation ou interruption de la formation donne lieu à l'application des conditions financières précisées par l'Organisme de formation, sauf cas de force majeure dûment justifié.");

  article("Article 11 – Litiges");
  para("En cas de litige, le tribunal compétent est celui du ressort du siège de l'Organisme de formation.", { apres: 14 });

  place(110);
  para(`Fait en 2 exemplaires originaux à ${org.ville || "……………………………"} le ……………………………`, { apres: 22 });
  const col2 = W / 2 + 10;
  const deuxColonnes = (g: Run, d: Run, size = 10.5) => {
    page.drawText(txt(g.t), { x: M, y: y - size, size, font: fonte(g), color: ink });
    page.drawText(txt(d.t), { x: col2, y: y - size, size, font: fonte(d), color: ink });
    y -= size * 1.4;
  };
  deuxColonnes({ t: "Pour l'Organisme de formation", b: true }, { t: "Pour le Client / Bénéficiaire", b: true });
  deuxColonnes({ t: "Nom, qualité, signature" }, { t: "Nom, qualité, signature, cachet" });
  if (responsable || c.representantEntreprise) deuxColonnes({ t: responsable, i: true }, { t: c.representantEntreprise, i: true }, 9.5);

  // ═══ Annexe : programme détaillé ═══
  if (modules.length) {
    nouvellePage();
    para([{ t: "ANNEXE – PROGRAMME DE LA FORMATION", b: true }], { size: 12, centre: true, apres: 4 });
    para([{ t: `Convention n° ${c.numero}`, i: true }], { size: 9.5, centre: true, apres: 12 });
    encadre(`« ${c.intitule} »`);
    if (c.dureeH) para(`Durée : ${c.dureeH} heures`, { apres: 10 });
    for (const m of modules) {
      if (m.titre) { place(40); para([{ t: m.titre, b: true }], { apres: 3 }); }
      if (m.contenu) para(m.contenu, { indent: 12, apres: 10 });
    }
  }

  return await pdf.save();
}
