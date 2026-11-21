import { describe, expect, it } from "vitest";
import {
  bilanPassages, chaine, consigneDe, consigneProposition, consigneModele, enClair, erreurReglages, etapesEnregistrees, historique, MODELES, modeleDe,
  modelesPour, normaliserEtapes, reglagesDe, resume, validerProposition, type Passage,
} from "./routines.ts";

const prenoms = new Map([["theo", "Théo"], ["lea", "Léa"], ["sam", "Sam"], ["hugo", "Hugo"], ["ines", "Inès"], ["nora", "Nora"], ["mael", "Maël"]]);
const impayes = modeleDe("impayes")!;
const routine = (reglages: Record<string, unknown> = {}, modele = "impayes") => ({
  titre: "Relancer les factures impayées", agent_id: "theo", heures: [8], jours: [1], modele, reglages,
});

describe("routines — chaîne et validation verrouillée", () => {
  it("ajoute « Vous validez » devant le premier envoi", () => {
    expect(normaliserEtapes([{ type: "agent", agent: "theo", texte: "a" }, { type: "envoi", agent: "theo", texte: "b" }]).map((e) => e.type))
      .toEqual(["agent", "validation", "envoi"]);
  });
  it("ne double pas une validation, n'en ajoute pas quand elle précède déjà l'envoi", () => {
    const e = normaliserEtapes([
      { type: "agent", agent: "theo", texte: "a" }, { type: "validation" }, { type: "validation" }, { type: "envoi", agent: "theo", texte: "b" },
    ]);
    expect(e.map((x) => x.type)).toEqual(["agent", "validation", "envoi"]);
  });
  it("une chaîne enregistrée sans validation la retrouve à la relecture", () => {
    const e = etapesEnregistrees([{ type: "agent", agent: "sam", texte: "@sam lit" }, { type: "envoi", agent: "sam", texte: "@sam envoie" }, { type: "inconnu" }]);
    expect(e!.map((x) => x.type)).toEqual(["agent", "validation", "envoi"]);
  });

  it("décrit le modèle des impayés avec les prénoms, et verrouille la validation devant l'envoi", () => {
    const c = chaine(routine({ jours: 20 }), prenoms);
    expect(c.map((e) => e.type)).toEqual(["depart", "agent", "agent", "validation", "envoi"]);
    expect(c[0].texte).toBe("Le lundi à 8 h");
    expect(c[1].texte).toBe("Théo repère les factures en retard de plus de 20 jours");
    expect(c[1].puces).toContain("Sauf clients « à ménager »");
    expect(c[3].verrouillee).toBe(true);
    expect(c[1].reglages.map((r) => r.id)).toEqual(["jours", "menager"]);
    expect(c[2].reglages.map((r) => r.id)).toEqual(["ton"]);
  });

  it("une étape conditionnelle n'apparaît que si son réglage l'active", () => {
    expect(chaine(routine({}, "fournisseurs"), prenoms).map((e) => e.type)).toEqual(["depart", "agent", "agent"]);
    const avec = chaine(routine({ transmettre: true, comptable: "cabinet@exemple.re" }, "fournisseurs"), prenoms);
    expect(avec.map((e) => e.type)).toEqual(["depart", "agent", "agent", "validation", "envoi"]);
    expect(avec.at(-2)!.verrouillee).toBe(true);
    // Identifiants stables : les réglages restent rattachés à leur étape.
    expect(avec[2].id).toBe("e1");
  });

  it("chaque modèle respecte la règle : jamais d'envoi sans validation avant", () => {
    for (const m of MODELES) {
      const tout = reglagesDe(m, Object.fromEntries(m.reglages.map((d) => [d.id, d.type === "bascule" ? true : d.type === "texte" ? "a@b.re" : undefined])));
      const types = chaine({ ...routine(tout, m.id), modele: m.id }, prenoms).map((e) => e.type);
      const premierEnvoi = types.indexOf("envoi");
      if (premierEnvoi >= 0) expect(types.slice(0, premierEnvoi), m.id).toContain("validation");
      expect(m.reglages.every((d) => d.etape < m.etapes.length), m.id).toBe(true);
      expect(m.question.reponses.length + (m.question.saisie ? 1 : 0), m.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("une ancienne tâche planifiée se lit comme une chaîne simple", () => {
    const c = chaine({ titre: "Point comptable hebdomadaire", agent_id: "theo", heures: [8, 14], jours: [1, 2, 3, 4, 5] }, prenoms);
    expect(c.map((e) => e.texte)).toEqual(["Du lundi au vendredi à 8 h et 14 h", "Théo : point comptable hebdomadaire", "Vous validez ce qu'il prépare"]);
  });
});

describe("routines — réglages", () => {
  it("borne les compteurs, ignore les choix inconnus, garde les valeurs par défaut", () => {
    expect(reglagesDe(impayes, { jours: 500, ton: "agressif" })).toEqual({ jours: 60, menager: true, ton: "cordial" });
    expect(reglagesDe(impayes, { jours: 12 }).jours).toBe(12);
  });
  it("refuse une adresse invalide et la transmission sans adresse", () => {
    const f = modeleDe("fournisseurs")!;
    expect(erreurReglages(f, { comptable: "pas-une-adresse" })).toMatch(/invalide/);
    expect(erreurReglages(f, { transmettre: true })).toMatch(/adresse/);
    expect(erreurReglages(f, { transmettre: true, comptable: "cabinet@exemple.re" })).toBeNull();
    expect(reglagesDe(f, { comptable: "pas-une-adresse" }).comptable).toBe("");
  });
  it("« En clair » suit chaque réglage", () => {
    expect(enClair(chaine(routine({ jours: 15, ton: "ferme" }), prenoms)))
      .toBe("Le lundi à 8 h, Théo repère les factures en retard de plus de 15 jours. Théo rédige une relance par client. Vous validez. Théo envoie les relances.");
    expect(enClair(chaine(routine({ jours: 30 }), prenoms))).toContain("plus de 30 jours");
  });
  it("la consigne reprend le seuil, le ton et la règle de validation", () => {
    const c = consigneModele(impayes, reglagesDe(impayes, { jours: 30, ton: "formel", menager: false }), prenoms);
    expect(c).toContain("plus de 30 jours");
    expect(c).toContain("très formel");
    expect(c).toContain("n'envoie et ne publie rien toi-même");
    expect(c).not.toContain("à ménager");
  });
  it("une routine proposée par Léa garde sa consigne, complétée du ton", () => {
    const t = { titre: "x", agent_id: "lea", heures: [9], jours: [1], consigne: "Fais ceci.", etapes: [{ type: "agent", agent: "lea", texte: "@lea fait" }], reglages: { ton: "ferme" } };
    expect(consigneDe(t, prenoms)).toBe("Fais ceci.\n\nTon ferme et direct, toujours poli, sans menace.");
    expect(consigneDe({ ...t, etapes: null }, prenoms)).toBe("Fais ceci.");
  });
  it("la galerie ne garde que les modèles dont toute l'équipe est là", () => {
    expect(modelesPour(["theo"]).map((m) => m.id)).toEqual(["impayes", "fournisseurs", "point_comptable"]);
    expect(modelesPour([])).toEqual([]);
  });
});

describe("routines — historique", () => {
  const p = (debut: string, x: Partial<Passage>): Passage => ({ debut, statut: "ok", tentative: 1, essai: false, ...x });
  it("un échec rattrapé tient en une ligne", () => {
    const h = historique([
      p("2026-11-09T08:00:00+04:00", { statut: "erreur", compte_rendu: "La messagerie ne répondait pas." }),
      p("2026-11-09T09:00:00+04:00", { tentative: 2, nb_livrables: 1, compte_rendu: "Une facture en retard trouvée chez SARL Payet." }),
      p("2026-11-16T08:00:00+04:00", { compte_rendu: "Aucune facture en retard cette semaine." }),
    ]);
    expect(h).toHaveLength(2);
    expect(h[0]).toMatchObject({ ton: "ok", texte: "Rien à valider. Aucune facture en retard cette semaine." });
    expect(h[1].ton).toBe("incident");
    expect(h[1].texte).toBe("Échec à 8 h : La messagerie ne répondait pas. Nouvel essai à 9 h : réussi. 1 proposition déposée dans « Aujourd'hui ». Une facture en retard trouvée chez SARL Payet.");
  });
  it("un essai dit ce qui aurait été fait, sans rien envoyer", () => {
    const h = historique([p("2026-11-23T08:00:00+04:00", { essai: true, propositions: [{ titre: "a" }, { titre: "b" }] })]);
    expect(h[0]).toMatchObject({ ton: "essai", texte: "Essai : 2 propositions préparées, rien n'a été envoyé." });
  });
  it("un échec isolé annonce le nouvel essai ; un passage bloqué est signalé", () => {
    const maintenant = new Date("2026-11-23T12:00:00+04:00");
    const h = historique([
      p("2026-11-23T08:00:00+04:00", { statut: "erreur", compte_rendu: "Quota atteint." }),
      p("2026-11-23T11:00:00+04:00", { statut: "en_cours", tentative: 1 }),
    ], maintenant);
    expect(h[0]).toMatchObject({ ton: "erreur", texte: "Passage de 11 h interrompu avant la fin." });
    expect(h[1].texte).toBe("Échec à 8 h : Quota atteint. Nouvel essai prévu une heure plus tard.");
    expect(bilanPassages(h)).toBe("a tourné 2 fois, 2 erreurs");
    expect(bilanPassages([])).toBe("n'a pas encore tourné");
  });
  it("résume un compte rendu en une phrase, sans Markdown", () => {
    expect(resume("## Bilan\n**2 factures** en retard trouvées cette semaine. Détail : …")).toBe("Bilan 2 factures en retard trouvées cette semaine.");
    expect(resume("")).toBe("");
    expect(resume("x".repeat(400)).length).toBeLessThanOrEqual(160);
  });
});

describe("routines — proposition de Léa", () => {
  const equipe = [{ id: "theo", prenom: "Théo" }, { id: "lea", prenom: "Léa" }];
  it("rattache les étapes aux agents par prénom et ajoute la validation devant l'envoi", () => {
    const r = validerProposition({
      titre: "Relancer les devis", agent: "inconnu",
      etapes: [{ type: "agent", texte: "Théo cherche les devis sans réponse" }, { type: "envoi", agent: "theo", texte: "Théo envoie une relance" }, { type: "agent", agent: "zoe", texte: "Zoé fait autre chose" }],
      consigne: "Cherche les devis envoyés il y a plus de 7 jours sans réponse et prépare une relance.",
      planning: { jours: [2], heures: [3] }, question: { texte: "Après combien de jours ?", reponses: ["7", "14"] },
    }, equipe);
    if ("erreur" in r) throw new Error(r.erreur);
    expect(r.etapes).toEqual([
      { type: "agent", agent: "theo", texte: "@theo cherche les devis sans réponse" },
      { type: "validation" },
      { type: "envoi", agent: "theo", texte: "@theo envoie une relance" },
    ]);
    expect(r.agent).toBe("theo");
    expect(r.planning).toEqual({ jours: [2], heures: [8] }); // 3 h du matin : écarté
    expect(r.question.reponses).toEqual(["7", "14"]);
  });
  it("relaie l'impossibilité et refuse une proposition vide", () => {
    expect(validerProposition({ impossible: "Aucun outil ne lit votre banque." }, equipe)).toEqual({ erreur: "Aucun outil ne lit votre banque." });
    expect("erreur" in validerProposition({ titre: "x", consigne: "trop court" }, equipe)).toBe(true);
  });
});

describe("proposition de routine", () => {
  const equipe = [{ id: "hugo", prenom: "Hugo", metier: "communication" }];
  it("annonce les API et serveurs MCP reliés comme des outils", () => {
    const c = consigneProposition(equipe, [], [{ nom: "Brevo", genre: "API", description: "envoi de mailing en masse" }]);
    expect(c).toContain("Outils reliés : Brevo (API : envoi de mailing en masse).");
    expect(c).toContain("ne part qu'après sa validation");
  });
  it("sans outil relié, le dit", () => {
    expect(consigneProposition(equipe, [])).toContain("Outils reliés : aucun");
    expect(consigneProposition(equipe, ["mail"])).not.toContain("serveurs MCP ci-dessus");
  });
});
