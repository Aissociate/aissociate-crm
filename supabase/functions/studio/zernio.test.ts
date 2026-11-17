import { describe, expect, it } from "vitest";
import { controlePublication, corpsPublication, mediasValides } from "./zernio.ts";
import { apercuAction, modifierAction, titreAction, type ActionLivrable } from "./outils.ts";

describe("zernio — contrôles de publication", () => {
  it("exige un média pour Instagram et TikTok", () => {
    expect(controlePublication(["instagram"], "Bonjour", [])).toMatch(/Instagram exige/);
    expect(controlePublication(["instagram", "tiktok"], "Bonjour", [])).toMatch(/Instagram et TikTok exigent/);
    expect(controlePublication(["facebook", "linkedin"], "Bonjour", [])).toBeNull();
    expect(controlePublication(["instagram"], "Bonjour", ["https://x.fr/a.jpg"])).toBeNull();
  });
  it("refuse une publication vide ou trop longue", () => {
    expect(controlePublication([], "x", [])).toMatch(/au moins un compte/);
    expect(controlePublication(["facebook"], "  ", [])).toMatch(/requis/);
    expect(controlePublication(["linkedin"], "a".repeat(3001), [])).toMatch(/3 000/);
  });
  it("valide les adresses de médias", () => {
    expect(mediasValides("https://a.fr/1.jpg, https://a.fr/2.png\nhttps://a.fr/1.jpg")).toEqual(["https://a.fr/1.jpg", "https://a.fr/2.png"]);
    expect(mediasValides("")).toEqual([]);
    expect(mediasValides("http://a.fr/x.jpg")).toBeNull();
    expect(mediasValides("javascript:alert(1)")).toBeNull();
  });
  it("construit la requête : publication immédiate, TikTok en brouillon", () => {
    const b = corpsPublication([{ id: "a1", reseau: "facebook" }, { id: "a2", reseau: "tiktok" }], "Salut", ["https://x.fr/v.mp4"]);
    expect(b.publishNow).toBe(true);
    expect(b.platforms).toEqual([
      { platform: "facebook", accountId: "a1" },
      { platform: "tiktok", accountId: "a2", platformSpecificData: { draft: true } },
    ]);
    expect(b.mediaItems).toEqual([{ url: "https://x.fr/v.mp4" }]);
    expect("mediaItems" in corpsPublication([{ id: "a1", reseau: "linkedin" }], "x", [])).toBe(false);
  });
});

describe("livrable de publication", () => {
  const action: ActionLivrable = { type: "reseaux_publier", texte: "Nouvelle formation IA ce jeudi !", comptes: [{ id: "a1", reseau: "facebook", nom: "Aissociate" }] };
  it("titre et aperçu lisibles", () => {
    expect(titreAction(action)).toBe("Publication Facebook — Nouvelle formation IA ce jeudi !");
    expect(apercuAction(action)).toContain("**Sur :** Facebook (Aissociate)");
  });
  it("modification revalidée", () => {
    expect(modifierAction(action, { texte: "Autre texte", medias: "" })).toMatchObject({ texte: "Autre texte", medias: [] });
    expect(modifierAction(action, { texte: "x", medias: "http://non" })).toHaveProperty("erreur");
    const insta: ActionLivrable = { ...action, comptes: [{ id: "a2", reseau: "instagram", nom: "aissociate" }] };
    expect(modifierAction(insta, { texte: "x", medias: "" })).toHaveProperty("erreur");
  });
});
