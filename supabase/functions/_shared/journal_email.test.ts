import { describe, expect, it } from "vitest";
import { journaliserEmail } from "./journal_email.ts";

/** Faux client : enregistre les insertions, simule l'absence des colonnes d'origine si demandé. */
function fauxDb(opts: { sansOrigine?: boolean; contact?: string | null } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const db = {
    from(table: string) {
      if (table === "contacts") {
        return { select: () => ({ ilike: () => ({ limit: () => ({ maybeSingle: async () => ({ data: opts.contact ? { id: opts.contact } : null }) }) }) }) };
      }
      return {
        insert(row: Record<string, unknown>) {
          return {
            select: () => ({
              maybeSingle: async () => {
                if (opts.sansOrigine && "origine" in row) return { data: null, error: { code: "PGRST204", message: "Could not find the 'origine' column" } };
                inserts.push(row);
                return { data: { id: `id-${inserts.length}` }, error: null };
              },
            }),
          };
        },
      };
    },
  };
  // deno-lint-ignore no-explicit-any
  return { db: db as any, inserts };
}

describe("journaliserEmail", () => {
  it("marque l'origine IA et rattache le contact trouvé par l'adresse", async () => {
    const { db, inserts } = fauxDb({ contact: "c1" });
    const id = await journaliserEmail(db, { destinataires: ["Jean <JEAN@x.fr>"], sujet: "Relance", corps: "Bonjour" }, { origine: "ia_studio", libelle: "Léa (Studio)" });
    expect(id).toBe("id-1");
    expect(inserts[0]).toMatchObject({ direction: "sortant", statut: "envoye", canal: "email", contact_id: "c1", origine: "ia_studio", origine_libelle: "Léa (Studio)" });
  });

  it("garde le contact fourni", async () => {
    const { db, inserts } = fauxDb({ contact: "autre" });
    await journaliserEmail(db, { destinataires: ["a@b.fr"], sujet: "S", corps: null, contact_id: "c9" }, { origine: "ia_assistant", libelle: "Assistant IA" });
    expect(inserts[0].contact_id).toBe("c9");
  });

  it("trace quand même sans les colonnes d'origine (migration pas encore appliquée)", async () => {
    const { db, inserts } = fauxDb({ sansOrigine: true });
    const id = await journaliserEmail(db, { destinataires: ["a@b.fr"], sujet: "S", corps: "x" }, { origine: "automatique", libelle: "Cron" });
    expect(id).toBe("id-1");
    expect(inserts[0]).not.toHaveProperty("origine");
  });
});
