import { describe, expect, it } from "vitest";
import { fichesPossibles, libellePack, messageEpuise, OFFERTS_STAGE, PACK_DEFAUT, packEffectif } from "./prospection_option.ts";

describe("option Prospection (contacts prépayés)", () => {
  it("packEffectif : 15 € HT les 1 000 contacts par défaut, Paramètres sinon", () => {
    expect(packEffectif({})).toEqual({ prix: 15, contacts: 1000 });
    expect(packEffectif({ prospection_pack_prix_ht: "19,90", prospection_pack_contacts: "500" })).toEqual({ prix: 19.9, contacts: 500 });
    expect(packEffectif({ prospection_pack_prix_ht: "-1", prospection_pack_contacts: "abc" })).toEqual(PACK_DEFAUT);
  });

  it("libellePack : prix et volume lisibles", () => {
    expect(libellePack(PACK_DEFAUT)).toBe("15 € HT les 1 000 contacts");
    expect(libellePack({ prix: 19.9, contacts: 500 })).toBe("19,90 € HT les 500 contacts");
  });

  it("fichesPossibles : la demande bornée par le solde, jamais négative", () => {
    expect(fichesPossibles(20, 1000)).toBe(20);
    expect(fichesPossibles(20, OFFERTS_STAGE)).toBe(10);
    expect(fichesPossibles(20, 0)).toBe(0);
    expect(fichesPossibles(20, -3)).toBe(0);
  });

  it("messageEpuise : activer la première fois, racheter ensuite", () => {
    expect(messageEpuise(PACK_DEFAUT, false)).toContain("n'est pas activée");
    expect(messageEpuise(PACK_DEFAUT, false)).toContain("15 € HT les 1 000 contacts");
    expect(messageEpuise(PACK_DEFAUT, true)).toContain("épuisés");
    expect(messageEpuise(PACK_DEFAUT, true)).toContain("Mon périmètre");
  });
});
