// Écran « Aujourd'hui » : ce que l'équipe a fait cette semaine et ce qui arrive.
// Module pur (testé) : il met en phrases le journal de l'espace et les échéances
// connues (routines planifiées, publications programmées). Rien n'est inventé :
// une action absente du journal n'apparaît pas.

export type LigneFait = { agent_id: string | null; action: string };
export type Fait = { agent_id: string; texte: string; total: number };

/** Familles d'actions du journal, de la plus parlante à la moins parlante pour un dirigeant. */
const FAMILLES: { actions: string[]; un: string; plusieurs: string }[] = [
  { actions: ["action_executee"], un: "mené à bien 1 action validée par vous", plusieurs: "mené à bien {n} actions validées par vous" },
  { actions: ["livrable_soumis"], un: "préparé 1 proposition à valider", plusieurs: "préparé {n} propositions à valider" },
  { actions: ["mission"], un: "traité 1 demande", plusieurs: "traité {n} demandes" },
  { actions: ["tache_executee"], un: "assuré 1 passage de routine", plusieurs: "assuré {n} passages de routine" },
  { actions: ["mail_lecture", "gmail_lecture"], un: "lu 1 e-mail", plusieurs: "lu {n} e-mails" },
  { actions: ["fichiers_lecture", "drive_lecture"], un: "lu 1 document", plusieurs: "lu {n} documents" },
  { actions: ["media"], un: "créé 1 visuel", plusieurs: "créé {n} visuels" },
  { actions: ["note_enregistree", "competence_enregistree"], un: "enregistré 1 note", plusieurs: "enregistré {n} notes" },
  { actions: ["element_range"], un: "rangé 1 élément", plusieurs: "rangé {n} éléments" },
  { actions: ["reseaux_lecture"], un: "consulté vos réseaux sociaux", plusieurs: "consulté vos réseaux sociaux {n} fois" },
];
const FAMILLE_DE = new Map(FAMILLES.flatMap((f, i) => f.actions.map((a) => [a, i] as const)));

/**
 * Une phrase par agent (« a lu 12 e-mails et préparé 3 propositions à valider. »), les
 * agents les plus actifs d'abord. Deux faits par agent au plus : les plus parlants.
 */
export function faitsSemaine(lignes: LigneFait[], max = 5): Fait[] {
  const parAgent = new Map<string, number[]>();
  for (const l of lignes) {
    const f = FAMILLE_DE.get(l.action);
    if (f === undefined || !l.agent_id) continue;
    const c = parAgent.get(l.agent_id) ?? new Array<number>(FAMILLES.length).fill(0);
    c[f]++;
    parAgent.set(l.agent_id, c);
  }
  return [...parAgent.entries()].map(([agent_id, c]) => {
    const morceaux = c.map((n, i) => (n ? (n === 1 ? FAMILLES[i].un : FAMILLES[i].plusieurs.replace("{n}", String(n))) : ""))
      .filter(Boolean).slice(0, 2);
    return { agent_id, texte: `a ${morceaux.join(" et ")}.`, total: c.reduce((t, n) => t + n, 0) };
  }).sort((a, b) => b.total - a.total || a.agent_id.localeCompare(b.agent_id)).slice(0, max);
}

export type Echeance = {
  date: string; titre: string; agent_id: string | null;
  /** routine : passage planifié · attend : publication programmée qui attend l'accord · programmee : validée, partira à la date. */
  etat: "routine" | "attend" | "programmee";
};
type TacheVenir = { titre: string; agent_id: string | null; prochaine_execution: string | null };
type LivrableVenir = { titre: string; agent_id: string | null; statut: string; action?: unknown };

/** Date programmée d'une action (« AAAA-MM-JJ HH:MM », heure de La Réunion si aucun fuseau n'est écrit). */
export function dateProgramme(brut: unknown): Date | null {
  if (typeof brut !== "string" || !brut.trim()) return null;
  const iso = brut.trim().replace(" ", "T");
  const d = new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}${iso.length <= 16 ? ":00" : ""}+04:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Prochaines échéances connues, les plus proches d'abord. */
export function aVenir(taches: TacheVenir[], livrables: LivrableVenir[], maintenant: Date, max = 4): Echeance[] {
  const res: Echeance[] = [];
  for (const t of taches) {
    const d = t.prochaine_execution ? new Date(t.prochaine_execution) : null;
    if (d && !Number.isNaN(d.getTime()) && d > maintenant) res.push({ date: d.toISOString(), titre: t.titre, agent_id: t.agent_id, etat: "routine" });
  }
  for (const l of livrables) {
    if (l.statut !== "a_valider" && l.statut !== "publie") continue;
    const d = dateProgramme((l.action as { programme?: unknown } | null | undefined)?.programme);
    if (d && d > maintenant) res.push({ date: d.toISOString(), titre: l.titre, agent_id: l.agent_id, etat: l.statut === "publie" ? "programmee" : "attend" });
  }
  return res.sort((a, b) => a.date.localeCompare(b.date)).slice(0, max);
}
