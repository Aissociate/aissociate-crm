import { describe, expect, it } from "vitest";
import {
  AGENT_QUALIOPI, ajouterJours, avancement, choisirParticipants, controleProduction, DEFINITION_PRODUIRE, ESPACE_AISSOCIATE, estDocument, espacesOrganisme, finSession, jourReunion,
  periodeDe, qualiopiActif, resoudreSession, statutApresProduction,
  apercuActionQualiopi, avecLien, controleRappel, corpsHtml, estNatureEnvoi, etatQuestionnaire, lienEnvoi, MARQUEUR_LIEN, messageEnvoi,
  modifierActionQualiopi, nomPieceJointe, pieceChecklist, titreActionQualiopi, typeDocEnvoi, type ActionQualiopi, type NatureEnvoi,
} from "./qualiopi.ts";
import { apercuAction, modifierAction, titreAction } from "./outils.ts";

const AUTRE = "5d1e0000-0000-4000-8000-000000000001";
const sessions = [
  { id: "aaaaaaaa-1111-4000-8000-000000000001", titre: "IA générative Le Port" },
  { id: "aaaaaaaa-2222-4000-8000-000000000002", titre: "IA générative Saint-Pierre" },
  { id: "bbbbbbbb-3333-4000-8000-000000000003", titre: "Excel collectif Sud" },
];
const participants = [
  { id: "cccccccc-0000-4000-8000-000000000001", nom: "Martin", prenom: "Jean" },
  { id: "dddddddd-0000-4000-8000-000000000002", nom: "Payet", prenom: "Léa" },
];

describe("garde : Nora, espace Aissociate seulement", () => {
  it("n'ouvre les outils qu'à Nora dans l'espace de l'organisme", () => {
    expect(qualiopiActif(ESPACE_AISSOCIATE, AGENT_QUALIOPI)).toBe(true);
    expect(qualiopiActif(ESPACE_AISSOCIATE.toUpperCase(), "nora")).toBe(true);
    expect(qualiopiActif(ESPACE_AISSOCIATE, "hugo")).toBe(false);
    expect(qualiopiActif(ESPACE_AISSOCIATE, "lea")).toBe(false);
    expect(qualiopiActif(AUTRE, "nora")).toBe(false);
    expect(qualiopiActif(null, "nora")).toBe(false);
  });
  it("la liste des espaces se règle sans accepter n'importe quoi", () => {
    expect(espacesOrganisme(undefined)).toEqual([ESPACE_AISSOCIATE]);
    expect(espacesOrganisme("pas-un-id, ;drop")).toEqual([ESPACE_AISSOCIATE]);
    expect(espacesOrganisme(`${AUTRE}, ${ESPACE_AISSOCIATE}`)).toEqual([AUTRE, ESPACE_AISSOCIATE]);
    expect(qualiopiActif(AUTRE, "nora", espacesOrganisme(AUTRE))).toBe(true);
  });
});

describe("dates à La Réunion", () => {
  it("décale de 4 heures", () => {
    expect(jourReunion("2026-11-20T21:00:00Z")).toBe("2026-11-21");
    expect(jourReunion("2026-11-20T05:00:00Z")).toBe("2026-11-20");
    expect(ajouterJours("2026-11-20", 30)).toBe("2026-12-20");
    expect(finSession({ date_debut: "2026-11-20T05:00:00Z", date_fin: null })).toBe("2026-11-20");
  });
  it("situe une session", () => {
    const s = { date_debut: "2026-11-20T05:00:00Z", date_fin: "2026-11-21T13:00:00Z" };
    expect(periodeDe(s, "2026-11-19")).toBe("a_venir");
    expect(periodeDe(s, "2026-11-21")).toBe("en_cours");
    expect(periodeDe(s, "2026-11-22")).toBe("terminees");
  });
});

describe("désigner une session ou des stagiaires", () => {
  it("par identifiant, début d'identifiant ou titre", () => {
    expect(resoudreSession(sessions, "aaaaaaaa-2222-4000-8000-000000000002")).toBe(sessions[1]);
    expect(resoudreSession(sessions, "bbbbbbbb")).toBe(sessions[2]);
    expect(resoudreSession(sessions, "excel sud")).toBe(sessions[2]);
    expect("erreur" in resoudreSession(sessions, "aaaaaaaa")).toBe(true); // deux sessions commencent ainsi
    const ambigu = resoudreSession(sessions, "IA générative");
    expect("erreur" in ambigu && ambigu.erreur).toContain("Plusieurs sessions");
    expect("erreur" in resoudreSession(sessions, "")).toBe(true);
    expect("erreur" in resoudreSession(sessions, "Comptabilité")).toBe(true);
  });
  it("tous, ou une liste d'identifiants et de noms", () => {
    expect(choisirParticipants(participants, "tous").choisis).toHaveLength(2);
    expect(choisirParticipants(participants, "").choisis).toHaveLength(2);
    expect(choisirParticipants(participants, "cccccccc").choisis).toEqual([participants[0]]);
    expect(choisirParticipants(participants, ["Léa PAYET"]).choisis).toEqual([participants[1]]);
    const r = choisirParticipants(participants, "Martin, Inconnu, martin");
    expect(r.choisis).toEqual([participants[0]]);
    expect(r.inconnus).toEqual(["Inconnu"]);
  });
});

