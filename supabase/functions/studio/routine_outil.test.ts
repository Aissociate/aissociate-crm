import { describe, expect, it } from "vitest";
import { actionRoutine, CONSIGNE_ROUTINE, definitionRoutine, NOM_OUTIL_ROUTINE } from "./routine_outil.ts";
import { apercuAction, modifierAction, titreAction } from "./outils.ts";
import { presenter } from "../../../src/studio/decision.ts";

const EQUIPE = [{ id: "lea", prenom: "Léa" }, { id: "hugo", prenom: "Hugo" }, { id: "theo", prenom: "Théo" }];
const ARGS = {
  titre: "Posts réseaux lundi, mercredi, vendredi",
  agent: "hugo",
  etapes: [
    { type: "agent", agent: "theo", texte: "Théo sélectionne 3 actualités du jour" },
    { type: "agent", agent: "hugo", texte: "Hugo rédige un post par réseau avec un visuel" },
    { type: "envoi", agent: "hugo", texte: "Hugo publie aux créneaux prévus" },
  ],
  consigne: "Suivre la méthode « Compétence — Publication réseaux » : punchline, fait daté, question ouverte, source.",
  jours: [1, 3, 5],
  heures: [7],
};

describe("routine proposée par Léa depuis le chat", () => {
  it("n'offre que les agents de l'équipe", () => {
    const d = definitionRoutine(EQUIPE);
    expect(d.function.name).toBe(NOM_OUTIL_ROUTINE);
    expect((d.function.parameters as { properties: { agent: { enum: string[] } } }).properties.agent.enum).toEqual(["lea", "hugo", "theo"]);
    expect(CONSIGNE_ROUTINE).toContain("N'annonce jamais une routine");
  });

  it("devient une décision à valider, avec « Vous validez » ajouté devant la publication", () => {
    const a = actionRoutine(ARGS, EQUIPE, "u1");
    if ("erreur" in a) throw new Error(a.erreur);
    expect(a).toMatchObject({ type: "routine_creer", agent: "hugo", jours: [1, 3, 5], heures: [7], user_id: "u1" });
    const types = a.etapes.map((e) => e.type);
    expect(types.indexOf("validation")).toBeGreaterThan(-1);
    expect(types.indexOf("validation")).toBeLessThan(types.indexOf("envoi"));
    expect(titreAction(a)).toBe("Routine — Posts réseaux lundi, mercredi, vendredi");
    const apercu = apercuAction(a);
    expect(apercu).toContain("**Exécutée par :** Hugo");
    expect(apercu).toContain("Hugo rédige un post");
    expect(apercu).toContain("mode essai pendant 7 jours");
    expect(apercu).toContain("Compétence — Publication réseaux");
    expect(modifierAction(a, { contenu: "x" })).toHaveProperty("erreur");
  });

  it("renvoie à l'agent une erreur à corriger plutôt qu'un planning inventé", () => {
    expect(actionRoutine({ ...ARGS, jours: [] }, EQUIPE, null)).toHaveProperty("erreur");
    expect(actionRoutine({ ...ARGS, heures: [2] }, EQUIPE, null)).toHaveProperty("erreur");
    expect(actionRoutine({ ...ARGS, consigne: "court" }, EQUIPE, null)).toHaveProperty("erreur");
    expect(actionRoutine({ ...ARGS, etapes: [{ type: "agent", agent: "inconnu", texte: "Zoé fait tout" }] }, EQUIPE, null)).toHaveProperty("erreur");
  });

  it("se présente comme une routine à l'essai, sans bouton Modifier", () => {
    expect(presenter({ type_action: "routine_creer", action: {} })).toMatchObject({
      portee: "Nouvelle routine, en essai 7 jours", bouton: "Créer la routine à l'essai", modifiable: false,
    });
    expect(presenter({ type_action: "gmail_envoyer", action: { a: ["x@y.fr"] } }).modifiable).toBeUndefined();
  });
});
