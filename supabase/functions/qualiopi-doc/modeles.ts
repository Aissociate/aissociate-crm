// Modèles des documents du dossier de formation (convocation, livret d'accueil,
// attestation de fin, certificat de réalisation), calqués sur les convocations
// déjà produites par Aissociate : en-tête centré, tableau récapitulatif, sections
// courtes, coordonnées complètes de l'organisme.
//
// Module pur (aucun import Deno) : testé par vitest, rendu en PDF par index.ts.

export type Org = Record<string, string | undefined>;
export type DonneesDoc = {
  org: Org;
  session: { titre?: string | null; date_debut?: string | null; date_fin?: string | null; lieu?: string | null; modalite?: string | null; formateur?: string | null };
  formation: { intitule?: string | null; objectifs?: string | null; prerequis?: string | null; duree_heures?: number | null; modalite?: string | null } | null;
  participant: { prenom?: string | null; nom?: string | null; civilite?: string | null } | null;
  /** Jours de formation (AAAA-MM-JJ), tirés des demi-journées d'émargement sinon des dates de la session. */
  jours: string[];
  /** Heures émargées « présent » par le stagiaire (certificat de réalisation). */
  heuresRealisees?: number | null;
};
export type Paragraphe = { gras?: string; texte: string };
export type Bloc =
  | { type: "tableau"; lignes: [string, string][] }
  | { type: "section"; titre: string; paragraphes: Paragraphe[] }
  | { type: "note"; texte: string };
export type Modele = { titre: string; blocs: Bloc[]; signature: boolean };

/** Types rendus par ce module ; les autres gardent le gabarit historique de index.ts. */
export const TYPES_MODELES = ["convocation", "livret_accueil", "attestation_fin", "certificat_realisation"] as const;

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const HORAIRES = "09h00–12h30 et 13h30–17h00";
const MODALITES: Record<string, string> = {
  presentiel: "présentiel", distanciel: "distanciel", mixte: "mixte (présentiel et distanciel)", "e-learning": "e-learning",
};

/** Date du jour à La Réunion (UTC+4) d'un horodatage. */
export function jourReunion(horodatage: string): string {
  const t = Date.parse(horodatage);
  if (Number.isNaN(t)) return String(horodatage).slice(0, 10);
  return new Date(t + 4 * 3_600_000).toISOString().slice(0, 10);
}

