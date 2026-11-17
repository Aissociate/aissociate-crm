import { describe, expect, it } from "vitest";
import { controlePublication, corpsPublication, dateProgrammee, mediasValides } from "./zernio.ts";
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

describe("zernio — programmation", () => {
  const maintenant = Date.parse("2026-11-17T10:00:00+04:00");
  it("accepte une date future en heure de La Réunion", () => {
    expect(dateProgrammee("2026-11-18T09:30", maintenant)).toBe("2026-11-18T09:30");
    expect(dateProgrammee("2026-11-18 09:30", maintenant)).toBe("2026-11-18T09:30");
    expect(dateProgrammee("", maintenant)).toBeNull();
  });
  it("refuse une date passée ou mal formée", () => {
    expect(dateProgrammee("2026-11-17T10:02", maintenant)).toBe("invalide");
    expect(dateProgrammee("demain", maintenant)).toBe("invalide");
  });
  it("programme au lieu de publier tout de suite", () => {
    const b = corpsPublication([{ id: "a1", reseau: "linkedin" }], "x", [], "2026-11-18T09:30");
    expect(b).toMatchObject({ scheduledFor: "2026-11-18T09:30", timezone: "Indian/Reunion" });
    expect("publishNow" in b).toBe(false);
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
  it("réponse à un commentaire : titre, aperçu, texte modifiable", () => {
    const r: ActionLivrable = { type: "reseaux_repondre_commentaire", compte: { id: "a1", reseau: "facebook", nom: "Aissociate" }, publication_id: "p1", commentaire_id: "c1", cite: "Marie : Combien ça coûte ?", texte: "Bonjour Marie, je vous écris en privé." };
    expect(titreAction(r)).toMatch(/^Réponse Facebook — Bonjour Marie/);
    expect(apercuAction(r)).toContain("« Marie : Combien ça coûte ? »");
    expect(modifierAction(r, { texte: "Merci !" })).toMatchObject({ texte: "Merci !", publication_id: "p1" });
    expect(modifierAction(r, { texte: " " })).toHaveProperty("erreur");
  });
});
