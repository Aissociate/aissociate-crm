import { describe, expect, it } from "vitest";
import {
  citationAuthentique, extraireJson, MAX_PROPOSITIONS, ressemblance, retenir, SIGNATURE, transcrire, versTicket,
  type Contexte, type Conversation, type Message,
} from "./ameliorations_regles.ts";

const ctx: Contexte = { espaces: { w1: "Boulangerie Payet" }, agents: { lea: "Léa", hugo: "Hugo" }, exclus: new Set(["test"]) };
const conv = (id: string, user_id = "u1"): Conversation => ({ id, workspace_id: "w1", agent_id: "lea", titre: "Sujet", user_id });
const msg = (conversation_id: string, role: string, content: string, h: number, agent_id: string | null = "lea"): Message =>
  ({ conversation_id, role, content, agent_id, created_at: `2026-11-20T${String(h).padStart(2, "0")}:00:00Z` });

const messages = [
  msg("a", "user", "Peux-tu m'exporter la liste de mes clients en Excel ? Je dois l'envoyer au comptable chaque mois.", 8, null),
  msg("a", "assistant", "<think>raisonnement</think>Je ne peux pas produire de fichier Excel, voici un tableau.", 9),
  msg("a", "user", "Dommage, je vais devoir tout recopier à la main.", 10, null),
  msg("b", "user", "Bonjour", 11, null),
  msg("t", "user", "Test du contrôle quotidien", 12, null),
  msg("c", "assistant", "Message spontané sans client", 7, "hugo"),
];
const tr = transcrire([conv("a"), conv("b"), conv("t", "test"), conv("c")], messages, ctx);

describe("améliorations — transcription", () => {
  it("écarte les comptes de contrôle et les conversations sans parole client", () => {
    expect(tr.map((t) => t.conversationId)).toEqual(["b", "a"]); // la plus récente d'abord
  });
  it("garde la parole du client, retire le raisonnement, nomme l'espace et l'agent", () => {
    const a = tr.find((t) => t.conversationId === "a")!;
    expect(a.paroleClient).toHaveLength(2);
    expect(a.texte).toContain("Boulangerie Payet");
    expect(a.texte).toContain("LÉA : Je ne peux pas");
    expect(a.texte).not.toContain("raisonnement");
    expect(a.date).toBe("2026-11-20");
  });
});

describe("améliorations — lecture de la réponse du modèle", () => {
  it("extrait le JSON d'un bloc de code ou d'un texte bavard", () => {
    expect(extraireJson('Voici :\n```json\n{"propositions": []}\n```')).toEqual({ propositions: [] });
    expect(extraireJson('<think>{faux}</think> Résultat {"propositions": [{"titre": "x"}]} fin')).toEqual({ propositions: [{ titre: "x" }] });
    expect(extraireJson("rien à signaler")).toBeNull();
  });
});

describe("améliorations — filtrage", () => {
  const ref = tr.find((t) => t.conversationId === "a")!.ref;
  const bonne = {
    titre: "Permettre l'export Excel de la liste des clients",
    categorie: "outil_manquant",
    probleme: "Le client recopie sa liste à la main chaque mois.",
    cas_usage: "Le gérant demande à Léa l'export du mois et l'envoie directement au comptable.",
    proposition: "Ajouter un outil d'export tableur aux agents.",
    citation: "« Je dois l'envoyer au comptable chaque mois »",
    conversation: ref,
  };

  it("retient une proposition complète dont la citation vient du client", () => {
    const { retenues, rejets } = retenir({ propositions: [bonne] }, tr, []);
    expect(rejets).toEqual([]);
    expect(retenues[0]).toMatchObject({ conversation: "a", espace: "Boulangerie Payet", agents: ["Léa"], citation: "Je dois l'envoyer au comptable chaque mois" });
  });

  it("rejette une citation inventée ou prise dans la bouche de l'agent", () => {
    expect(citationAuthentique("Je ne peux pas produire de fichier Excel", tr[1].paroleClient)).toBe(false);
    const { retenues, rejets } = retenir({ propositions: [{ ...bonne, citation: "Je veux un export PDF de toutes mes factures" }] }, tr, []);
    expect(retenues).toEqual([]);
    expect(rejets[0].motif).toMatch(/citation/);
  });

  it("rejette les champs manquants, les catégories et conversations inconnues", () => {
    const { rejets } = retenir({ propositions: [
      { ...bonne, cas_usage: "" },
      { ...bonne, categorie: "reglage_interne" },
      { ...bonne, conversation: "C99" },
      { ...bonne, titre: "Export" },
    ] }, tr, []);
    expect(rejets.map((r) => r.motif)).toEqual([
      "cas d'usage, problème ou proposition manquant", "catégorie inconnue (reglage_interne)", "conversation citée introuvable", "titre absent ou trop court",
    ]);
  });

  it("supporte une réponse sans propositions", () => {
    expect(retenir({ propositions: [] }, tr, []).retenues).toEqual([]);
    expect(retenir(null, tr, []).retenues).toEqual([]);
  });
});

