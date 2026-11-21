import { describe, expect, it } from "vitest";
import {
  bilanEchecs, demandeLot, DOCUMENT_TEXTE, GESTION_MAX, idsValides, lisible, LOT_MAX, messageLot, opGestion, piecesLot,
  SYNTHESE_MAX, SYNTHESE_TEXTE, titreLot,
} from "./lots.ts";
import * as client from "../../../src/studio/ressources/ConfierLot.tsx";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("gestion groupée des ressources", () => {
  it("garde des identifiants uniques et bien formés", () => {
    expect(idsValides([id(1), id(1), id(2), "pas-un-id", 3], GESTION_MAX)).toEqual([id(1), id(2)]);
  });

  it("refuse une sélection vide, invalide ou trop grande", () => {
    expect(idsValides([], GESTION_MAX)).toHaveProperty("erreur");
    expect(idsValides(["x"], GESTION_MAX)).toHaveProperty("erreur");
    expect(idsValides(Array.from({ length: GESTION_MAX + 1 }, (_, i) => id(i)), GESTION_MAX)).toHaveProperty("erreur");
  });

  it("ne connaît que les quatre opérations prévues", () => {
    expect(["activer", "desactiver", "ranger", "supprimer"].map(opGestion)).toEqual(["activer", "desactiver", "ranger", "supprimer"]);
    expect(opGestion("vider")).toBeNull();
  });
});

describe("documents confiés à un agent", () => {
  const AGENTS = ["lea", "hugo"];
  const base = { ids: [id(1), id(2)], agent_id: "hugo", consigne: "Résume chaque document en 5 points", mode: "chaque" };

  it("le navigateur affiche les mêmes bornes que le serveur", () => {
    expect([client.LOT_MAX, client.SYNTHESE_MAX]).toEqual([LOT_MAX, SYNTHESE_MAX]);
  });

  it("valide la demande, ou dit ce qui manque", () => {
    expect(demandeLot(base, AGENTS)).toEqual({ ...base, mode: "chaque" });
    expect(demandeLot({ ...base, mode: "synthese" }, AGENTS)).toMatchObject({ mode: "synthese" });
    expect(demandeLot({ ...base, agent_id: "zoe" }, AGENTS)).toHaveProperty("erreur");
    expect(demandeLot({ ...base, consigne: "ok" }, AGENTS)).toHaveProperty("erreur");
    const trop = Array.from({ length: SYNTHESE_MAX + 1 }, (_, i) => id(i));
    expect(demandeLot({ ...base, ids: trop }, AGENTS)).not.toHaveProperty("erreur");
    expect(demandeLot({ ...base, ids: trop, mode: "synthese" }, AGENTS)).toEqual({ erreur: `Une synthèse lit ${SYNTHESE_MAX} documents au plus.` });
  });

  it("ne lit jamais un document sensible encore désactivé", () => {
    expect(lisible({ actif: false, sensible: "rib" })).toBe(false);
    expect(lisible({ actif: true, sensible: "rib" })).toBe(true);
    expect(lisible({ actif: false, sensible: null })).toBe(true);
  });

  it("joint un document par passage, ou tous bornés pour la synthèse", () => {
    const doc = (n: number, taille: number) => ({ id: id(n), titre: `Doc ${n}`, contenu: "x".repeat(taille), actif: true });
    const un = piecesLot([doc(1, DOCUMENT_TEXTE + 10), doc(2, 10)], "chaque");
    expect(un).toHaveLength(1);
    expect(un[0].contenu).toHaveLength(DOCUMENT_TEXTE);
    const tous = piecesLot(Array.from({ length: 4 }, (_, i) => doc(i, SYNTHESE_TEXTE)), "synthese");
    expect(tous).toHaveLength(4);
    expect(tous.reduce((n, p) => n + p.contenu.length, 0)).toBeLessThanOrEqual(SYNTHESE_TEXTE);
  });

  it("donne à l'agent la consigne et lui interdit d'envoyer quoi que ce soit", () => {
    const m = messageLot("Extrais les tarifs", "chaque", ["Offre 2026.pdf"]);
    expect(m).toContain("« Offre 2026.pdf »");
    expect(m).toContain("Consigne : Extrais les tarifs");
    expect(m).toContain("N'envoie, ne publie et ne soumets rien");
    expect(messageLot("Compare", "synthese", ["A", "B"])).toContain("Les 2 documents joints");
  });

  it("titre les livrables et le bilan des échecs", () => {
    expect(titreLot("Extrais les tarifs", "chaque", ["Offre.pdf"])).toBe("Extrais les tarifs — Offre.pdf");
    expect(titreLot("x".repeat(80), "synthese", ["A", "B", "C"])).toMatch(/^x{57}… — synthèse de 3 documents$/);
    expect(bilanEchecs("Résume", 5, [{ titre: "gros.pdf", erreur: "quota atteint" }])).toContain("- gros.pdf : quota atteint");
  });
});
