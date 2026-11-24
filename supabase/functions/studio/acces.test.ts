import { describe, expect, it } from "vitest";
import { agentsRetenus, autorise, cleValide, cleZernio, filtrer, type Acces } from "./acces.ts";

const acces: Acces = new Map([["api:brevo", ["hugo"]], [cleZernio("z1"), ["lea", "sam"]]]);

describe("connecteurs réservés à certains agents", () => {
  it("laisse un connecteur jamais réglé à toute l'équipe", () => {
    expect(autorise(acces, "mcp:notion", "theo")).toBe(true);
    expect(autorise(acces, "api:brevo", "hugo")).toBe(true);
    expect(autorise(acces, "api:brevo", "lea")).toBe(false);
    expect(autorise(acces, "zernio:z1", "sam")).toBe(true);
  });

  it("filtre les comptes d'un agent, et rien sans agent précis", () => {
    const comptes = [{ id: "z1" }, { id: "z2" }];
    expect(filtrer(comptes, (c) => cleZernio(c.id), acces, "hugo")).toEqual([{ id: "z2" }]);
    expect(filtrer(comptes, (c) => cleZernio(c.id), acces, "lea")).toEqual(comptes);
    expect(filtrer(comptes, (c) => cleZernio(c.id), acces, null)).toEqual(comptes);
  });

  it("ramène « tous cochés » à toute l'équipe et refuse une liste vide", () => {
    const equipe = ["lea", "hugo", "sam"];
    expect(agentsRetenus(null, equipe)).toBeNull();
    expect(agentsRetenus(["hugo", "hugo", "inconnu"], equipe)).toEqual(["hugo"]);
    expect(agentsRetenus(["lea", "hugo", "sam"], equipe)).toBeNull();
    expect(agentsRetenus([], equipe)).toHaveProperty("erreur");
    expect(agentsRetenus(["inconnu"], equipe)).toHaveProperty("erreur");
    expect(agentsRetenus("hugo", equipe)).toHaveProperty("erreur");
  });

  it("n'accepte que des clés de connecteur", () => {
    expect(cleValide("api:brevo")).toBe(true);
    expect(cleValide("zernio:65f1a2b3c4")).toBe(true);
    expect(cleValide("")).toBe(false);
    expect(cleValide("a b")).toBe(false);
    expect(cleValide(42)).toBe(false);
  });
});
