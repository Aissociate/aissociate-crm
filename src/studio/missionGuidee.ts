// Mission guidée : un pouvoir spécial s'ouvre sur une question à choix en un clic et
// une précision, pas sur un formulaire ni une conversation vide.
// Le guide est déduit des champs existants du pouvoir (aucune consigne d'agent n'est
// réécrite) : le premier champ à choix devient la question, le premier champ de texte
// devient la précision, le reste s'affiche en dessous. Un pouvoir ajouté depuis le CRM
// est donc guidé sans rien faire. Les formulations ci-dessous habillent les pouvoirs
// livrés avec le Studio ; le catalogue peut les remplacer (`recoit` sur le pouvoir,
// `question` sur le champ). Module pur (testé).
import type { Champ, SuperPouvoir } from './api';

export type Guide = {
  /** Champ à choix présenté en un clic (null si le pouvoir n'en a pas). */
  choix: Champ | null;
  question: string;
  /** Champ de texte présenté comme « précision » (écrite ou dictée). */
  precision: Champ | null;
  /** Champs restants, affichés sous la précision. */
  autres: Champ[];
};

/** Formulations des pouvoirs livrés avec le Studio : ce qu'on reçoit, et la question du champ à choix. */
const CONNUS: Record<string, { recoit: string; question?: string }> = {
  email: { recoit: 'un e-mail prêt à envoyer, au bon ton', question: 'Sur quel ton ?' },
  synthese: { recoit: "l'essentiel en cinq points, et ce qu'il faut faire", question: 'Pour quoi faire ?' },
  semaine: { recoit: 'un planning réaliste, jour par jour' },
  post: { recoit: 'un post prêt à publier', question: 'Sur quel réseau ?' },
  calendrier: { recoit: 'un mois de publications planifiées', question: 'À quel rythme ?' },
  visuel: { recoit: 'une consigne claire pour votre graphiste', question: 'Dans quel format ?' },
  visuel_ia: { recoit: 'une image prête à publier', question: 'Dans quel format ?' },
  video_ia: { recoit: 'une courte vidéo pour vos réseaux', question: 'Dans quel format ?' },
  sequence: { recoit: 'trois messages de prospection, prêts à envoyer', question: 'Par quel canal ?' },
  script: { recoit: "ce qu'il faut dire, objection par objection", question: 'Dans quel contexte appelez-vous ?' },
  objection: { recoit: 'trois façons de répondre à cette objection' },
  article: { recoit: 'un article prêt à mettre en ligne', question: 'De quelle longueur ?' },
  mots_cles: { recoit: 'les recherches que font vos clients, classées' },
  audit_page: { recoit: 'les corrections à apporter à votre page, dans l\'ordre' },
  cgv: { recoit: 'un modèle de conditions générales à faire relire', question: 'Qui sont vos clients ?' },
  relance_impaye: { recoit: 'un courrier de relance prêt à envoyer', question: 'À quel stade en êtes-vous ?' },
  rgpd: { recoit: 'la liste de ce que vous devez faire en premier' },
  annonce: { recoit: 'une annonce prête à diffuser', question: 'Pour quel contrat ?' },
  entretien: { recoit: 'les questions à poser et comment noter les réponses' },
  financement: { recoit: 'les aides possibles pour cette formation', question: 'Qui faut-il former ?' },
  facture: { recoit: 'un document conforme, calculs vérifiés', question: 'Quel document ?' },
  tresorerie: { recoit: 'votre solde mois par mois, et les mois à risque', question: 'Sur quelle durée ?' },
  marge: { recoit: 'ce que vous gagnez vraiment sur cette offre' },
  pieces: { recoit: 'vos dépenses classées et les justificatifs manquants' },
  note_frais: { recoit: 'la dépense calculée, classée et ajoutée à la note du mois', question: 'Quelle catégorie de dépense ?' },
  point_hebdo: { recoit: 'votre semaine comptable en une page', question: 'Quelle semaine ?' },
};

/** « Vous recevez : un e-mail prêt à envoyer. » : le résultat, pas l'action. */
export function recoit(p: SuperPouvoir): string {
  const brut = (p.recoit ?? CONNUS[p.id]?.recoit ?? p.description ?? '').trim().replace(/[.\s]+$/, '');
  if (!brut) return '';
  return `Vous recevez : ${brut.charAt(0).toLocaleLowerCase('fr-FR')}${brut.slice(1)}.`;
}

