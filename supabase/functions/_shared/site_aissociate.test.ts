import { describe, expect, it } from "vitest";
import { connaissanceSite, LIEN_INSCRIPTION_STUDIO, PAGES_SITE } from "./site_aissociate.ts";

describe("connaissance du site pour l'assistant du CRM", () => {
  it("donne le lien d'inscription au Studio IA et l'offre chiffrée", () => {
    const t = connaissanceSite("studio");
    expect(LIEN_INSCRIPTION_STUDIO).toBe("https://aissociate.re/studio/demarrer");
    expect(t).toContain(LIEN_INSCRIPTION_STUDIO);
    expect(t).toMatch(/Stage/);
    expect(t).toMatch(/€ HT par mois/);
    expect(t).toContain("Léa");
  });

  it("liste des pages en liens complets", () => {
    expect(PAGES_SITE.every((p) => p.url.startsWith("https://aissociate.re/"))).toBe(true);
    expect(connaissanceSite("liens")).toContain("https://aissociate.re/formulaire");
    expect(connaissanceSite("liens")).not.toContain("## Studio IA");
  });

  it("services : formations, assistance, développement", () => {
    const t = connaissanceSite("services");
    expect(t).toContain("/formations");
    expect(t).toContain("/assistance");
    expect(t).toContain("/developpement");
  });
});