describe("avancement de la checklist", () => {
  it("compte les pièces faites et liste les manquantes", () => {
    const av = avancement([
      { type_doc: "convention", statut: "genere" }, { type_doc: "convocation", statut: "a_generer" },
      { type_doc: "convocation", statut: "a_generer" }, { type_doc: "emargement", statut: "signe" }, { type_doc: "livret_suivi", statut: "non_applicable" },
    ]);
    expect(av).toEqual({ faites: 2, total: 4, manquantes: ["Convocation"] });
  });
});

describe("production", () => {
  const s = { date_debut: "2026-11-20T05:00:00Z", date_fin: "2026-11-21T13:00:00Z" };
  it("attestation et certificat attendent la fin de la session", () => {
    expect(controleProduction("attestation_fin", s, "2026-11-20")).toContain("pas terminée");
    expect(controleProduction("attestation_fin", s, "2026-11-21")).toBeNull(); // le dernier jour, remise en fin de formation
    expect(controleProduction("certificat_realisation", s, "2026-11-20")).toContain("21/11/2026");
    expect(controleProduction("attestation_fin", s, "2026-11-22")).toBeNull();
    expect(controleProduction("convocation", s, "2026-11-01")).toBeNull();
  });
  it("ne fait jamais reculer une pièce déjà envoyée ou signée", () => {
    expect(statutApresProduction("a_generer")).toBe("genere");
    expect(statutApresProduction("envoye")).toBe("envoye");
    expect(statutApresProduction("signe")).toBe("signe");
  });
  it("l'outil de production propose tous les documents demandés", () => {
    const docs = (DEFINITION_PRODUIRE.function.parameters as { properties: { document: { enum: string[] } } }).properties.document.enum;
    for (const d of ["devis", "programme", "convention", "convocation", "livret_accueil", "emargement", "attestation_fin", "certificat_realisation"]) expect(docs).toContain(d);
    expect(estDocument("convocation")).toBe(true);
    expect(estDocument("bulletin")).toBe(false);
  });
});

