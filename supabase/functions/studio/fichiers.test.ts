import { describe, expect, it } from "vitest";
import {
  cheminFichier, cheminMorceau, contenuFichier, controleMorceau, fichierStocke, mimeDe, MORCEAU, MORCEAUX_MAX, nomPiece, nomSur,
  TAILLE_MAX, tailleLisible, textePiece,
} from "./fichiers.ts";
import { apercuAction, modifierAction, titreAction, type ActionLivrable } from "./outils.ts";
import { MORCEAU as MORCEAU_NAV, TAILLE_MAX_BRUT, base64, lisible, nbMorceaux } from "../../../src/studio/envoiFichier.ts";

const JETON = "3f2b6c1e-9a7d-4e21-8b44-0123456789ab";

describe("fichiers transmis tels quels", () => {
  it("garde le repère de stockage dans la ressource et le relit", () => {
    const chemin = cheminFichier("ws1", "id1", "Maquette été 2026.psd");
    expect(chemin).toBe("ws1/fichiers/id1-Maquette-ete-2026.psd");
    const contenu = contenuFichier({ nom: "Maquette été 2026.psd", chemin, mime: "image/vnd.adobe.photoshop", taille: 3_200_000 });
    expect(contenu).toContain("pas lu par les agents");
    expect(fichierStocke(contenu, "Maquette été 2026.psd")).toEqual({ nom: "Maquette été 2026.psd", chemin, mime: "image/vnd.adobe.photoshop" });
    expect(fichierStocke("Une note ordinaire", "Tarifs")).toBeNull();
  });
  it("déduit le type et nomme la pièce jointe d'après la ressource", () => {
    expect(mimeDe("son.mp3", "")).toBe("audio/mpeg");
    expect(mimeDe("x.inconnu", null)).toBe("application/octet-stream");
    expect(mimeDe("a.bin", "application/x-custom")).toBe("application/x-custom");
    expect(nomPiece("Maquette (2)", "ws/fichiers/id-Maquette.psd")).toBe("Maquette (2).psd");
    expect(nomPiece("Maquette.psd", "ws/fichiers/id-Maquette.psd")).toBe("Maquette.psd");
    expect(nomSur("../../etc/passwd")).toBe("etc-passwd");
    expect(tailleLisible(2_621_440)).toBe("2,5 Mo");
    expect(textePiece("plan.dwg", 2048, "application/acad")).toContain("« plan.dwg »");
  });
  it("contrôle les morceaux d'un envoi", () => {
    expect(controleMorceau({ jeton: JETON, index: 0, total: 3, taille: MORCEAU })).toBeNull();
    expect(controleMorceau({ jeton: "x/../y", index: 0, total: 1, taille: 10 })).toBe("Envoi invalide.");
    expect(controleMorceau({ jeton: JETON, index: 3, total: 3, taille: 10 })).toBe("Envoi invalide.");
    expect(controleMorceau({ jeton: JETON, index: 0, total: MORCEAUX_MAX + 1, taille: 10 })).toContain("trop volumineux");
    expect(controleMorceau({ jeton: JETON, index: 0, total: 1, taille: MORCEAU + 1 })).toBe("Morceau invalide.");
    expect(cheminMorceau("ws", JETON.toUpperCase(), 2)).toBe(`ws/envois/${JETON}/2`);
  });
  it("le navigateur découpe avec les mêmes réglages que le serveur", () => {
    expect(MORCEAU_NAV).toBe(MORCEAU);
    expect(TAILLE_MAX_BRUT).toBe(TAILLE_MAX);
    expect(nbMorceaux(TAILLE_MAX)).toBe(MORCEAUX_MAX);
    expect(nbMorceaux(1)).toBe(1);
    expect(base64(new TextEncoder().encode("Bonjour"))).toBe(btoa("Bonjour"));
    expect(lisible("devis.PDF")).toBe(true);
    expect(lisible("son.mp3")).toBe(false);
  });
});

describe("pièces jointes et dépôt dans les propositions", () => {
  const piece = { nom: "Plan.dwg", chemin: "ws/fichiers/id-Plan.dwg", mime: "application/acad" };
  it("montre les pièces jointes de l'e-mail à valider", () => {
    const a: ActionLivrable = { type: "gmail_envoyer", a: ["x@y.fr"], objet: "Plan", corps: "Ci-joint.", pieces: [piece] };
    expect(apercuAction(a)).toContain("**Pièces jointes :** Plan.dwg");
    // Modifier le texte garde les pièces jointes.
    const m = modifierAction(a, { a: "x@y.fr", objet: "Plan v2", corps: "Ci-joint." });
    expect(m).toMatchObject({ objet: "Plan v2", pieces: [piece] });
  });
  it("décrit le dépôt d'un fichier tel quel, qui ne se modifie pas", () => {
    const a: ActionLivrable = { type: "drive_deposer_fichier", titre: "Plan.dwg", piece };
    expect(titreAction(a)).toBe("Dépôt — Plan.dwg");
    expect(apercuAction(a)).toContain("Plan.dwg (application/acad)");
    expect(modifierAction(a, {})).toHaveProperty("erreur");
  });
});