describe("améliorations — dédoublonnage", () => {
  const ref = tr.find((t) => t.conversationId === "a")!.ref;
  const p = (titre: string) => ({ titre, categorie: "friction", probleme: "p", cas_usage: "c", proposition: "x", citation: "je vais devoir tout recopier à la main", conversation: ref });

  it("mesure la ressemblance sur les mots porteurs", () => {
    expect(ressemblance("Permettre l'export Excel des clients", "Ajouter un export Excel de la liste clients")).toBeGreaterThanOrEqual(0.5);
    expect(ressemblance("Permettre l'export Excel des clients", "Publier sur LinkedIn depuis Hugo")).toBe(0);
  });

  it("écarte ce qui est déjà déposé et les doublons du même passage", () => {
    const { retenues, rejets } = retenir({ propositions: [
      p("Ajouter un export Excel de la liste clients"),
      p("Permettre l'export Excel des clients"),
      p("Relancer automatiquement les devis sans réponse"),
    ] }, tr, ["Relancer automatiquement les devis restés sans réponse"]);
    expect(retenues.map((r) => r.titre)).toEqual(["Ajouter un export Excel de la liste clients"]);
    expect(rejets).toHaveLength(2);
    expect(rejets.every((r) => r.motif.startsWith("doublon"))).toBe(true);
  });

  it("plafonne le nombre de propositions par jour", () => {
    const sujets = ["agenda partagé équipe", "signature électronique devis", "relance factures impayées", "traduction anglaise courriels", "import fichier fournisseurs", "rapport hebdomadaire ventes"];
    const { retenues } = retenir({ propositions: sujets.map((s) => p(`Ajouter ${s}`)) }, tr, []);
    expect(retenues).toHaveLength(MAX_PROPOSITIONS);
  });
});

describe("améliorations — format du ticket", () => {
  it("porte titre, cas d'usage, citation, espace, agent et date", () => {
    const { titre, description } = versTicket({
      titre: "Permettre l'export Excel de la liste des clients", categorie: "outil_manquant",
      probleme: "Recopie manuelle.", cas_usage: "Envoi mensuel au comptable.", proposition: "Outil d'export.",
      citation: "Je dois l'envoyer au comptable chaque mois", conversation: "a", espace: "Boulangerie Payet", agents: ["Léa", "Théo"], date: "2026-11-20",
    });
    expect(titre).toBe("Permettre l'export Excel de la liste des clients");
    expect(description.startsWith(SIGNATURE)).toBe(true);
    expect(description).toContain("Catégorie : Outil ou format manquant");
    expect(description).toContain("Espace : Boulangerie Payet — agent(s) : Léa, Théo — conversation du 20/11/2026");
    expect(description).toContain("« Je dois l'envoyer au comptable chaque mois »");
    expect(description).toContain("Cas d'usage : Envoi mensuel au comptable.");
  });
});