/** Jours de la session : demi-journées d'émargement s'il y en a, sinon chaque jour du début à la fin (14 au plus). */
export function joursSession(debut: string | null | undefined, fin: string | null | undefined, creneaux: string[] = []): string[] {
  if (creneaux.length) return [...new Set(creneaux.map((d) => d.slice(0, 10)))].sort();
  if (!debut) return [];
  const d0 = jourReunion(debut), d1 = fin ? jourReunion(fin) : d0;
  const out: string[] = [];
  for (let t = Date.parse(`${d0}T00:00:00Z`); t <= Date.parse(`${d1}T00:00:00Z`) && out.length < 14; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

const numJour = (n: number) => (n === 1 ? "1er" : String(n));
const majuscule = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** « Jeudi 1er, vendredi 2 et samedi 3 octobre 2026 » ; les mois et années changent au fil de la liste. */
export function datesLisibles(jours: string[]): string {
  if (!jours.length) return "……………";
  const ds = jours.map((j) => new Date(`${j}T00:00:00Z`));
  const parts: string[] = [];
  ds.forEach((d, i) => {
    const suivant = ds[i + 1];
    const finMois = !suivant || suivant.getUTCMonth() !== d.getUTCMonth() || suivant.getUTCFullYear() !== d.getUTCFullYear();
    const finAnnee = !suivant || suivant.getUTCFullYear() !== d.getUTCFullYear();
    parts.push(`${JOURS[d.getUTCDay()]} ${numJour(d.getUTCDate())}${finMois ? ` ${MOIS[d.getUTCMonth()]}` : ""}${finAnnee ? ` ${d.getUTCFullYear()}` : ""}`);
  });
  const texte = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
  return majuscule(texte);
}

/** « 15 octobre 2026 ». */
export function dateLongue(jour: string | null | undefined): string {
  if (!jour) return "……………";
  const d = new Date(`${jour.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(jour);
  return `${numJour(d.getUTCDate())} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const heures = (h: number) => `${String(Math.round(h * 100) / 100).replace(".", ",")} heure${h > 1 ? "s" : ""}`;

export function dureeLisible(dureeH: number | null | undefined, nbJours: number): string {
  if (!dureeH) return "……… heures";
  const parJour = nbJours > 0 ? dureeH / nbJours : 0;
  return nbJours > 1 && Number.isInteger(parJour) ? `${heures(dureeH)} (${heures(parJour)} par jour)` : heures(dureeH);
}

type Genre = "m" | "f" | null;
export function genreDe(civilite: string | null | undefined): Genre {
  const c = String(civilite ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (["m", "mr", "monsieur"].includes(c)) return "m";
  if (["mme", "mlle", "madame", "mademoiselle"].includes(c)) return "f";
  return null;
}

/** Prénom NOM du bénéficiaire. */
export function nomComplet(p: DonneesDoc["participant"]): string {
  if (!p) return "……………";
  return [p.prenom?.trim(), p.nom?.trim().toUpperCase()].filter(Boolean).join(" ") || "……………";
}

/** « Monsieur BLANC » / « Madame X » ; sans civilité connue : « Prénom NOM ». */
export function appellation(p: DonneesDoc["participant"]): string {
  const g = genreDe(p?.civilite);
  const nom = p?.nom?.trim().toUpperCase();
  if (g && nom) return `${g === "m" ? "Monsieur" : "Madame"} ${nom}`;
  return nomComplet(p);
}

const accord = (g: Genre, m: string, f: string) => (g === "m" ? m : g === "f" ? f : `${m}(e)`);

function ctx(d: DonneesDoc) {
  const orgNom = (d.org.nom || "Aissociate").toUpperCase();
  const adresse = [d.org.adresse, [d.org.code_postal, d.org.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const modaliteCode = String(d.session.modalite || d.formation?.modalite || "presentiel");
  return {
    orgNom, adresse,
    intitule: d.formation?.intitule || d.session.titre || "……………",
    dates: datesLisibles(d.jours),
    duree: dureeLisible(d.formation?.duree_heures, d.jours.length),
    lieu: d.session.lieu?.trim() || (modaliteCode === "distanciel" ? "À distance (lien de connexion communiqué avant la formation)" : "……………"),
    formateur: d.session.formateur?.trim() || "……………",
    modalite: MODALITES[modaliteCode] ?? modaliteCode,
    presentiel: modaliteCode !== "distanciel" && modaliteCode !== "e-learning",
    objectifs: d.formation?.objectifs?.trim() || "",
    prerequis: d.formation?.prerequis?.trim() || "Aucun prérequis particulier.",
    fin: d.jours[d.jours.length - 1] ?? (d.session.date_fin ? jourReunion(d.session.date_fin) : null),
    debut: d.jours[0] ?? (d.session.date_debut ? jourReunion(d.session.date_debut) : null),
    villeSignature: d.org.ville || "……………",
  };
}

/** Bloc « Contact » : identique sur tous les documents (adresse, téléphone, e-mail, site, NDA, RCS, APE). */
export function blocContact(org: Org): Bloc {
  const nom = (org.nom || "Aissociate").toUpperCase();
  const adresse = [org.adresse, [org.code_postal, org.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const l2 = [org.telephone && `Tél. : ${org.telephone}`, org.email && `Email : ${org.email}`, org.site_web && `Site : ${org.site_web}`].filter(Boolean).join(" — ");
  const l3 = [org.nda && `NDA : ${org.nda}`, org.rcs && `RCS ${org.rcs}`, org.naf && `APE : ${org.naf}`].filter(Boolean).join(" — ");
  return { type: "section", titre: "Contact", paragraphes: [{ texte: [nom, adresse].filter(Boolean).join(" — ") }, ...(l2 ? [{ texte: l2 }] : []), ...(l3 ? [{ texte: l3 }] : [])] };
}

const blocAccessibilite = (orgNom: string): Bloc => ({
  type: "section", titre: "Accessibilité",
  paragraphes: [{ texte: `Si vous êtes en situation de handicap ou si vous avez besoin d'un aménagement particulier pour suivre la formation dans de bonnes conditions, merci de contacter ${orgNom} en amont de la session afin d'étudier les adaptations possibles.` }],
});

/** Modèle du document, ou null si le type garde le gabarit historique. */
export function modeleDocument(type: string, d: DonneesDoc): Modele | null {
  const c = ctx(d);
  const g = genreDe(d.participant?.civilite);
  const benef = nomComplet(d.participant);
  switch (type) {
    case "convocation":
      return {
        titre: "Convocation à une formation", signature: false,
        blocs: [
          { type: "tableau", lignes: [["Bénéficiaire", benef], ["Formation", c.intitule], ["Dates", c.dates], ["Horaires", HORAIRES], ["Durée", c.duree], ["Lieu", c.lieu], ["Formateur", c.formateur]] },
          { type: "section", titre: "Objet", paragraphes: [{ texte: `${appellation(d.participant)}, vous êtes ${accord(g, "convoqué", "convoquée")} à la formation mentionnée ci-dessus, organisée par ${c.orgNom}. ${c.presentiel ? "Merci de vous présenter sur le lieu de formation quelques minutes avant le début de la première journée." : "Le lien de connexion vous sera communiqué avant le début de la première journée."}` }] },
          ...(c.objectifs ? [{ type: "section" as const, titre: "Objectifs pédagogiques", paragraphes: [{ texte: c.objectifs }] }] : []),
          { type: "section", titre: "Prérequis et modalités pédagogiques", paragraphes: [
            { gras: "Prérequis :", texte: c.prerequis },
            { gras: "Modalité :", texte: `formation en ${c.modalite}. La pédagogie privilégie la mise en pratique, les cas d'usage, l'interaction et la co-construction. Des évaluations sont réalisées au cours de la formation, notamment au moyen de QCM et de mises en pratique.` },
          ] },
          { type: "section", titre: "Organisation pratique", paragraphes: [{ texte: "Chaque journée se déroule de 09h00 à 17h00, avec une pause méridienne de 12h30 à 13h30. Merci de prévoir un ordinateur portable permettant de réaliser les exercices et travaux pratiques." }] },
          blocAccessibilite(c.orgNom),
          blocContact(d.org),
          { type: "note", texte: "Cette convocation est à conserver avec les documents relatifs à votre parcours de formation." },
        ],
      };
    case "livret_accueil":
      return {
        titre: "Livret d'accueil du stagiaire", signature: false,
        blocs: [
          { type: "tableau", lignes: [["Formation", c.intitule], ["Dates", c.dates], ["Horaires", HORAIRES], ["Durée", c.duree], ["Modalité", majuscule(c.modalite)], ["Lieu", c.lieu], ["Formateur", c.formateur]] },
          { type: "section", titre: "Bienvenue", paragraphes: [{ texte: `Toute l'équipe de ${c.orgNom} vous souhaite la bienvenue. Ce livret vous présente l'organisation de votre formation, vos interlocuteurs et vos droits. Conservez-le pendant toute la durée de votre parcours.` }] },
          ...(c.objectifs ? [{ type: "section" as const, titre: "Objectifs pédagogiques", paragraphes: [{ texte: c.objectifs }] }] : []),
          { type: "section", titre: "Organisation pratique", paragraphes: [
            { texte: "Chaque journée se déroule de 09h00 à 17h00, avec une pause méridienne de 12h30 à 13h30." },
            { texte: c.presentiel ? "Merci de prévoir un ordinateur portable permettant de réaliser les exercices et travaux pratiques, et de vous présenter quelques minutes avant le début de la première journée." : "Le lien de connexion vous est communiqué avant la formation. Prévoyez un ordinateur avec micro, caméra et une connexion stable." },
          ] },
          { type: "section", titre: "Déroulement et suivi de votre parcours", paragraphes: [
            { gras: "Avant :", texte: "un questionnaire de positionnement recueille vos attentes et votre niveau, pour adapter la formation." },
            { gras: "Pendant :", texte: "vous signez la feuille d'émargement à chaque demi-journée, par le lien et le code reçus par e-mail ; vos acquis sont évalués (QCM, mises en pratique)." },
            { gras: "Après :", texte: "vous recevez une attestation de fin de formation, un questionnaire de satisfaction à chaud le dernier jour, puis un questionnaire à froid environ un mois plus tard pour mesurer ce que la formation vous a apporté." },
          ] },
          { type: "section", titre: "Règlement intérieur", paragraphes: [{ texte: "Les règles d'hygiène, de sécurité et de discipline du règlement intérieur s'appliquent pendant toute la formation. Il vous est remis ou communiqué sur demande. Toute absence ou retard doit être signalé au plus tôt." }] },
          blocAccessibilite(c.orgNom),
          { type: "section", titre: "Réclamations", paragraphes: [{ texte: `Toute réclamation peut être adressée par écrit à ${c.orgNom}${d.org.email ? ` (${d.org.email})` : ""}. Elle est enregistrée, traitée et fait l'objet d'une réponse, conformément à notre procédure d'amélioration continue.` }] },
          blocContact(d.org),
        ],
      };
    case "attestation_fin":
      return {
        titre: "Attestation de fin de formation", signature: true,
        blocs: [
          { type: "tableau", lignes: [["Bénéficiaire", benef], ["Formation", c.intitule], ["Dates", c.dates], ["Durée", c.duree], ["Modalité", majuscule(c.modalite)], ["Lieu", c.lieu]] },
          { type: "section", titre: "Attestation", paragraphes: [{ texte: `Je soussigné(e), représentant l'organisme de formation ${c.orgNom}, atteste que ${appellation(d.participant)} a suivi l'action de formation mentionnée ci-dessus, du ${dateLongue(c.debut)} au ${dateLongue(c.fin)}.` }] },
          ...(c.objectifs ? [{ type: "section" as const, titre: "Objectifs de la formation", paragraphes: [{ texte: c.objectifs }] }] : []),
          { type: "section", titre: "Évaluation des acquis", paragraphes: [{ texte: "Les acquis ont été évalués au cours de la formation (QCM et mises en pratique). Les résultats figurent dans le dossier du stagiaire." }] },
          { type: "section", titre: "Fait pour servir et valoir ce que de droit", paragraphes: [{ texte: `Fait à ${c.villeSignature}, le ${dateLongue(c.fin)}.` }, { texte: "Signature et cachet de l'organisme :" }] },
        ],
      };
    case "certificat_realisation": {
      const realise = d.heuresRealisees != null && d.heuresRealisees > 0 ? heures(d.heuresRealisees) : null;
      return {
        titre: "Certificat de réalisation", signature: true,
        blocs: [
          { type: "section", titre: "", paragraphes: [{ texte: `Je soussigné(e), représentant légal du dispensateur de l'action concourant au développement des compétences ${c.orgNom}${d.org.nda ? ` (déclaration d'activité n° ${d.org.nda})` : ""}, atteste que :` }] },
          { type: "tableau", lignes: [
            ["Bénéficiaire", benef], ["Action", c.intitule], ["Nature de l'action", "Action de formation (article L. 6313-1 du Code du travail)"],
            ["Dates", `Du ${dateLongue(c.debut)} au ${dateLongue(c.fin)}`], ["Durée prévue", c.duree],
            ...(realise ? [["Durée réalisée", `${realise} (d'après les feuilles d'émargement)`] as [string, string]] : []),
          ] },
          { type: "section", titre: "", paragraphes: [{ texte: `Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m'engage à conserver l'ensemble des pièces justificatives qui ont permis d'établir le présent certificat pendant une durée de 3 ans à compter de la fin de l'année du dernier paiement.` }] },
          { type: "section", titre: "", paragraphes: [{ texte: `Fait à ${c.villeSignature}, le ${dateLongue(c.fin)}.` }, { texte: "Cachet et signature du responsable du dispensateur de formation :" }] },
        ],
      };
    }
    default:
      return null;
  }
}
