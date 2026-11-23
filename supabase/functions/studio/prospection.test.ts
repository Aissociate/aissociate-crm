import { describe, expect, it } from "vitest";
import {
  debutMois, entreeActeur, etatRun, fichesComptees, nombreFiches, normaliser, plafondMois, prefixeReference,
  prospectionActive, refRecherche, tableau, texteRecherche,
} from "./prospection.ts";

describe("prospection Google Maps", () => {
  it("texteRecherche : espaces réduits, longueur bornée", () => {
    expect(texteRecherche("  salon   de coiffure ")).toBe("salon de coiffure");
    expect(texteRecherche(null)).toBe("");
    expect(texteRecherche("x".repeat(300))).toHaveLength(120);
  });

  it("nombreFiches : 20 par défaut, borné entre 5 et 50, accepte « 20 fiches »", () => {
    expect(nombreFiches(undefined)).toBe(20);
    expect(nombreFiches("abc")).toBe(20);
    expect(nombreFiches(1)).toBe(5);
    expect(nombreFiches(500)).toBe(50);
    expect(nombreFiches("20 fiches")).toBe(20);
  });

  it("entreeActeur : la fiche seule, aucune option payante", () => {
    const e = entreeActeur("plombier", "Saint-Pierre, La Réunion", 10);
    expect(e).toMatchObject({ searchStringsArray: ["plombier"], locationQuery: "Saint-Pierre, La Réunion", maxCrawledPlacesPerSearch: 10, language: "fr" });
    expect(e).toMatchObject({ scrapeContacts: false, scrapePlaceDetailPage: false, maxReviews: 0, maxImages: 0, maximumLeadsEnrichmentRecords: 0 });
  });

  it("normaliser : écarte sans nom, fermées et doublons ; adresses web vérifiées", () => {
    const r = normaliser([
      { title: "Plomberie  Payet", categoryName: "Plombier", address: "1 rue A, 97410 Saint-Pierre", city: "Saint-Pierre", postalCode: "97410", phone: "+262 262 00 00 00", website: "https://payet.re", totalScore: 4.6, reviewsCount: 38, url: "https://www.google.com/maps/place/x", placeId: "A1" },
      { title: "Plomberie Payet", placeId: "A1" },
      { title: "Fermé", permanentlyClosed: true, placeId: "B2" },
      { title: "", placeId: "C3" },
      { title: "Sans site | SARL", website: "javascript:alert(1)", totalScore: null, placeId: "D4" },
      null,
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ nom: "Plomberie Payet", telephone: "+262 262 00 00 00", site: "https://payet.re", note: 4.6, avis: 38, place_id: "A1" });
    expect(r[1]).toMatchObject({ nom: "Sans site SARL", site: "", note: null, avis: null });
    expect(normaliser("pas un tableau")).toEqual([]);
    expect(normaliser([{ title: "a" }, { title: "b" }, { title: "c" }], 2)).toHaveLength(2);
  });

  it("tableau : une ligne par prospect, tirets pour les vides", () => {
    const t = tableau(normaliser([{ title: "A", city: "Le Tampon", postalCode: "97430", totalScore: 4, reviewsCount: 2 }, { title: "B" }]));
    expect(t.split("\n")).toHaveLength(4);
    expect(t).toContain("| 1 | A | — | 97430 Le Tampon | — | — | 4 (2 avis) |");
    expect(t).toContain("| 2 | B | — | — | — | — | — |");
    expect(tableau([])).toBe("(aucune fiche)");
  });

  it("plafondMois : défaut si absent ou illisible, 0 accepté", () => {
    expect(plafondMois(undefined)).toBe(200);
    expect(plafondMois("")).toBe(200);
    expect(plafondMois("abc")).toBe(200);
    expect(plafondMois("0")).toBe(0);
    expect(plafondMois("500")).toBe(500);
  });

  it("fichesComptees : résultat si terminée, demande si en cours, rien si échec", () => {
    expect(fichesComptees([
      { statut: "terminee", nombre: 20, nb: 14 }, { statut: "en_cours", nombre: 30, nb: null }, { statut: "echec", nombre: 50, nb: null },
    ])).toBe(44);
  });

  it("debutMois : minuit du 1er à La Réunion (UTC+4)", () => {
    expect(debutMois(Date.parse("2026-11-23T10:00:00Z"))).toBe("2026-10-31T20:00:00.000Z");
    expect(debutMois(Date.parse("2026-11-30T21:00:00Z"))).toBe("2026-11-30T20:00:00.000Z");
  });

  it("références : P-XXXXXXXX, lue avec ou sans préfixe", () => {
    const id = "ab12cd34-0000-4000-8000-000000000000";
    expect(refRecherche(id)).toBe("P-AB12CD34");
    expect(prefixeReference("P-AB12CD34")).toBe("ab12cd34");
    expect(prefixeReference(" ab12cd34 ")).toBe("ab12cd34");
    expect(prefixeReference("L-1234")).toBeNull();
  });

  it("etatRun : SUCCEEDED terminée, FAILED/ABORTED/TIMED-OUT échec, le reste en cours", () => {
    expect(etatRun({ id: "r1", status: "SUCCEEDED", defaultDatasetId: "d1" })).toMatchObject({ id: "r1", statut: "terminee", dataset: "d1" });
    expect(etatRun({ status: "RUNNING" }).statut).toBe("en_cours");
    expect(etatRun({ status: "READY" }).statut).toBe("en_cours");
    for (const s of ["FAILED", "ABORTED", "TIMED-OUT"]) expect(etatRun({ status: s }).statut).toBe("echec");
    expect(etatRun(null)).toMatchObject({ id: "", statut: "en_cours" });
  });

  it("prospectionActive : Sam seulement", () => {
    expect(prospectionActive("sam")).toBe(true);
    expect(prospectionActive("lea")).toBe(false);
    expect(prospectionActive(null)).toBe(false);
  });
});
