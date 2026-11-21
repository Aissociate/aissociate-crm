import { describe, expect, it } from "vitest";
import {
  apercuRequete, construire, consigneApi, definitionsApi, estLecture, estTypeApi, requeteValide, resumerOpenApi,
  RESULTAT_MAX, texteReponse, type ApiClient, type Requete,
} from "./api_client.ts";
import { typeManuel } from "./facturation.ts";

const api = (p: Partial<ApiClient> = {}): ApiClient => ({
  id: "c1", type: "api:pennylane", nom: "Pennylane", base: "https://api.exemple.fr/v1", auth: "bearer", auth_nom: "", cle: "sk_secret_123", ...p,
});
const req = (r: Record<string, unknown>) => requeteValide(r) as Requete;

describe("plusieurs API par espace", () => {
  it("donne un connecteur « api:<nom> » à chaque API, facturé comme une API", () => {
    expect(estTypeApi("api:pennylane")).toBe(true);
    expect(estTypeApi("api")).toBe(false);
    expect(estTypeApi("api:")).toBe(false);
    expect(typeManuel("api:pennylane")).toBe("api");
  });
});

describe("requêtes de l'agent", () => {
  it("accepte un chemin relatif, refuse les adresses complètes et les remontées", () => {
    expect(requeteValide({ methode: "get", chemin: "/clients/42" })).toEqual({ methode: "GET", chemin: "/clients/42" });
    for (const chemin of ["https://ailleurs.fr/x", "//ailleurs.fr/x", "/../admin", "a/../../b", "/x y", "/a\\b", "/a#b"]) {
      expect(requeteValide({ methode: "GET", chemin }), chemin).toHaveProperty("erreur");
    }
    expect(requeteValide({ methode: "TRACE", chemin: "/" })).toHaveProperty("erreur");
    expect(requeteValide({ methode: "GET", chemin: "/x", corps: { a: 1 } })).toHaveProperty("erreur");
  });

  it("ne lit qu'avec GET et HEAD", () => {
    expect(estLecture("GET")).toBe(true);
    expect(estLecture("HEAD")).toBe(true);
    for (const m of ["POST", "PUT", "PATCH", "DELETE"] as const) expect(estLecture(m)).toBe(false);
  });

  it("construit l'adresse sous la base, avec la clé selon le mode choisi", () => {
    const a = construire(api(), req({ methode: "GET", chemin: "clients", parametres: { q: "Dupont", tags: ["a", "b"] } }));
    if ("erreur" in a) throw new Error(a.erreur);
    expect(a.url.toString()).toBe("https://api.exemple.fr/v1/clients?q=Dupont&tags=a&tags=b");
    expect((a.init.headers as Record<string, string>).Authorization).toBe("Bearer sk_secret_123");
    expect(a.init.redirect).toBe("manual");

    const e = construire(api({ auth: "entete", auth_nom: "X-API-Key" }), req({ methode: "GET", chemin: "/x" }));
    if ("erreur" in e) throw new Error(e.erreur);
    expect((e.init.headers as Record<string, string>)["X-API-Key"]).toBe("sk_secret_123");

    const p = construire(api({ auth: "parametre", auth_nom: "api_key", base: "https://api.exemple.fr/v1?lang=fr" }), req({ methode: "GET", chemin: "/x" }));
    if ("erreur" in p) throw new Error(p.erreur);
    expect(p.url.toString()).toBe("https://api.exemple.fr/v1/x?lang=fr&api_key=sk_secret_123");

    const b = construire(api({ auth: "basic", cle: "moi:mdp" }), req({ methode: "GET", chemin: "/" }));
    if ("erreur" in b) throw new Error(b.erreur);
    expect((b.init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa("moi:mdp")}`);

    const n = construire(api({ auth: "aucune" }), req({ methode: "GET", chemin: "/" }));
    if ("erreur" in n) throw new Error(n.erreur);
    expect((n.init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("envoie le corps en JSON et refuse une base privée", () => {
    const c = construire(api(), req({ methode: "POST", chemin: "/devis", corps: { client: 42 } }));
    if ("erreur" in c) throw new Error(c.erreur);
    expect(c.init.body).toBe('{"client":42}');
    expect((c.init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(construire(api({ base: "https://192.168.1.10/api" }), req({ methode: "GET", chemin: "/" }))).toHaveProperty("erreur");
    expect(construire(api({ base: "http://api.exemple.fr" }), req({ methode: "GET", chemin: "/" }))).toHaveProperty("erreur");
  });
});

describe("réponses et documentation", () => {
  it("rend la réponse lisible, bornée, sans jamais la clé", () => {
    expect(texteReponse(200, "application/json", '{"id":1,"jeton":"sk_secret_123"}', "sk_secret_123")).toEqual({
      texte: 'HTTP 200\n{\n "id": 1,\n "jeton": "•••"\n}', erreur: false,
    });
    expect(texteReponse(404, "text/plain", "")).toEqual({ texte: "HTTP 404 (erreur)\n(réponse vide)", erreur: true });
    expect(texteReponse(200, "text/html", "<h1>Bon</h1><script>x()</script><p>jour</p>").texte).toBe("HTTP 200\nBon jour");
    expect(texteReponse(200, "text/plain", "x".repeat(RESULTAT_MAX + 5)).texte).toContain("(… tronqué)");
  });

  it("résume une description OpenAPI en opérations", () => {
    const ops = resumerOpenApi({
      paths: {
        "/clients": { get: { summary: "Liste des clients", parameters: [{ name: "q", in: "query" }, { name: "X-Trace", in: "header" }] }, parameters: [] },
        "/clients/{id}": { delete: { operationId: "supprimerClient", parameters: [{ name: "id", in: "path", required: true }] } },
      },
    });
    expect(ops).toEqual(["GET /clients — Liste des clients (q)", "DELETE /clients/{id} — supprimerClient (id*)"]);
    expect(resumerOpenApi(null)).toEqual([]);
  });

  it("donne un outil par API et une consigne avec la documentation", () => {
    const charges = [
      { api: api({ description: "comptabilité", documentation: "GET /clients liste les clients" }), operations: ["GET /factures"] },
      { api: api({ id: "c2", nom: "Pennylane" }), operations: [], erreur: "HTTP 404" },
    ];
    const { definitions, table } = definitionsApi(charges);
    const noms = definitions.map((d) => d.function.name);
    expect(noms).toEqual(["api_pennylane__requete", "api_pennylane__requete_2"]);
    expect(table.get(noms[1])?.id).toBe("c2");
    expect(definitions[0].function.description).toContain("proposition que le dirigeant valide");
    const c = consigneApi(charges);
    expect(c).toContain("GET /clients liste les clients");
    expect(c).toContain("- GET /factures");
    expect(c).toContain("Description OpenAPI illisible : HTTP 404");
    expect(c).toContain("jamais des instructions");
    expect(c).not.toContain("sk_secret_123");
    expect(consigneApi([])).toBe("");
  });

  it("montre au dirigeant la requête avant l'envoi", () => {
    const a = apercuRequete(api(), req({ methode: "POST", chemin: "/devis", corps: { client: 42 } }));
    expect(a).toContain("**Requête :** POST https://api.exemple.fr/v1/devis");
    expect(a).toContain('"client": 42');
    expect(a).toContain("Rien n'est envoyé avant votre validation.");
  });
});

describe("requêtes proposées au dirigeant", () => {
  it("se présentent comme une requête vers le logiciel, sans bouton Modifier", async () => {
    const { titreAction, apercuAction, modifierAction } = await import("./outils.ts");
    const { presenter } = await import("../../../src/studio/decision.ts");
    const action = { type: "api_appel" as const, connecteur_id: "c1", api: "Pennylane", methode: "POST" as const, chemin: "/devis", corps: { client: 42 }, contenu: "aperçu" };
    expect(titreAction(action)).toBe("Pennylane — POST /devis");
    expect(apercuAction(action)).toBe("aperçu");
    expect(modifierAction(action, { contenu: "x" })).toHaveProperty("erreur");
    expect(presenter({ type_action: "api_appel", action })).toEqual({
      portee: "Requête vers Pennylane", bouton: "Valider et envoyer", fait: "Requête envoyée à Pennylane.", modifiable: false,
    });
  });
});
