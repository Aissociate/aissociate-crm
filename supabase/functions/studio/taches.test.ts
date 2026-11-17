import { describe, expect, it } from "vitest";
import { consigneTache, egaliteSure, libellePlanning, planningValide, prochaineExecution } from "./taches.ts";
import { attendReponse } from "./zernio.ts";

// Mardi 17 novembre 2026, 10 h 20 à La Réunion (06:20 UTC).
const maintenant = new Date("2026-11-17T10:20:00+04:00");
const reunion = (d: Date | null) => d && new Date(d.getTime() + 4 * 3_600_000).toISOString().slice(0, 16);

describe("tâches — planning", () => {
  it("valide jours et heures", () => {
    expect(planningValide({ heures: [14, 9, 9, "18"], jours: [3, 1] })).toEqual({ heures: [9, 14, 18], jours: [1, 3] });
    expect(planningValide({ heures: [9], jours: [] })).toHaveProperty("erreur");
    expect(planningValide({ heures: [24, -1], jours: [1] })).toHaveProperty("erreur");
    expect(planningValide({ heures: [...Array(13).keys()], jours: [1] })).toHaveProperty("erreur");
  });
  it("prochain passage à l'heure pile, heure de La Réunion", () => {
    expect(reunion(prochaineExecution({ heures: [9, 14, 18], jours: [1, 2, 3, 4, 5, 6, 7] }, maintenant))).toBe("2026-11-17T14:00");
    expect(reunion(prochaineExecution({ heures: [9], jours: [1, 2, 3, 4, 5, 6, 7] }, maintenant))).toBe("2026-11-18T09:00");
    // Lundi seulement : lundi 23 novembre.
    expect(reunion(prochaineExecution({ heures: [8], jours: [1] }, maintenant))).toBe("2026-11-23T08:00");
    // Exactement à l'heure : passage suivant, jamais le même.
    expect(reunion(prochaineExecution({ heures: [10, 11], jours: [2] }, new Date("2026-11-17T10:00:00+04:00")))).toBe("2026-11-17T11:00");
    expect(prochaineExecution({ heures: [], jours: [1] }, maintenant)).toBeNull();
  });
  it("libellé lisible", () => {
    expect(libellePlanning({ heures: [9, 14, 18], jours: [1, 2, 3, 4, 5, 6, 7] })).toBe("Tous les jours à 9 h, 14 h et 18 h");
    expect(libellePlanning({ heures: [9], jours: [1, 2, 3, 4, 5] })).toBe("Du lundi au vendredi à 9 h");
    expect(libellePlanning({ heures: [8], jours: [1] })).toBe("Le lundi à 8 h");
    expect(libellePlanning({ heures: [8], jours: [2, 4] })).toBe("Les mardi et jeudi à 8 h");
  });
  it("consigne de passage automatique", () => {
    const c = consigneTache("Messages", "Vérifie mes messages.", maintenant);
    expect(c).toMatch(/^Tâche planifiée « Messages »/);
    expect(c).toContain("Ne repropose pas");
    expect(c.endsWith("Vérifie mes messages.")).toBe(true);
  });
  it("clé comparée à temps constant", async () => {
    expect(await egaliteSure("abc", "abc")).toBe(true);
    expect(await egaliteSure("abc", "abd")).toBe(false);
  });
});

describe("messages sans réponse", () => {
  it("le dernier message vient du contact", () => {
    expect(attendReponse([{ direction: "incoming" }, { direction: "outgoing" }])).toBe(true);
    expect(attendReponse([{ direction: "outgoing" }, { direction: "incoming" }])).toBe(false);
    expect(attendReponse([{ direction: "outgoing", isDeleted: true }, { direction: "incoming" }])).toBe(true);
    expect(attendReponse([])).toBe(false);
  });
});
