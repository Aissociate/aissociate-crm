import { describe, expect, it } from "vitest";
import {
  appellation, blocContact, datesLisibles, dureeLisible, genreDe, jourReunion, joursSession, modeleDocument, type DonneesDoc,
} from "./modeles.ts";

const org = {
  nom: "Aissociate", adresse: "36 chemin de l'Exemple", code_postal: "97400", ville: "Saint-Denis",
  telephone: "0262 00 00 00", email: "contact@exemple.re", site_web: "www.exemple.re", nda: "00000000000", rcs: "St-Denis 000 000 000", naf: "85.59",
};
const base: DonneesDoc = {
  org,
  session: { titre: "Session test", date_debut: "2026-10-01T05:00:00+00:00", date_fin: "2026-10-03T13:00:00+00:00", lieu: "Salle A, Saint-Denis", modalite: "presentiel", formateur: "Formateur Test" },
  formation: { intitule: "IA générative au quotidien", objectifs: "Utiliser l'IA de façon responsable.", prerequis: "Savoir naviguer sur Internet.", duree_heures: 21, modalite: "presentiel" },
  participant: { prenom: "Jean", nom: "Martin", civilite: "M." },
  jours: ["2026-10-01", "2026-10-02", "2026-10-03"],
};
const texte = (m: ReturnType<typeof modeleDocument>) => JSON.stringify(m);

describe("dates et durées", () => {
  it("écrit les jours comme sur les convocations produites", () => {
    expect(datesLisibles(["2026-10-01", "2026-10-02", "2026-10-03"])).toBe("Jeudi 1er, vendredi 2 et samedi 3 octobre 2026");
    expect(datesLisibles(["2026-10-15"])).toBe("Jeudi 15 octobre 2026");
    expect(datesLisibles(["2026-11-30", "2026-12-01"])).toBe("Lundi 30 novembre et mardi 1er décembre 2026");
    expect(datesLisibles(["2026-12-31", "2027-01-01"])).toBe("Jeudi 31 décembre 2026 et vendredi 1er janvier 2027");
    expect(datesLisibles([])).toBe("……………");
  });
  it("lit les jours à l'heure de La Réunion", () => {
    expect(jourReunion("2026-10-01T22:00:00+00:00")).toBe("2026-10-02");
    expect(joursSession("2026-10-01T05:00:00+00:00", "2026-10-03T13:00:00+00:00")).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    // Les demi-journées d'émargement priment (jours non consécutifs).
    expect(joursSession("2026-10-01T05:00:00Z", "2026-10-09T13:00:00Z", ["2026-10-08", "2026-10-01", "2026-10-08"])).toEqual(["2026-10-01", "2026-10-08"]);
    expect(joursSession(null, null)).toEqual([]);
  });
  it("donne la durée par jour quand elle tombe juste", () => {
    expect(dureeLisible(21, 3)).toBe("21 heures (7 heures par jour)");
    expect(dureeLisible(10, 3)).toBe("10 heures");
    expect(dureeLisible(7, 1)).toBe("7 heures");
    expect(dureeLisible(null, 2)).toBe("……… heures");
  });
});

describe("civilité", () => {
  it("reconnaît les civilités du CRM", () => {
    expect(genreDe("M.")).toBe("m");
    expect(genreDe("Mr")).toBe("m");
    expect(genreDe("mme")).toBe("f");
    expect(genreDe("Mlle")).toBe("f");
    expect(genreDe("")).toBeNull();
    expect(appellation({ prenom: "Jean", nom: "Martin", civilite: "M." })).toBe("Monsieur MARTIN");
    expect(appellation({ prenom: "Léa", nom: "Payet", civilite: null })).toBe("Léa PAYET");
  });
});

describe("convocation", () => {
  it("reprend le tableau et les sections du modèle produit", () => {
    const m = modeleDocument("convocation", base)!;
    expect(m.titre).toBe("Convocation à une formation");
    expect(m.signature).toBe(false);
    const tableau = m.blocs[0];
    expect(tableau.type === "tableau" && tableau.lignes.map((l) => l[0])).toEqual(["Bénéficiaire", "Formation", "Dates", "Horaires", "Durée", "Lieu", "Formateur"]);
    expect(tableau.type === "tableau" && tableau.lignes[0][1]).toBe("Jean MARTIN");
    const t = texte(m);
    expect(t).toContain("Monsieur MARTIN, vous êtes convoqué à la formation mentionnée ci-dessus, organisée par AISSOCIATE.");
    expect(t).toContain("Jeudi 1er, vendredi 2 et samedi 3 octobre 2026");
    expect(t).toContain("21 heures (7 heures par jour)");
    for (const titre of ["Objet", "Objectifs pédagogiques", "Prérequis et modalités pédagogiques", "Organisation pratique", "Accessibilité", "Contact"]) expect(t).toContain(`"titre":"${titre}"`);
    expect(t).toContain("Cette convocation est à conserver");
  });
  it("accorde au féminin et s'adapte au distanciel", () => {
    const m = modeleDocument("convocation", { ...base, participant: { prenom: "Marie", nom: "Hoarau", civilite: "Mme" }, session: { ...base.session, modalite: "distanciel", lieu: "" } })!;
    const t = texte(m);
    expect(t).toContain("Madame HOARAU, vous êtes convoquée");
    expect(t).toContain("lien de connexion");
    expect(t).toContain("À distance");
  });
  it("omet les objectifs absents sans laisser de section vide", () => {
    const m = modeleDocument("convocation", { ...base, formation: { ...base.formation, objectifs: null } })!;
    expect(texte(m)).not.toContain("Objectifs pédagogiques");
  });
});

describe("autres documents", () => {
  it("livret d'accueil : déroulé, règlement, réclamations, sans signature", () => {
    const m = modeleDocument("livret_accueil", { ...base, participant: null })!;
    expect(m.signature).toBe(false);
    const t = texte(m);
    for (const s of ["Bienvenue", "Déroulement et suivi de votre parcours", "Règlement intérieur", "Réclamations", "Accessibilité", "Contact"]) expect(t).toContain(s);
    expect(t).toContain("questionnaire à froid");
  });
  it("attestation de fin : signée, datée de la fin", () => {
    const m = modeleDocument("attestation_fin", base)!;
    expect(m.signature).toBe(true);
    expect(texte(m)).toContain("Fait à Saint-Denis, le 3 octobre 2026.");
    expect(texte(m)).toContain("du 1er octobre 2026 au 3 octobre 2026");
  });
  it("certificat de réalisation : heures émargées quand elles existent", () => {
    expect(texte(modeleDocument("certificat_realisation", { ...base, heuresRealisees: 17.5 }))).toContain("17,5 heures (d'après les feuilles d'émargement)");
    expect(texte(modeleDocument("certificat_realisation", base))).not.toContain("Durée réalisée");
    expect(texte(modeleDocument("certificat_realisation", base))).toContain("déclaration d'activité n° 00000000000");
  });
  it("les types sans modèle gardent le gabarit historique", () => {
    expect(modeleDocument("emargement", base)).toBeNull();
    expect(modeleDocument("analyse_besoins", base)).toBeNull();
  });
  it("bloc contact complet", () => {
    const b = blocContact(org);
    expect(JSON.stringify(b)).toContain("NDA : 00000000000 — RCS St-Denis 000 000 000 — APE : 85.59");
  });
});