/** « Ton » → « Ton ? » ; une question déjà formulée est laissée telle quelle. */
const enQuestion = (libelle: string) => (/\?\s*$/.test(libelle) ? libelle.trim() : `${libelle.trim()} ?`);

export function guider(p: SuperPouvoir): Guide {
  const choix = p.champs.find((c) => c.type === 'choix' && (c.options?.length ?? 0) > 1) ?? null;
  const textes = p.champs.filter((c) => c !== choix && c.type !== 'choix');
  // La précision est le texte que le dirigeant doit donner de toute façon ; à défaut, le premier texte facultatif.
  const precision = textes.find((c) => c.requis) ?? textes[0] ?? null;
  return {
    choix, precision,
    question: choix ? choix.question?.trim() || CONNUS[p.id]?.question || enQuestion(choix.label) : '',
    autres: p.champs.filter((c) => c !== choix && c !== precision),
  };
}

/** Valeurs de départ : rien n'est présélectionné, le dirigeant choisit en un clic. */
export function valeursInitiales(p: SuperPouvoir): Record<string, string> {
  return Object.fromEntries(p.champs.map((c) => [c.nom, '']));
}

/** Premier champ obligatoire encore vide (null : la mission peut partir). Même règle que le serveur. */
export function champManquant(p: SuperPouvoir, valeurs: Record<string, string>): Champ | null {
  return p.champs.find((c) => {
    const v = (valeurs[c.nom] ?? '').trim();
    return c.requis && (!v || (c.type === 'choix' && Boolean(c.options?.length) && !c.options!.includes(v)));
  }) ?? null;
}

/** Ce que chaque agent fait seul, et ce pour quoi il demande toujours l'accord (agents livrés avec le Studio). */
const AUTONOMIE: Record<string, { seul: string; demande: string }> = {
  lea: { seul: "Répartit vos demandes dans l'équipe, rédige, résume et organise.", demande: 'Tout e-mail, rendez-vous ou document qui part de vos comptes.' },
  hugo: { seul: 'Prépare vos publications, vos visuels et votre calendrier.', demande: 'Toute publication, toute réponse à un commentaire ou à un message.' },
  sam: { seul: "Prépare messages de prospection, scripts d'appel et relances.", demande: 'Tout message envoyé à un prospect ou à un client.' },
  ines: { seul: 'Rédige vos articles et repère ce que cherchent vos clients.', demande: 'Toute mise en ligne sur votre site.' },
  mael: { seul: 'Rédige courriers, modèles de conditions générales et listes de conformité.', demande: 'Tout courrier envoyé en votre nom.' },
  nora: { seul: "Rédige annonces, grilles d'entretien et pistes de financement.", demande: 'Toute annonce diffusée, tout message à un candidat ou à un salarié.' },
  theo: { seul: 'Prépare factures, devis, relances, notes de frais et points de trésorerie.', demande: 'Tout document envoyé à un client ou à votre expert-comptable.' },
};
/** Règle commune à tous les agents, pour ceux que le Studio ne connaît pas d'avance. */
const AUTONOMIE_DEFAUT = { seul: 'Lit, cherche et prépare ce que vous lui demandez.', demande: 'Tout envoi, toute publication, tout dépôt dans vos outils.' };

export function autonomie(agentId: string): { seul: string; demande: string } {
  return AUTONOMIE[agentId] ?? AUTONOMIE_DEFAUT;
}

export type EtatAgent = { decisions: number; au_travail: boolean };

/** État utile d'un agent sur sa carte : des décisions à prendre d'abord, sinon s'il travaille ; rien d'autre. */
export function etatAgent(e: EtatAgent | undefined): { texte: string; ton: 'attente' | 'travail' } | null {
  if (e && e.decisions > 0) return { texte: e.decisions === 1 ? '1 décision vous attend' : `${e.decisions} décisions vous attendent`, ton: 'attente' };
  if (e?.au_travail) return { texte: 'Au travail', ton: 'travail' };
  return null;
}
