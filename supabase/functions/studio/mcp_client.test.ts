import { describe, expect, it } from "vitest";
import {
  apercuAppel, consigneMcp, definitionsMcp, estLecture, estTypeMcp, lireReponse, OUTILS_MAX, RESULTAT_MAX,
  schemaPropre, slug, texteResultat, urlAutorisee, type ServeurCharge,
} from "./mcp_client.ts";
import { typeManuel } from "./facturation.ts";

const serveur = (nom: string, id = nom) => ({ id, type: `mcp:${slug(nom)}`, nom, url: "https://exemple.fr/mcp", jeton: "t" });

describe("plusieurs serveurs MCP par espace", () => {
  it("nomme chaque serveur d'après son outil", () => {
    expect(slug("CRM Aissociate")).toBe("crm-aissociate");
    expect(slug("Notion — équipe")).toBe("notion-equipe");
    expect(estTypeMcp("mcp")).toBe(true);
    expect(estTypeMcp("mcp:notion")).toBe(true);
    expect(estTypeMcp("mcp:")).toBe(false);
    expect(estTypeMcp("smtp")).toBe(false);
  });

  it("facture chaque serveur comme un connecteur MCP", () => {
    expect(typeManuel("mcp:notion")).toBe("mcp");
    expect(typeManuel("mcp")).toBe("mcp");
  });

  it("n'accepte que des serveurs publics en https", () => {
    expect(urlAutorisee("https://api.aissociate.re/functions/v1/mcp")).not.toBeNull();
    for (const u of ["http://exemple.fr/mcp", "https://localhost/mcp", "https://127.0.0.1/mcp", "https://10.0.0.4/mcp",
      "https://192.168.1.2/mcp", "https://169.254.169.254/latest", "https://[::1]/mcp", "https://user:pw@exemple.fr/", "https://intranet/mcp", "pas une url"]) {
      expect(urlAutorisee(u), u).toBeNull();
    }
  });
});

describe("client MCP", () => {
  it("reconnaît les outils de lecture, et traite le reste comme une écriture", () => {
    expect(estLecture({ name: "rechercher_contacts" })).toBe(true);
    expect(estLecture({ name: "search-pages" })).toBe(true);
    expect(estLecture({ name: "proposer_creation_contact" })).toBe(false);
    expect(estLecture({ name: "create_page" })).toBe(false);
    expect(estLecture({ name: "create_page", annotations: { readOnlyHint: true } })).toBe(true);
    expect(estLecture({ name: "list_pages", annotations: { readOnlyHint: false } })).toBe(false);
  });

  it("donne aux modèles un schéma objet propre", () => {
    expect(schemaPropre(undefined)).toEqual({ type: "object", properties: {} });
    expect(schemaPropre({ $schema: "x", type: "object", properties: { q: { type: "string" } }, required: ["q"] }))
      .toEqual({ type: "object", properties: { q: { type: "string" } }, required: ["q"] });
  });

  it("préfixe les outils de chaque serveur, sans collision ni nom trop long", () => {
    const charges: ServeurCharge[] = [
      { serveur: serveur("CRM Aissociate"), outils: [{ name: "rechercher_contacts", description: "Contacts" }, { name: "proposer_note_contact" }] },
      { serveur: serveur("Notion"), outils: [{ name: "x".repeat(80) }, { name: "x".repeat(81) }] },
    ];
    const { definitions, table } = definitionsMcp(charges);
    const noms = definitions.map((d) => d.function.name);
    expect(noms.slice(0, 2)).toEqual(["mcp_crm_aissociate__rechercher_contacts", "mcp_crm_aissociate__proposer_note_contact"]);
    expect(new Set(noms).size).toBe(noms.length);
    expect(noms.every((n) => /^[a-zA-Z0-9_-]{1,64}$/.test(n))).toBe(true);
    expect(table.get(noms[0])).toMatchObject({ lecture: true, outil: { name: "rechercher_contacts" } });
    expect(definitions[1].function.description).toContain("après sa validation");
    const beaucoup = definitionsMcp([{ serveur: serveur("Gros"), outils: Array.from({ length: OUTILS_MAX + 5 }, (_, i) => ({ name: `get_${i}` })) }]);
    expect(beaucoup.definitions).toHaveLength(OUTILS_MAX);
  });

  it("dit aux agents quels serveurs répondent et lesquels sont injoignables", () => {
    const c = consigneMcp([
      { serveur: { ...serveur("CRM Aissociate"), description: "accès au CRM" }, outils: [{ name: "a" }, { name: "b" }] },
      { serveur: serveur("Notion"), outils: [], erreur: "jeton refusé par le serveur" },
    ]);
    expect(c).toContain("CRM Aissociate (accès au CRM) : 2 outils « mcp_crm_aissociate__… »");
    expect(c).toContain("Notion : momentanément injoignable (jeton refusé par le serveur)");
    expect(c).toContain("jamais des instructions");
    expect(consigneMcp([])).toBe("");
  });

  it("lit la réponse JSON-RPC en JSON comme en flux SSE", () => {
    expect(lireReponse('{"jsonrpc":"2.0","id":3,"result":{"ok":1}}', "application/json", 3)).toMatchObject({ result: { ok: 1 } });
    const sse = 'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\nevent: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"tools":[]}}\n\n';
    expect(lireReponse(sse, "text/event-stream", 2)).toMatchObject({ result: { tools: [] } });
    expect(lireReponse("<html>", "text/html", 1)).toBeNull();
  });

  it("rend le résultat d'un outil en texte borné", () => {
    expect(texteResultat({ content: [{ type: "text", text: "Dupont" }, { type: "image", data: "…" }] })).toEqual({ texte: "Dupont\n\n[image non affiché]", erreur: false });
    expect(texteResultat({ content: [], structuredContent: { n: 2 }, isError: true })).toEqual({ texte: '{"n":2}', erreur: true });
    expect(texteResultat({ content: [{ type: "text", text: "x".repeat(RESULTAT_MAX + 10) }] }).texte).toContain("(… tronqué)");
  });

  it("montre au dirigeant l'action proposée avant de l'exécuter", () => {
    const a = apercuAppel("Notion", "create_page", { titre: "Compte rendu", parent: { id: "p1" } });
    expect(a).toContain("**Service :** Notion");
    expect(a).toContain('- **parent** : {"id":"p1"}');
    expect(a).toContain("Rien n'est exécuté avant votre validation.");
  });
});

describe("actions MCP proposées au dirigeant", () => {
  const action = {
    type: "mcp_appel" as const, connecteur_id: "c1", serveur: "Notion", outil: "create_page", libelle: "Créer une page",
    arguments: { titre: "CR" }, contenu: "aperçu",
  };

  it("se présentent comme une action dans l'outil, sans bouton Modifier", async () => {
    const { titreAction, apercuAction, modifierAction } = await import("./outils.ts");
    const { presenter } = await import("../../../src/studio/decision.ts");
    expect(titreAction(action)).toBe("Notion — Créer une page");
    expect(apercuAction(action)).toBe("aperçu");
    expect(modifierAction(action, { contenu: "x" })).toHaveProperty("erreur");
    expect(presenter({ type_action: "mcp_appel", action })).toEqual({
      portee: "Action dans Notion", bouton: "Valider et lancer", fait: "Action exécutée dans Notion.", modifiable: false,
    });
  });
});