describe("envois aux stagiaires", () => {
  const infos = { stagiaire: "Jean MARTIN", intitule: "IA générative", dates: "Jeudi 1er et vendredi 2 octobre 2026", lieu: "Salle A, Saint-Denis", orgNom: "Aissociate" };
  const action = (n: Partial<ActionQualiopi> = {}): ActionQualiopi => ({
    type: "qualiopi_envoyer", nature: "questionnaire_chaud", session_id: "s1", session_titre: "Session test", participant_id: "p1", contact_id: "c1",
    nom: "Jean MARTIN", a: "jean@exemple.re", objet: "Évaluation de fin de formation", corps: `Bonjour,\n\nDonner mon avis : ${MARQUEUR_LIEN}`, pieces: [], doc_id: null, lien: "chaud", ...n,
  });

  it("propose tous les envois demandés", () => {
    for (const n of ["convocation", "livret_accueil", "programme", "convention", "devis", "emargement", "rappel", "questionnaire_chaud", "questionnaire_froid", "attestation_fin", "certificat_realisation"]) {
      expect(estNatureEnvoi(n)).toBe(true);
      const m = messageEnvoi(n as NatureEnvoi, infos);
      expect(m.objet.length).toBeGreaterThan(5);
      expect(m.corps).toContain("Bonjour Jean MARTIN,");
    }
    expect(estNatureEnvoi("facture")).toBe(false);
  });
  it("met le lien personnel dans l'émargement et les questionnaires, pas ailleurs", () => {
    expect(messageEnvoi("emargement", infos).corps).toContain(MARQUEUR_LIEN);
    expect(messageEnvoi("questionnaire_chaud", infos).corps).toContain(MARQUEUR_LIEN);
    expect(messageEnvoi("questionnaire_froid", { ...infos, relance: true }).objet).toContain("Rappel");
    expect(messageEnvoi("convocation", infos).corps).not.toContain(MARQUEUR_LIEN);
    expect(messageEnvoi("convocation", infos).corps).toContain("jeudi 1er et vendredi 2 octobre 2026");
    expect(messageEnvoi("rappel", { ...infos, avecPiece: true }).corps).toContain("convocation est jointe");
    expect(messageEnvoi("convention", { ...infos, message: "Merci de signer page 3." }).corps).toContain("Merci de signer page 3.");
    expect(lienEnvoi("emargement")).toBe("emargement");
    expect(lienEnvoi("convocation")).toBeNull();
    expect(typeDocEnvoi("programme")).toBe("deroule_pedagogique");
    expect(typeDocEnvoi("rappel")).toBe("convocation");
  });
  it("questionnaires : à chaud dès le dernier jour, à froid à J+30, relance si envoyé sans réponse", () => {
    expect(etatQuestionnaire("chaud", null, false, "2026-11-20", "2026-11-19")).toMatchObject({ ok: false });
    expect(etatQuestionnaire("chaud", null, false, "2026-11-20", "2026-11-20")).toEqual({ ok: true, relance: false });
    expect(etatQuestionnaire("chaud", { statut: "envoye" }, false, "2026-11-20", "2026-11-25")).toEqual({ ok: true, relance: true });
    expect(etatQuestionnaire("chaud", { statut: "envoye" }, true, "2026-11-20", "2026-11-25")).toEqual({ ok: false, raison: "a déjà répondu" });
    expect(etatQuestionnaire("froid", { statut: "a_envoyer" }, false, "2026-11-20", "2026-12-10")).toMatchObject({ ok: false });
    expect(etatQuestionnaire("froid", null, false, "2026-11-20", "2026-12-20")).toEqual({ ok: true, relance: false });
    expect(etatQuestionnaire("froid", { statut: "relance" }, false, "2026-11-20", "2027-01-10")).toEqual({ ok: true, relance: true });
    expect(etatQuestionnaire("froid", { statut: "complete" }, false, "2026-11-20", "2027-01-10")).toMatchObject({ ok: false });
  });
  it("le rappel part avant la formation, au plus tard le premier jour", () => {
    expect(controleRappel({ date_debut: "2026-11-25T05:00:00Z" }, "2026-11-22")).toBeNull();
    expect(controleRappel({ date_debut: "2026-11-25T05:00:00Z" }, "2026-11-25")).toBeNull();
    expect(controleRappel({ date_debut: "2026-11-25T05:00:00Z" }, "2026-11-26")).toContain("déjà commencé");
  });
  it("joint la pièce du stagiaire, sinon celle de la session, jamais une pièce non produite", () => {
    const lignes = [
      { id: "l1", session_id: "s1", participant_id: "p1", type_doc: "convocation", libelle: "", statut: "a_generer", fichier_url: null, bucket: "qualiopi" },
      { id: "l2", session_id: "s1", participant_id: "p2", type_doc: "convocation", libelle: "", statut: "genere", fichier_url: "s1/c2.pdf", bucket: "qualiopi" },
      { id: "l3", session_id: "s1", participant_id: null, type_doc: "convention", libelle: "", statut: "genere", fichier_url: "agefice.pdf", bucket: "plans" },
    ];
    expect(pieceChecklist(lignes, "convocation", "p1")).toBeNull();
    expect(pieceChecklist(lignes, "convocation", "p2")?.id).toBe("l2");
    expect(pieceChecklist(lignes, "convention", "p1")?.id).toBe("l3");
    expect(nomPieceJointe("Convocation", "Jean MARTIN")).toBe("Convocation - Jean MARTIN.pdf");
    expect(nomPieceJointe("Devis D/2026:01", "Jean")).toBe("Devis D 2026 01 - Jean.pdf");
  });
  it("aperçu, titre et modification d'une proposition", () => {
    const a = action({ pieces: [{ bucket: "qualiopi", chemin: "x.pdf", nom: "Convocation - Jean MARTIN.pdf" }] });
    expect(titreActionQualiopi(a)).toBe("Questionnaire à chaud — Jean MARTIN");
    expect(titreActionQualiopi(action({ relance: true }))).toBe("Questionnaire à chaud (relance) — Jean MARTIN");
    const apercu = apercuActionQualiopi(a);
    expect(apercu).toContain("jean@exemple.re");
    expect(apercu).toContain("Convocation - Jean MARTIN.pdf");
    expect(apercu).not.toContain(MARQUEUR_LIEN);
    expect(modifierActionQualiopi(a, { objet: "Votre avis", corps: "Bonjour" })).toMatchObject({ erreur: expect.stringContaining(MARQUEUR_LIEN) });
    expect(modifierActionQualiopi(a, { objet: "Votre avis", corps: `Bonjour ${MARQUEUR_LIEN}` })).toMatchObject({ objet: "Votre avis" });
    expect(modifierActionQualiopi(action({ lien: null }), { objet: "", corps: "x" })).toMatchObject({ erreur: expect.any(String) });
  });
  it("remplace le lien et met l'e-mail en HTML sans injection", () => {
    const url = "https://aissociate.re/evaluation/abc123";
    expect(avecLien(`Avis : ${MARQUEUR_LIEN}`, url)).toBe(`Avis : ${url}`);
    expect(avecLien("Texte modifié sans marqueur", url)).toContain(`Lien : ${url}`);
    expect(avecLien("Sans lien", null)).toBe("Sans lien");
    const html = corpsHtml(`Bonjour <b>Jean</b>,\n\nDonner mon avis : ${url}`, url);
    expect(html).toContain("&lt;b&gt;Jean&lt;/b&gt;");
    expect(html).toContain(`href="${url}"`);
  });
  it("le livrable passe par les fonctions communes d'outils.ts", () => {
    const a = action();
    expect(titreAction(a)).toBe(titreActionQualiopi(a));
    expect(apercuAction(a)).toBe(apercuActionQualiopi(a));
    expect(modifierAction(a, { objet: "x", corps: `y ${MARQUEUR_LIEN}` })).toMatchObject({ type: "qualiopi_envoyer", objet: "x" });
  });
});
