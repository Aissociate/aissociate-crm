import { describe, expect, it } from "vitest";
import { citations, nombreResultats, requeteValide } from "./recherche.ts";

describe("recherche web", () => {
  it("requeteValide : espaces réduits, longueur bornée", () => {
    expect(requeteValide("  taux   TVA  Réunion ")).toBe("taux TVA Réunion");
    expect(requeteValide(null)).toBe("");
    expect(requeteValide("x".repeat(400))).toHaveLength(300);
  });

  it("nombreResultats : 5 par défaut, borné entre 3 et 8", () => {
    expect(nombreResultats(undefined)).toBe(5);
    expect(nombreResultats("abc")).toBe(5);
    expect(nombreResultats(1)).toBe(3);
    expect(nombreResultats(20)).toBe(8);
    expect(nombreResultats(6)).toBe(6);
  });

  it("citations : url_citation seulement, sans doublon ni adresse invalide", () => {
    const r = citations({
      annotations: [
        { type: "url_citation", url_citation: { url: "https://a.fr/x", title: "A", content: "  texte   a " } },
        { type: "url_citation", url_citation: { url: "https://a.fr/x", title: "A bis" } },
        { type: "url_citation", url_citation: { url: "javascript:alert(1)", title: "piège" } },
        { type: "file", file: {} },
        { type: "url_citation", url_citation: { url: "http://b.re", title: "B" } },
      ],
    });
    expect(r).toEqual([
      { titre: "A", url: "https://a.fr/x", extrait: "texte a" },
      { titre: "B", url: "http://b.re", extrait: "" },
    ]);
    expect(citations(null)).toEqual([]);
  });
});
