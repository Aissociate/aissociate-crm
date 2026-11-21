import { describe, expect, it } from "vitest";
import {
  AGENT_QUALIOPI, ajouterJours, avancement, choisirParticipants, ESPACE_AISSOCIATE, espacesOrganisme, finSession, jourReunion,
  periodeDe, qualiopiActif, resoudreSession,
} from "./qualiopi.ts";

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
