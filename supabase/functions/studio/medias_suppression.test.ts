import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { MESSAGE_SUPPRIME, statutMedia, SUPPRIME, supprimerMedia } from "./medias.ts";

/** Faux client : une ligne studio_medias en mémoire et un stockage qui note les fichiers effacés. */
function faux(ligne: Record<string, unknown> | null) {
  const effaces: string[] = [];
  const maj: Record<string, unknown>[] = [];
  const requete = {
    select: () => requete, eq: () => requete,
    maybeSingle: async () => ({ data: ligne ? { ...ligne } : null }),
    update: (v: Record<string, unknown>) => { maj.push(v); if (ligne) Object.assign(ligne, v); return { eq: async () => ({ error: null }) }; },
  };
  const sb = {
    from: () => requete,
    storage: { from: () => ({ remove: async (c: string[]) => { effaces.push(...c); return { error: null }; } }) },
  } as unknown as SupabaseClient;
  return { sb, effaces, maj };
}

describe("suppression d'un visuel", () => {
  it("efface le fichier et garde la ligne (coûts, quota) sans fichier ni dossier", async () => {
    const ligne = { id: "m1", type: "image", statut: "pret", chemin: "w1/m1.png", prompt: "affiche", mime: "image/png", erreur: null, created_at: new Date().toISOString() };
    const f = faux(ligne);
    expect(await supprimerMedia(f.sb, "w1", "m1")).toEqual({ ok: true, prompt: "affiche", type: "image" });
    expect(f.effaces).toEqual(["w1/m1.png"]);
    expect(f.maj).toEqual([{ chemin: null, dossier_id: null, erreur: SUPPRIME }]);
    expect(ligne.statut).toBe("pret");
  });

  it("refuse un visuel absent, en cours ou déjà supprimé", async () => {
    expect(await supprimerMedia(faux(null).sb, "w1", "x")).toHaveProperty("erreur");
    expect(await supprimerMedia(faux({ id: "m", statut: "en_cours", chemin: null }).sb, "w1", "m")).toHaveProperty("erreur");
    expect(await supprimerMedia(faux({ id: "m", statut: "pret", chemin: null, erreur: SUPPRIME }).sb, "w1", "m")).toHaveProperty("erreur");
  });

  it("se montre comme supprimé dans les conversations", async () => {
    const f = faux({ id: "m1", type: "image", statut: "pret", chemin: null, mime: "image/png", erreur: SUPPRIME, created_at: new Date().toISOString() });
    expect(await statutMedia(f.sb, "cle", "w1", "m1")).toEqual({ id: "m1", type: "image", statut: "echec", mime: "image/png", erreur: MESSAGE_SUPPRIME, url: null });
  });
});
