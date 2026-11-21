import { describe, expect, it } from "vitest";
import { GESTION_MAX, idsValides, opGestion } from "./lots.ts";

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
