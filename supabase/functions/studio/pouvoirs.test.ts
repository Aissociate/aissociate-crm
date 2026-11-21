import { describe, expect, it } from "vitest";
import {
  ajoutMedias, completerReferences, consigneMedia, definitionMedia, listePouvoirs, marqueurMedia, mediasDe, NOM_OUTIL_MEDIA, pouvoirsMedia,
  referenceMedia, rendrePouvoir, sansMarqueurs, separerMedias, dureeLien, valeurChamp,
} from "./pouvoirs.ts";
import { mediasDuMessage, sansMarqueursMedia } from "../../../src/studio/marqueursMedia.ts";
import type { SuperPouvoir } from "./contexte.ts";
import { apercuAction, modifierAction, type ActionLivrable } from "./outils.ts";

const VISUEL: SuperPouvoir = {
  id: "visuel_ia", titre: "Créer un visuel", media: "image",
  champs: [
    { nom: "sujet", label: "Que doit montrer le visuel ?", type: "long", requis: true },
    { nom: "format", label: "Format", type: "choix", requis: true, options: ["1:1", "4:5", "16:9", "9:16"] },
    { nom: "style", label: "Style", type: "choix", options: ["Photo réaliste", "Illustration"] },
  ],
  gabarit: "{{sujet}}. Style : {{style}}. Aucun texte incrusté.",
};
const POST: SuperPouvoir = {
  id: "post", titre: "Générer un post",
  champs: [{ nom: "sujet", label: "Sujet", type: "long", requis: true }, { nom: "reseau", label: "Réseau", type: "choix", options: ["LinkedIn", "Facebook"] }],
  gabarit: "Rédige un post {{reseau}} sur : {{sujet}}",
};
const ID = "0f8e2c1a-1111-4b2c-9d3e-aaaaaaaaaaaa";

describe("super-pouvoirs utilisés par les agents", () => {
  it("remplit le gabarit comme le formulaire, et signale un champ requis manquant", () => {
    const r = rendrePouvoir(VISUEL, { sujet: "Une vitrine au lever du jour", format: "4:5" });
    expect(r).toMatchObject({ question: "Une vitrine au lever du jour. Style : (non précisé). Aucun texte incrusté.", media: { type: "image", format: "4:5" } });
    expect(rendrePouvoir(VISUEL, { format: "1:1" })).toMatchObject({ manquant: { nom: "sujet" } });
    expect(rendrePouvoir(POST, { sujet: "Nos 10 ans", reseau: "LinkedIn" })).toMatchObject({ media: null, question: "Rédige un post LinkedIn sur : Nos 10 ans" });
  });
  it("accepte un choix proche de l'option (agent), mais pas une valeur inventée", () => {
    const format = VISUEL.champs[1];
    expect(valeurChamp(format, "Portrait (4:5)")).toBe("4:5");
    expect(valeurChamp(VISUEL.champs[2], "illustration")).toBe("Illustration");
    expect(valeurChamp(format, "panoramique")).toBe("");
    expect(valeurChamp(format, "1")).toBe("");
  });
  it("n'outille que les agents qui ont un super-pouvoir média", () => {
    expect(pouvoirsMedia([POST])).toEqual([]);
    const d = definitionMedia(pouvoirsMedia([POST, VISUEL]));
    expect(d.function.name).toBe(NOM_OUTIL_MEDIA);
    expect((d.function.parameters as { properties: { pouvoir: { enum: string[] } } }).properties.pouvoir.enum).toEqual(["visuel_ia"]);
    expect(d.function.description).toContain("format (requis) : 1:1 | 4:5");
    expect(consigneMedia([VISUEL])).toContain("« Créer un visuel »");
  });
  it("liste les super-pouvoirs d'un spécialiste pour Léa", () => {
    expect(listePouvoirs([VISUEL, POST])).toContain("visuel_ia (Créer un visuel, visuel créé directement");
    expect(listePouvoirs(undefined)).toBe("");
  });
});

