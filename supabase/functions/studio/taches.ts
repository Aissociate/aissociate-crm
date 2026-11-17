// Tâches planifiées des agents : une consigne confiée à un agent, rejouée
// automatiquement aux jours et heures choisis (heure de La Réunion, UTC+4 sans
// heure d'été). Le déclencheur est un job pg_cron horaire (migration
// studio_taches) ; chaque tâche s'exécute dans sa propre instance, par le même
// chemin que le chat (garde, quotas, outils, coût, journal). Rien n'est envoyé
// à un tiers sans validation : les propositions arrivent dans les Livrables.

/** Décalage de La Réunion (heures). */
const DECALAGE = 4;
const HEURE_MS = 3_600_000;

export type Planning = { heures: number[]; jours: number[] };

/** Jours ISO (1 = lundi … 7 = dimanche) et heures (0–23) valides, triés, sans doublon. */
export function planningValide(brut: { heures?: unknown; jours?: unknown }): Planning | { erreur: string } {
  const ent = (v: unknown, min: number, max: number) =>
    [...new Set((Array.isArray(v) ? v : []).map(Number).filter((n) => Number.isInteger(n) && n >= min && n <= max))].sort((a, b) => a - b);
  const heures = ent(brut.heures, 0, 23), jours = ent(brut.jours, 1, 7);
  if (!jours.length) return { erreur: "Choisissez au moins un jour." };
  if (!heures.length) return { erreur: "Choisissez au moins une heure." };
  if (heures.length > 12) return { erreur: "12 passages par jour au maximum." };
  return { heures, jours };
}

/** Prochain passage strictement après `apres` (à l'heure pile, heure de La Réunion). */
export function prochaineExecution(p: Planning, apres: Date): Date | null {
  if (!p.heures.length || !p.jours.length) return null;
  // Heure pile suivante, en temps « local Réunion » exprimé en UTC.
  let local = Math.floor((apres.getTime() + DECALAGE * HEURE_MS) / HEURE_MS) * HEURE_MS + HEURE_MS;
  for (let i = 0; i < 24 * 8; i++, local += HEURE_MS) {
    const d = new Date(local);
    const jour = ((d.getUTCDay() + 6) % 7) + 1;
    if (p.jours.includes(jour) && p.heures.includes(d.getUTCHours())) return new Date(local - DECALAGE * HEURE_MS);
  }
  return null;
}

/** Comparaison à temps constant (clé du déclencheur). */
export async function egaliteSure(a: string, b: string): Promise<boolean> {
  const h = async (t: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

const NOMS_JOURS =["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** « Du lundi au vendredi à 9 h et 14 h ». */
export function libellePlanning(p: Planning): string {
  const j = p.jours;
  const jours = j.length === 7 ? "Tous les jours"
    : j.join() === "1,2,3,4,5" ? "Du lundi au vendredi"
    : j.length === 1 ? `Le ${NOMS_JOURS[j[0] - 1]}`
    : `Les ${j.map((x) => NOMS_JOURS[x - 1]).join(", ").replace(/, ([^,]+)$/, " et $1")}`;
  const heures = p.heures.map((h) => `${h} h`).join(", ").replace(/, ([^,]+)$/, " et $1");
  return `${jours} à ${heures}`;
}

/** Consigne envoyée à l'agent à chaque passage. */
export function consigneTache(titre: string, consigne: string, maintenant: Date): string {
  const quand = maintenant.toLocaleString("fr-FR", { timeZone: "Indian/Reunion", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  return [
    `Tâche planifiée « ${titre} » — passage automatique du ${quand}.`,
    "Personne ne lit ta réponse en direct : fais le travail avec tes outils, prépare les propositions nécessaires (elles attendront la validation du propriétaire), puis termine par un compte rendu de quelques lignes. S'il n'y a rien à faire, dis-le en une phrase. Ne repropose pas ce qui est déjà en attente de validation.",
    "",
    consigne,
  ].join("\n");
}

/** Modèles proposés à la création d'une tâche. */
export const MODELES_TACHES = [
  {
    id: "messages_sans_reponse",
    titre: "Messages privés sans réponse",
    consigne: "Vérifie les messages privés de mes réseaux sociaux. Pour chaque conversation qui attend une réponse de notre part, lis-la et prépare une réponse adaptée (ton chaleureux et professionnel, au nom de l'entreprise). Ignore les spams, les messages automatiques et ceux qui ne demandent pas de réponse.",
    heures: [9, 14, 18], jours: [1, 2, 3, 4, 5, 6, 7],
  },
  {
    id: "commentaires",
    titre: "Commentaires à traiter",
    consigne: "Regarde les commentaires de mes publications récentes sur les réseaux sociaux. Pour chaque question ou remarque restée sans réponse de notre part, prépare une réponse publique courte. Ignore les spams et les simples réactions.",
    heures: [10, 17], jours: [1, 2, 3, 4, 5, 6, 7],
  },
  {
    id: "article_du_jour",
    titre: "Article : les 3 news du jour",
    consigne: "Parcours la veille des dernières 24 heures. Choisis les 3 actualités les plus utiles pour nos clients (critères : impact concret pour une petite entreprise, nouveauté, fiabilité de la source). Lis les 3 articles, puis rédige un article de blog « Les 3 news du jour » : un titre accrocheur, un chapô, une partie par news (ce qui s'est passé, pourquoi c'est important, ce qu'il faut en retenir) et une conclusion. Cite les sources. Enregistre-le comme article à valider.",
    heures: [7], jours: [1, 2, 3, 4, 5],
  },
  {
    id: "newsletter_hebdo",
    titre: "Newsletter hebdomadaire",
    consigne: "Prépare la newsletter de la semaine à partir de la veille des 7 derniers jours et des articles validés cette semaine : 4 à 5 sujets, chacun résumé en 2 phrases avec son lien, une introduction personnalisée ({{prenom}}) et un appel à l'action final. Propose-la comme mailing à tous les abonnés.",
    heures: [8], jours: [5],
  },
  {
    id: "bilan_hebdo",
    titre: "Bilan hebdomadaire des réseaux",
    consigne: "Fais le bilan de la semaine sur mes réseaux sociaux : abonnés, publications qui ont le mieux marché, commentaires et messages reçus. Termine par 3 idées de publications pour la semaine prochaine.",
    heures: [8], jours: [1],
  },
] as const;