describe("repères de médias dans une réponse", () => {
  it("ajoute les médias absents du texte, une fois chacun", () => {
    const m = [{ id: ID, type: "image" as const }];
    const texte = "Voici le visuel." + ajoutMedias("Voici le visuel.", m);
    expect(mediasDe(texte)).toEqual(m);
    expect(ajoutMedias(texte, m)).toBe("");
    expect(sansMarqueurs(texte)).toBe("Voici le visuel.");
  });
  it("le navigateur relit les repères écrits par le serveur", () => {
    const texte = `Post prêt.\n\n${marqueurMedia(ID, "video")}`;
    expect(mediasDuMessage(texte)).toEqual([{ id: ID, type: "video", statut: "en_cours" }]);
    // Déjà reçu en direct : pas de doublon.
    expect(mediasDuMessage(texte, [{ id: ID, type: "video", statut: "pret", url: "u" }])).toHaveLength(1);
    expect(sansMarqueursMedia(texte)).toBe("Post prêt.");
  });
});

describe("visuel du Studio dans une publication à valider", () => {
  it("sépare les références media:… des adresses https", () => {
    expect(separerMedias(`media:${ID.toUpperCase()}, https://x.fr/a.png [[MEDIA:${ID}:image]]`))
      .toEqual({ studio: [ID], adresses: ["https://x.fr/a.png"] });
    expect(referenceMedia(ID)).toBe(`media:${ID}`);
  });
  it("garde le lien signé valable jusqu'à la publication programmée", () => {
    const maintenant = Date.parse("2026-11-21T08:00:00+04:00");
    expect(dureeLien(null, maintenant)).toBe(2 * 86_400);
    expect(dureeLien("2026-11-24T08:00", maintenant)).toBe(5 * 86_400);
    expect(dureeLien("2027-06-01T08:00", maintenant)).toBe(30 * 86_400);
  });
  it("montre le visuel dans l'aperçu de la décision, et le garde quand on modifie le texte", () => {
    const a: ActionLivrable = {
      type: "reseaux_publier", texte: "Rentrée !", medias: [], programme: null,
      comptes: [{ id: "c1", reseau: "instagram", nom: "Démo" }], visuels: [{ id: ID, type: "image" }],
    };
    const apercu = apercuAction(a);
    expect(apercu).toContain("Visuel créé par l'équipe");
    expect(mediasDuMessage(apercu)).toEqual([{ id: ID, type: "image", statut: "en_cours" }]);
    // Instagram exige un média : le visuel du Studio en tient lieu.
    expect(modifierAction(a, { texte: "Rentrée 2026 !" })).toMatchObject({ texte: "Rentrée 2026 !", visuels: [{ id: ID }] });
  });
});

describe("références media:… abrégées par un agent", () => {
  const A = "de54207b-9502-4789-846b-5e222a8433fa", B = "bb8facc2-4014-44e7-8aa1-32babeef2063";
  it("complète un préfixe qui désigne un seul média de l'espace", () => {
    expect(completerReferences("Produit (réf. media:de54207b)", [A, B])).toBe(`Produit (réf. media:${A})`);
    expect(completerReferences(`déjà entier media:${B}.`, [A, B])).toBe(`déjà entier media:${B}.`);
  });
  it("laisse intact un préfixe inconnu ou ambigu", () => {
    expect(completerReferences("media:ffffffff", [A, B])).toBe("media:ffffffff");
    expect(completerReferences("media:de5420", [A, "de5420aa-0000-0000-0000-000000000000"])).toBe("media:de5420");
  });
  it("l'aperçu d'un document montre les visuels cités par référence", () => {
    expect(mediasDuMessage(`<td>Produit (réf. media:${A})</td>`)).toEqual([{ id: A, type: "image", statut: "en_cours" }]);
  });
});
