// Routines (refonte §3.4, §3.5) : une tâche planifiée présentée comme une chaîne d'étapes
// dont chaque phrase a un agent pour sujet. Le moteur reste celui des tâches planifiées
// (taches.ts, exécution horaire, réservation) ; ce module, pur et testé, décrit la chaîne,
// verrouille l'étape « Vous validez », traduit les réglages en consigne et l'historique en phrases.
//
// Trois sortes de routines :
// - tirée d'un modèle (colonne `modele`) : étapes et consigne recalculées par ce module ;
// - proposée par Léa (colonne `etapes`) : étapes enregistrées, consigne rédigée par Léa ;
// - ancienne tâche planifiée (ni l'une ni l'autre) : chaîne déduite de l'agent et du titre.
//
// Règle (serveur, pas seulement interface) : une étape d'envoi, de publication ou de paiement
// est toujours précédée de « Vous validez » ; elle ne se supprime pas. À l'exécution, la règle
// des livrables s'applique de toute façon : rien ne part sans « VALIDÉ ».

import { libellePlanning, planningValide, type Planning } from "./taches.ts";

export type TypeEtape = "agent" | "validation" | "envoi";
export type Etape = { type: TypeEtape; agent?: string; texte?: string };
export type Reglages = Record<string, string | number | boolean>;

export type Ton = "cordial" | "ferme" | "formel";
export const TONS: Record<Ton, { libelle: string; accord: string; consigne: string }> = {
  cordial: { libelle: "Cordial", accord: "cordial", consigne: "Ton cordial et chaleureux, sans familiarité." },
  ferme: { libelle: "Ferme", accord: "ferme", consigne: "Ton ferme et direct, toujours poli, sans menace." },
  formel: { libelle: "Très formel", accord: "très formel", consigne: "Ton très formel : vouvoiement, formules de politesse complètes." },
};
const OPTIONS_TON = (Object.keys(TONS) as Ton[]).map((t) => ({ valeur: t, libelle: TONS[t].libelle }));

/** Réglage en langage courant, rattaché à une étape (indice dans les étapes du modèle). */
export type DefReglage =
  | { id: string; type: "compteur"; etape: number; libelle: string; min: number; max: number; pas: number; unite: string; defaut: number }
  | { id: string; type: "choix"; etape: number; libelle: string; options: { valeur: string; libelle: string }[]; defaut: string }
  | { id: string; type: "bascule"; etape: number; libelle: string; aide?: string; defaut: boolean }
  | { id: string; type: "texte"; etape: number; libelle: string; format?: "email"; defaut: string };

export type Question = {
  texte: string;
  reponses: { libelle: string; reglages: Reglages }[];
  /** Réponse écrite (ex. adresse de l'expert-comptable) : enregistrée dans ce réglage. */
  saisie?: { id: string; libelle: string; reglages: Reglages };
};

type EtapeModele = {
  type: TypeEtape; agent?: string;
  /** Phrase affichée ; « @theo » est remplacé par le prénom de l'agent. */
  texte: (r: Reglages) => string;
  puces?: (r: Reglages) => string[];
  /** Ce que l'agent doit faire à cette étape. */
  consigne?: (r: Reglages) => string;
  /** Étape présente seulement si ce réglage l'active. */
  si?: (r: Reglages) => boolean;
};

export type Capacite = "mail" | "agenda" | "reseaux" | "veille";
export const NOMS_CAPACITES: Record<Capacite, string> = {
  mail: "votre messagerie", agenda: "votre agenda", reseaux: "vos réseaux sociaux", veille: "une source de veille",
};

export type Modele = {
  id: string;
  /** Agent qui exécute la routine (il peut faire appel à ses collègues). */
  agent: string;
  titre: string;
  gain: string;
  requiert: Capacite[];
  planning: Planning;
  reglages: DefReglage[];
  question: Question;
  etapes: EtapeModele[];
};

const n = (r: Reglages, id: string) => Number(r[id]);
const s = (x: number) => (x > 1 ? "s" : "");
const ton = (r: Reglages) => TONS[(r.ton as Ton) in TONS ? (r.ton as Ton) : "cordial"];
const ENVOI_EMAIL = "Prépare chaque message comme e-mail à valider (mail_proposer_envoi) : il ne part qu'après « VALIDÉ ». Ne repropose pas ce qui attend déjà une validation.";

/** Modèles de la galerie « Nouvelle routine », par métier. */
export const MODELES: Modele[] = [
  {
    id: "devis", agent: "sam", titre: "Répondre vite aux demandes de devis", gain: "Aucune demande oubliée",
    requiert: ["mail"], planning: { heures: [9, 12, 15, 18], jours: [1, 2, 3, 4, 5] },
    reglages: [
      { id: "visite", type: "choix", etape: 1, libelle: "Visite sur place", defaut: "montant", options: [
        { valeur: "toujours", libelle: "Toujours la proposer" }, { valeur: "montant", libelle: "Au-delà de 1 000 €" }, { valeur: "jamais", libelle: "Jamais" },
      ] },
      { id: "ton", type: "choix", etape: 1, libelle: "Ton des réponses", options: OPTIONS_TON, defaut: "cordial" },
      { id: "relance", type: "bascule", etape: 3, libelle: "Relancer au bout de 3 jours sans nouvelles", defaut: true },
    ],
    question: {
      texte: "Sam doit-il proposer une visite sur place ?",
      reponses: [
        { libelle: "Toujours", reglages: { visite: "toujours" } },
        { libelle: "Au-delà de 1 000 €", reglages: { visite: "montant" } },
        { libelle: "Jamais", reglages: { visite: "jamais" } },
      ],
    },
    etapes: [
      {
        type: "agent", agent: "sam", texte: () => "@sam regarde dans vos e-mails les nouvelles demandes de devis",
        puces: () => ["Messagerie · lecture"],
        consigne: () => "Cherche dans la messagerie les demandes de devis ou de prix reçues depuis le dernier passage et restées sans réponse de notre part. Ignore celles déjà traitées.",
      },
      {
        type: "agent", agent: "sam", texte: () => "@sam prépare une réponse et une estimation à partir de vos tarifs",
        puces: (r) => [`Ton ${ton(r).accord}`, r.visite === "toujours" ? "Visite toujours proposée" : r.visite === "montant" ? "Visite au-delà de 1 000 €" : "Sans visite"],
        consigne: (r) => [
          "Pour chaque demande, rédige une réponse qui reprend le besoin du client et donne une estimation à partir des tarifs présents dans les ressources.",
          "N'invente aucun prix : s'il manque une information, pose au client les questions utiles (trois au plus).",
          r.visite === "toujours" ? "Propose toujours une visite sur place." : r.visite === "montant" ? "Propose une visite sur place si le chantier dépasse probablement 1 000 €." : "Ne propose pas de visite sur place.",
          ton(r).consigne,
        ].join(" "),
      },
      { type: "validation", texte: () => "Vous validez chaque réponse avant l'envoi" },
      {
        type: "envoi", agent: "sam", texte: (r) => r.relance ? "@sam envoie la réponse, puis relance au bout de 3 jours sans nouvelles" : "@sam envoie la réponse",
        consigne: (r) => ENVOI_EMAIL + (r.relance ? " Si une réponse envoyée il y a au moins 3 jours est restée sans retour du client, prépare une relance courte (elle attend aussi la validation)." : ""),
      },
    ],
  },
  {
    id: "impayes", agent: "theo", titre: "Relancer les factures impayées", gain: "Trésorerie suivie chaque lundi",
    requiert: ["mail"], planning: { heures: [8], jours: [1] },
    reglages: [
      { id: "jours", type: "compteur", etape: 0, libelle: "Retard minimum", min: 5, max: 60, pas: 5, unite: "jours", defaut: 15 },
      { id: "menager", type: "bascule", etape: 0, libelle: "Épargner les clients « à ménager »", aide: "Notez leurs noms dans « Mes documents », sous ce titre.", defaut: true },
      { id: "ton", type: "choix", etape: 1, libelle: "Ton des relances", options: OPTIONS_TON, defaut: "cordial" },
    ],
    question: {
      texte: "À partir de combien de jours de retard relancer ?",
      reponses: [
        { libelle: "10 jours", reglages: { jours: 10 } },
        { libelle: "15 jours", reglages: { jours: 15 } },
        { libelle: "30 jours", reglages: { jours: 30 } },
      ],
    },
    etapes: [
      {
        type: "agent", agent: "theo", texte: (r) => `@theo repère les factures en retard de plus de ${n(r, "jours")} jours`,
        puces: (r) => ["Vos e-mails et vos documents", ...(r.menager ? ["Sauf clients « à ménager »"] : [])],
        consigne: (r) => [
          `Repère les factures clients échues depuis plus de ${n(r, "jours")} jours qui ne semblent pas réglées : cherche-les dans la messagerie (factures envoyées, avis de paiement, échanges) et dans les documents de l'espace.`,
          "N'invente aucune facture ni aucun montant ; en cas de doute sur un paiement, signale-le dans le compte rendu au lieu de relancer.",
          r.menager ? "Ne relance pas les clients notés « à ménager » dans les ressources : cite-les seulement dans le compte rendu." : "",
        ].filter(Boolean).join(" "),
      },
      {
        type: "agent", agent: "theo", texte: () => "@theo rédige une relance par client", puces: (r) => [`Ton ${ton(r).accord}`],
        consigne: (r) => `Rédige une relance par client : numéro, date et montant de chaque facture concernée, et précise que le message est à ignorer si le paiement est déjà parti. ${ton(r).consigne}`,
      },
      { type: "validation", texte: () => "Vous validez avant que quoi que ce soit parte" },
      { type: "envoi", agent: "theo", texte: () => "@theo envoie les relances", consigne: () => `${ENVOI_EMAIL} Une relance par client et par semaine au plus.` },
    ],
  },
  {
    id: "posts", agent: "hugo", titre: "Publier chaque semaine sur vos réseaux", gain: "Une page qui vit sans vous",
    requiert: ["reseaux"], planning: { heures: [9], jours: [4] },
    reglages: [
      { id: "nombre", type: "compteur", etape: 0, libelle: "Publications par semaine", min: 1, max: 4, pas: 1, unite: "publications", defaut: 2 },
      { id: "photos", type: "choix", etape: 0, libelle: "Vos photos de chantier", defaut: "rarement", options: [
        { valeur: "oui", libelle: "Je les dépose dans « Mes documents »" }, { valeur: "rarement", libelle: "Rarement" }, { valeur: "non", libelle: "Jamais" },
      ] },
      { id: "ton", type: "choix", etape: 1, libelle: "Ton des publications", options: OPTIONS_TON, defaut: "cordial" },
    ],
    question: {
      texte: "Pouvez-vous envoyer à Hugo des photos de chantier ?",
      reponses: [
        { libelle: "Oui, dans « Mes documents »", reglages: { photos: "oui" } },
        { libelle: "Rarement", reglages: { photos: "rarement" } },
        { libelle: "Non", reglages: { photos: "non" } },
      ],
    },
    etapes: [
      {
        type: "agent", agent: "hugo", texte: (r) => `@hugo choisit ${n(r, "nombre")} sujet${s(n(r, "nombre"))} pour la semaine`,
        puces: () => ["Réalisations, offres, conseils"],
        consigne: (r) => [
          `Choisis ${n(r, "nombre")} sujet${s(n(r, "nombre"))} de publication pour la semaine à venir (réalisations, offres, conseils pratiques, coulisses), sans reprendre ce qui a été publié récemment.`,
          r.photos === "oui" ? "Utilise en priorité les photos de chantier déposées dans les ressources." : r.photos === "rarement" ? "Les photos sont rares : privilégie des sujets qui n'en ont pas besoin." : "Sans photo du dirigeant : choisis des sujets sans visuel, ou décris le visuel à prévoir.",
        ].join(" "),
      },
      {
        type: "agent", agent: "hugo", texte: (r) => n(r, "nombre") > 1 ? "@hugo rédige les publications" : "@hugo rédige la publication",
        puces: (r) => [`Ton ${ton(r).accord}`], consigne: (r) => `Rédige chaque publication en l'adaptant au réseau. ${ton(r).consigne}`,
      },
      { type: "validation", texte: (r) => n(r, "nombre") > 1 ? "Vous validez les publications" : "Vous validez la publication" },
      {
        type: "envoi", agent: "hugo", texte: (r) => n(r, "nombre") > 1 ? "@hugo les programme au fil de la semaine" : "@hugo la programme mardi",
        consigne: () => "Propose chaque publication avec reseaux_proposer_publication, programmée à 18 h (heure de La Réunion) : la première mardi prochain, la deuxième vendredi, les suivantes les autres jours ouvrés. Elle n'est programmée qu'après « VALIDÉ ».",
      },
    ],
  },
  {
    id: "fournisseurs", agent: "theo", titre: "Classer les factures fournisseurs", gain: "Comptable servi sans relance",
    requiert: ["mail"], planning: { heures: [18], jours: [1, 2, 3, 4, 5] },
    reglages: [
      { id: "transmettre", type: "bascule", etape: 1, libelle: "Transmettre chaque mois à votre expert-comptable", defaut: false },
      { id: "comptable", type: "texte", etape: 1, libelle: "Adresse de votre expert-comptable", format: "email", defaut: "" },
    ],
    question: {
      texte: "Quelle est l'adresse e-mail de votre expert-comptable ?",
      saisie: { id: "comptable", libelle: "Adresse e-mail", reglages: { transmettre: true } },
      reponses: [{ libelle: "Je ne transmets rien pour l'instant", reglages: { transmettre: false } }],
    },
    etapes: [
      {
        type: "agent", agent: "theo", texte: () => "@theo repère les factures fournisseurs reçues par e-mail", puces: () => ["Messagerie · lecture"],
        consigne: () => "Cherche dans la messagerie les factures et avis d'échéance de fournisseurs reçus depuis le dernier passage.",
      },
      {
        type: "agent", agent: "theo", texte: () => "@theo les note dans « Comptabilité / Factures fournisseurs »",
        puces: (r) => r.transmettre && r.comptable ? [`Récapitulatif mensuel à ${r.comptable}`] : ["Rien n'est transmis"],
        consigne: () => "Pour chacune, enregistre une note (note_enregistrer) dans le dossier « Comptabilité/Factures fournisseurs » : fournisseur, numéro, date, montant TTC, échéance et référence de l'e-mail. Ne crée pas de doublon.",
      },
      { type: "validation", si: (r) => Boolean(r.transmettre && r.comptable), texte: () => "Vous validez le récapitulatif avant l'envoi" },
      {
        type: "envoi", agent: "theo", si: (r) => Boolean(r.transmettre && r.comptable),
        texte: () => "Le premier jour ouvré du mois, @theo envoie le récapitulatif à votre expert-comptable",
        consigne: (r) => `Lors du premier passage de chaque mois seulement, prépare un e-mail à ${r.comptable} avec le récapitulatif des factures fournisseurs du mois écoulé (mail_proposer_envoi, il ne part qu'après « VALIDÉ »). Les autres jours, ne prépare aucun envoi.`,
      },
    ],
  },
  {
    id: "rappels", agent: "lea", titre: "Rappeler les rendez-vous la veille", gain: "Moins de rendez-vous manqués",
    requiert: ["agenda", "mail"], planning: { heures: [17], jours: [1, 2, 3, 4, 5, 6, 7] },
    reglages: [
      { id: "ton", type: "choix", etape: 1, libelle: "Ton des rappels", options: OPTIONS_TON, defaut: "cordial" },
      { id: "decaler", type: "bascule", etape: 1, libelle: "Proposer au client de décaler si besoin", defaut: true },
    ],
    question: {
      texte: "Le rappel peut-il proposer au client de décaler son rendez-vous ?",
      reponses: [{ libelle: "Oui", reglages: { decaler: true } }, { libelle: "Non", reglages: { decaler: false } }],
    },
    etapes: [
      {
        type: "agent", agent: "lea", texte: () => "@lea lit l'agenda du lendemain", puces: () => ["Agenda · lecture"],
        consigne: () => "Liste avec agenda_lister les rendez-vous de demain avec des clients ou des prospects ; ignore les rendez-vous internes et ceux sans adresse e-mail.",
      },
      {
        type: "agent", agent: "lea", texte: () => "@lea prépare un rappel pour chaque client",
        puces: (r) => [`Ton ${ton(r).accord}`, r.decaler ? "Possibilité de décaler" : "Sans proposition de décaler"],
        consigne: (r) => `Pour chaque rendez-vous, rédige un rappel court : date, heure, lieu et ce qu'il faut prévoir. ${r.decaler ? "Indique que le client peut répondre à ce message pour décaler. " : ""}${ton(r).consigne}`,
      },
      { type: "validation", texte: () => "Vous validez les rappels, d'un clic" },
      { type: "envoi", agent: "lea", texte: () => "@lea envoie les rappels", consigne: () => ENVOI_EMAIL },
    ],
  },
  {
    id: "messages", agent: "hugo", titre: "Répondre aux messages privés", gain: "Personne n'attend une réponse",
    requiert: ["reseaux"], planning: { heures: [9, 14, 18], jours: [1, 2, 3, 4, 5, 6, 7] },
    reglages: [{ id: "ton", type: "choix", etape: 1, libelle: "Ton des réponses", options: OPTIONS_TON, defaut: "cordial" }],
    question: {
      texte: "Sur quel ton répondre à vos clients ?",
      reponses: (Object.keys(TONS) as Ton[]).map((t) => ({ libelle: TONS[t].libelle, reglages: { ton: t } })),
    },
    etapes: [
      {
        type: "agent", agent: "hugo", texte: () => "@hugo lit les messages privés restés sans réponse", puces: () => ["Vos réseaux · lecture"],
        consigne: () => "Vérifie les messages privés des réseaux sociaux ; garde les conversations qui attendent une réponse de notre part. Ignore les spams, les messages automatiques et ceux qui n'appellent pas de réponse.",
      },
      {
        type: "agent", agent: "hugo", texte: () => "@hugo prépare une réponse à chacun", puces: (r) => [`Ton ${ton(r).accord}`],
        consigne: (r) => `Lis chaque conversation et prépare une réponse adaptée, au nom de l'entreprise. ${ton(r).consigne}`,
      },
      { type: "validation", texte: () => "Vous validez chaque réponse" },
      { type: "envoi", agent: "hugo", texte: () => "@hugo envoie les réponses", consigne: () => "Propose chaque réponse avec reseaux_proposer_message : elle ne part qu'après « VALIDÉ »." },
    ],
  },
  {
    id: "commentaires", agent: "hugo", titre: "Répondre aux commentaires", gain: "Des pages qui répondent",
    requiert: ["reseaux"], planning: { heures: [10, 17], jours: [1, 2, 3, 4, 5, 6, 7] },
    reglages: [
      { id: "compliments", type: "bascule", etape: 0, libelle: "Répondre aussi aux simples compliments", defaut: false },
      { id: "ton", type: "choix", etape: 1, libelle: "Ton des réponses", options: OPTIONS_TON, defaut: "cordial" },
    ],
    question: {
      texte: "Faut-il répondre aussi aux simples compliments ?",
      reponses: [{ libelle: "Oui, un merci à chacun", reglages: { compliments: true } }, { libelle: "Non, les questions seulement", reglages: { compliments: false } }],
    },
    etapes: [
      {
        type: "agent", agent: "hugo", texte: () => "@hugo repère les commentaires restés sans réponse",
        puces: (r) => [r.compliments ? "Questions et compliments" : "Questions et remarques"],
        consigne: (r) => `Regarde les commentaires des publications récentes. Garde ceux qui posent une question ou font une remarque restée sans réponse de notre part${r.compliments ? ", ainsi que les compliments" : ""}. Ignore les spams${r.compliments ? "" : " et les simples réactions"}.`,
      },
      {
        type: "agent", agent: "hugo", texte: () => "@hugo prépare une réponse publique courte", puces: (r) => [`Ton ${ton(r).accord}`],
        consigne: (r) => `Prépare pour chacun une réponse publique courte. ${ton(r).consigne}`,
      },
      { type: "validation", texte: () => "Vous validez chaque réponse" },
      { type: "envoi", agent: "hugo", texte: () => "@hugo publie les réponses", consigne: () => "Propose chaque réponse avec reseaux_proposer_reponse_commentaire : elle n'est publiée qu'après « VALIDÉ »." },
    ],
  },
  {
    id: "article", agent: "ines", titre: "Écrire l'article des nouvelles du jour", gain: "Un site qui vit chaque matin",
    requiert: ["veille"], planning: { heures: [7], jours: [1, 2, 3, 4, 5] },
    reglages: [{ id: "nombre", type: "compteur", etape: 1, libelle: "Nouvelles par article", min: 2, max: 5, pas: 1, unite: "nouvelles", defaut: 3 }],
    question: {
      texte: "Combien de nouvelles par article ?",
      reponses: [{ libelle: "3", reglages: { nombre: 3 } }, { libelle: "5", reglages: { nombre: 5 } }],
    },
    etapes: [
      {
        type: "agent", agent: "ines", texte: () => "@ines parcourt votre veille des dernières 24 heures", puces: () => ["Vos sources de veille"],
        consigne: (r) => `Parcours la veille des dernières 24 heures et choisis les ${n(r, "nombre")} actualités les plus utiles pour nos clients (impact concret pour une petite entreprise, nouveauté, fiabilité de la source), puis lis-les.`,
      },
      {
        type: "agent", agent: "ines", texte: (r) => `@ines rédige l'article « Les ${n(r, "nombre")} nouvelles du jour »`,
        consigne: (r) => `Rédige l'article « Les ${n(r, "nombre")} nouvelles du jour » : un titre accrocheur, un chapô, une partie par nouvelle (ce qui s'est passé, pourquoi c'est important, ce qu'il faut en retenir) et une conclusion. Cite les sources. Enregistre-le avec blog_proposer_article.`,
      },
      { type: "validation", texte: () => "Vous relisez l'article avant sa mise en ligne" },
    ],
  },
  {
    id: "newsletter", agent: "ines", titre: "Envoyer la newsletter de la semaine", gain: "Vos clients se souviennent de vous",
    requiert: ["mail", "veille"], planning: { heures: [8], jours: [5] },
    reglages: [{ id: "nombre", type: "compteur", etape: 1, libelle: "Sujets par newsletter", min: 3, max: 6, pas: 1, unite: "sujets", defaut: 4 }],
    question: {
      texte: "Combien de sujets par newsletter ?",
      reponses: [{ libelle: "3", reglages: { nombre: 3 } }, { libelle: "4", reglages: { nombre: 4 } }, { libelle: "5", reglages: { nombre: 5 } }],
    },
    etapes: [
      {
        type: "agent", agent: "ines", texte: () => "@ines rassemble la veille de la semaine et vos articles validés",
        consigne: () => "Rassemble la veille des 7 derniers jours et les articles validés cette semaine.",
      },
      {
        type: "agent", agent: "ines", texte: (r) => `@ines rédige la newsletter en ${n(r, "nombre")} sujets`,
        consigne: (r) => `Rédige la newsletter : ${n(r, "nombre")} sujets résumés chacun en 2 phrases avec leur lien, une introduction personnalisée ({{prenom}}) et un appel à l'action final.`,
      },
      { type: "validation", texte: () => "Vous validez la newsletter" },
      { type: "envoi", agent: "ines", texte: () => "@ines l'envoie à vos abonnés", consigne: () => "Propose-la avec mailing_proposer, à tous les abonnés : elle ne part qu'après « VALIDÉ »." },
    ],
  },
  {
    id: "bilan", agent: "hugo", titre: "Faire le bilan de la semaine sur vos réseaux", gain: "Vous savez ce qui marche",
    requiert: ["reseaux"], planning: { heures: [8], jours: [1] },
    reglages: [{ id: "idees", type: "compteur", etape: 1, libelle: "Idées de publications", min: 1, max: 5, pas: 1, unite: "idées", defaut: 3 }],
    question: {
      texte: "Combien d'idées de publications Hugo doit-il vous proposer ?",
      reponses: [{ libelle: "3", reglages: { idees: 3 } }, { libelle: "5", reglages: { idees: 5 } }],
    },
    etapes: [
      {
        type: "agent", agent: "hugo", texte: () => "@hugo fait le bilan de la semaine sur vos réseaux", puces: () => ["Abonnés, publications, messages"],
        consigne: () => "Fais le bilan de la semaine sur les réseaux sociaux : abonnés, publications qui ont le mieux marché, commentaires et messages reçus.",
      },
      {
        type: "agent", agent: "hugo", texte: (r) => `@hugo propose ${n(r, "idees")} idée${s(n(r, "idees"))} pour la semaine prochaine`,
        consigne: (r) => `Termine par ${n(r, "idees")} idée${s(n(r, "idees"))} de publication${s(n(r, "idees"))} pour la semaine prochaine. Le bilan reste dans le compte rendu : ne prépare aucune publication.`,
      },
    ],
  },
  {
    id: "point_comptable", agent: "theo", titre: "Faire le point comptable de la semaine", gain: "Rien d'oublié avant l'échéance",
    requiert: ["mail"], planning: { heures: [8], jours: [1] },
    reglages: [{ id: "relances", type: "bascule", etape: 1, libelle: "Préparer les relances des factures en retard", defaut: true }],
    question: {
      texte: "Théo doit-il préparer les relances des factures en retard ?",
      reponses: [{ libelle: "Oui", reglages: { relances: true } }, { libelle: "Non, le point seulement", reglages: { relances: false } }],
    },
    etapes: [
      {
        type: "agent", agent: "theo", texte: () => "@theo fait le point comptable de la semaine écoulée",
        puces: () => ["Notes de frais, factures, échéances"],
        consigne: () => "Fais le point comptable de la semaine écoulée : notes de frais du mois, factures reçues et envoyées, relances et avis d'échéance trouvés dans la messagerie, rendez-vous de l'agenda. N'invente aucun montant : écris « à compléter » quand une donnée manque. Parties : dépenses et justificatifs manquants ; factures émises, encaissements et retards ; factures fournisseurs à payer ; échéances des 30 prochains jours (TVA, URSSAF, impôts, loyers, emprunts) ; trésorerie ; 3 actions prioritaires et ce qu'il faut transmettre à l'expert-comptable.",
      },
      {
        type: "agent", agent: "theo", texte: () => "@theo l'enregistre dans « Comptabilité / Points hebdomadaires »",
        consigne: () => "Enregistre-le avec note_enregistrer, titre « Point comptable — semaine du JJ/MM/AAAA » (lundi de la semaine écoulée), dossier « Comptabilité/Points hebdomadaires ».",
      },
      { type: "validation", si: (r) => Boolean(r.relances), texte: () => "Vous validez les relances" },
      { type: "envoi", agent: "theo", si: (r) => Boolean(r.relances), texte: () => "@theo envoie les relances des factures en retard", consigne: () => ENVOI_EMAIL },
    ],
  },
];

export const modeleDe = (id: unknown): Modele | null => MODELES.find((m) => m.id === id) ?? null;

/** Agents qu'un modèle fait travailler (pilote compris). */
export const agentsDuModele = (m: Modele) => [...new Set([m.agent, ...m.etapes.map((e) => e.agent).filter((a): a is string => Boolean(a))])];

/** Modèles utilisables par une équipe : tous leurs agents doivent en faire partie. */
export const modelesPour = (agents: string[]) => MODELES.filter((m) => agentsDuModele(m).every((a) => agents.includes(a)));

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

/** Réglages d'un modèle : valeurs par défaut, complétées par les valeurs reçues si elles sont valides. */
export function reglagesDe(m: Modele, brut: unknown): Reglages {
  const b = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const r: Reglages = {};
  for (const d of m.reglages) {
    const v = b[d.id];
    if (d.type === "compteur") {
      const x = Number(v);
      r[d.id] = Number.isFinite(x) ? Math.min(d.max, Math.max(d.min, Math.round(x))) : d.defaut;
    } else if (d.type === "choix") {
      r[d.id] = d.options.some((o) => o.valeur === v) ? String(v) : d.defaut;
    } else if (d.type === "bascule") {
      r[d.id] = typeof v === "boolean" ? v : d.defaut;
    } else {
      const t = typeof v === "string" ? v.trim().slice(0, 200) : d.defaut;
      r[d.id] = d.format === "email" && t && !EMAIL.test(t) ? d.defaut : t;
    }
  }
  return r;
}

/** Erreur lisible si un réglage reçu est invalide (adresse e-mail mal formée), sinon null. */
export function erreurReglages(m: Modele, brut: Record<string, unknown>): string | null {
  for (const d of m.reglages) {
    if (d.type === "texte" && d.format === "email" && typeof brut[d.id] === "string") {
      const t = String(brut[d.id]).trim();
      if (t && !EMAIL.test(t)) return `Adresse e-mail invalide : ${t.slice(0, 80)}`;
    }
  }
  if (m.reglages.some((d) => d.id === "transmettre") && brut.transmettre === true && !String(brut.comptable ?? "").trim()) {
    return "Indiquez d'abord l'adresse de votre expert-comptable.";
  }
  return null;
}

/**
 * Chaîne valide : une étape de validation devant le premier envoi (ajoutée si elle manque),
 * jamais deux validations de suite, ni de validation finale orpheline après le dernier envoi.
 */
export function normaliserEtapes(etapes: Etape[]): Etape[] {
  const out: Etape[] = [];
  let valide = false;
  for (const e of etapes) {
    if (e.type === "validation") {
      if (out.at(-1)?.type === "validation") continue;
      out.push({ type: "validation", ...(e.texte ? { texte: e.texte } : {}) });
      valide = true;
      continue;
    }
    if (e.type === "envoi" && !valide) {
      out.push({ type: "validation" });
      valide = true;
    }
    out.push(e);
  }
  return out;
}

/** Étape telle qu'affichée (écran Routine). */
export type EtapeVue = {
  id: string;
  type: "depart" | TypeEtape;
  agent: string | null;
  texte: string;
  puces: string[];
  /** « Vous validez » devant un envoi : obligatoire, non supprimable. */
  verrouillee: boolean;
  reglages: DefReglage[];
};

const remplacerPrenoms = (texte: string, prenoms: Map<string, string>) =>
  texte.replace(/@([a-z_]+)/g, (_m, id: string) => prenoms.get(id) ?? id.charAt(0).toUpperCase() + id.slice(1));

const TEXTE_VALIDATION = "Vous validez avant que quoi que ce soit parte";

/** Données d'une routine nécessaires à sa description. */
export type RoutineBrute = {
  titre: string; agent_id: string; heures: number[]; jours: number[];
  modele?: string | null; etapes?: unknown; reglages?: unknown;
};

/** Étapes enregistrées (routine proposée par Léa), relues prudemment. */
export function etapesEnregistrees(brut: unknown): Etape[] | null {
  if (!Array.isArray(brut) || !brut.length) return null;
  const etapes = brut.flatMap((x): Etape[] => {
    const e = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const type = e.type === "agent" || e.type === "envoi" || e.type === "validation" ? e.type : null;
    if (!type) return [];
    const texte = typeof e.texte === "string" ? e.texte.trim().slice(0, 200) : "";
    if (type !== "validation" && (!texte || typeof e.agent !== "string")) return [];
    return [{ type, ...(typeof e.agent === "string" ? { agent: e.agent } : {}), ...(texte ? { texte } : {}) }];
  });
  return etapes.length ? normaliserEtapes(etapes) : null;
}

/** Chaîne affichée : départ, puis étapes (modèle, enregistrées, ou déduites d'une ancienne tâche). */
export function chaine(t: RoutineBrute, prenoms: Map<string, string>): EtapeVue[] {
  const depart: EtapeVue = {
    id: "depart", type: "depart", agent: null, verrouillee: false, reglages: [],
    texte: libellePlanning({ heures: t.heures, jours: t.jours }), puces: ["Heure de La Réunion"],
  };
  const m = modeleDe(t.modele);
  if (m) {
    const r = reglagesDe(m, t.reglages);
    const visibles = m.etapes.map((e, i) => ({ e, i })).filter(({ e }) => !e.si || e.si(r));
    const envoiApres = (k: number) => visibles.slice(k + 1).some(({ e }) => e.type === "envoi");
    return [depart, ...visibles.map(({ e, i }, k): EtapeVue => ({
      id: `e${i}`, type: e.type, agent: e.agent ?? null,
      texte: remplacerPrenoms(e.texte(r), prenoms), puces: (e.puces?.(r) ?? []).map((p) => remplacerPrenoms(p, prenoms)),
      verrouillee: e.type === "validation" && envoiApres(k),
      reglages: m.reglages.filter((d) => d.etape === i),
    }))];
  }
  const enregistrees = etapesEnregistrees(t.etapes);
  const ton = (t.reglages && typeof t.reglages === "object" ? (t.reglages as Record<string, unknown>).ton : undefined) as string | undefined;
  if (enregistrees) {
    const premiere = enregistrees.findIndex((e) => e.type === "agent");
    return [depart, ...enregistrees.map((e, i): EtapeVue => ({
      id: `e${i}`, type: e.type, agent: e.agent ?? null,
      texte: e.type === "validation" ? (e.texte ?? TEXTE_VALIDATION) : remplacerPrenoms(e.texte ?? "", prenoms),
      puces: i === premiere && ton && ton in TONS ? [`Ton ${TONS[ton as Ton].accord}`] : [],
      verrouillee: e.type === "validation" && enregistrees.slice(i + 1).some((x) => x.type === "envoi"),
      reglages: i === premiere ? [{ id: "ton", type: "choix", etape: i, libelle: "Ton des messages", options: OPTIONS_TON, defaut: "cordial" }] : [],
    }))];
  }
  // Ancienne tâche planifiée : l'agent fait le travail, ses propositions attendent la validation.
  const prenom = prenoms.get(t.agent_id) ?? t.agent_id;
  return [
    depart,
    { id: "e0", type: "agent", agent: t.agent_id, texte: `${prenom} : ${t.titre.charAt(0).toLowerCase()}${t.titre.slice(1)}`, puces: ["Consigne d'origine"], verrouillee: false, reglages: [] },
    { id: "e1", type: "validation", agent: null, texte: "Vous validez ce qu'il prépare", puces: [], verrouillee: false, reglages: [] },
  ];
}

/** Minuscule après la virgule, sauf pour un prénom (« Théo repère… » garde sa capitale). */
const minuscule = (t: string) => (/^(Vous|Le|La|Les|L'|Un|Une|Chaque|Du|Des)\b/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);

/** Encadré « En clair » : la routine en une phrase (ou deux), recalculée à chaque réglage. */
export function enClair(etapes: EtapeVue[]): string {
  const [depart, ...reste] = etapes;
  if (!reste.length) return depart?.texte ?? "";
  const phrases = reste.map((e) => (e.type === "validation" ? "Vous validez" : e.texte));
  const premiere = `${depart.texte}, ${minuscule(phrases[0])}`;
  return [premiere, ...phrases.slice(1)].map((p) => p.replace(/[.\s]+$/, "")).join(". ") + ".";
}

/** Consigne d'une routine tirée d'un modèle, rejouée à chaque passage. */
export function consigneModele(m: Modele, r: Reglages, prenoms: Map<string, string>): string {
  const visibles = m.etapes.filter((e) => !e.si || e.si(r));
  const lignes = visibles.map((e, i) => {
    const qui = e.type === "validation" ? "Le dirigeant valide" : remplacerPrenoms(e.texte(r), prenoms);
    const detail = e.type === "validation"
      ? "Tout ce qui part (e-mail, publication, message) est proposé à sa validation : n'envoie et ne publie rien toi-même."
      : e.consigne?.(r) ?? "";
    return `${i + 1}. ${qui}.${detail ? `\n   ${detail}` : ""}`;
  });
  const autres = [...new Set(visibles.map((e) => e.agent).filter((a): a is string => Boolean(a) && a !== m.agent))];
  return [
    `Routine « ${m.titre} ». Déroulé :`,
    ...lignes,
    autres.length ? `\nLes étapes de ${autres.map((a) => prenoms.get(a) ?? a).join(", ")} : confie-les-leur (confier_mission) si tu le peux, sinon fais-les toi-même.` : "",
  ].filter(Boolean).join("\n");
}

/** Consigne d'une routine proposée par Léa : sa consigne, plus le ton choisi. */
export function consigneEnregistree(consigne: string, reglages: unknown): string {
  const t = (reglages && typeof reglages === "object" ? (reglages as Record<string, unknown>).ton : undefined) as string | undefined;
  return t && t in TONS ? `${consigne}\n\n${TONS[t as Ton].consigne}` : consigne;
}

/** Consigne à jouer lors d'un passage, quelle que soit la sorte de routine. */
export function consigneDe(t: RoutineBrute & { consigne: string }, prenoms: Map<string, string>): string {
  const m = modeleDe(t.modele);
  if (m) return consigneModele(m, reglagesDe(m, t.reglages), prenoms);
  return etapesEnregistrees(t.etapes) ? consigneEnregistree(t.consigne, t.reglages) : t.consigne;
}

/** Avertissement ajouté à la consigne d'un passage en mode essai. */
export const AVIS_ESSAI = "MODE ESSAI : ce passage montre au dirigeant ce que la routine aurait fait. Fais le travail normalement : tes propositions sont notées pour lui, mais rien n'est soumis, enregistré ni envoyé. Termine par la liste de ce que tu aurais proposé.";

// ─────────────────────────────────────────────────────────────────────────────
// Historique : « Ce qui s'est passé »
// ─────────────────────────────────────────────────────────────────────────────

export type Passage = {
  debut: string; fin?: string | null; statut: "en_cours" | "ok" | "erreur"; tentative: number;
  essai: boolean; manuel?: boolean; compte_rendu?: string | null; propositions?: unknown; nb_livrables?: number;
};
export type LigneHistorique = { date: string; ton: "ok" | "incident" | "erreur" | "essai" | "en_cours"; texte: string };

const heure = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { timeZone: "Indian/Reunion", hour: "numeric", minute: "2-digit" })
  .replace(":", " h ").replace(/ h 00$/, " h");

/** Première phrase utile d'un compte rendu, sans Markdown, 160 caractères au plus. */
export function resume(texte: string | null | undefined): string {
  const t = String(texte ?? "").replace(/```[\s\S]*?```/g, " ").replace(/[#*_`>|]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .split("\n").map((l) => l.replace(/^\s*(?:[-•]|\d+[.)])\s+/, "").trim()).filter((l) => l.length > 3).join(" ").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const phrase = /^(.{20,}?[.!?])(\s|$)/.exec(t)?.[1] ?? t;
  return phrase.length > 160 ? `${phrase.slice(0, 157).replace(/\s+\S*$/, "")}…` : phrase;
}

const nbPropositions = (p: Passage) => (Array.isArray(p.propositions) ? p.propositions.length : 0);
const plusieurs = (k: number, un: string, pl: string) => `${k} ${k > 1 ? pl : un}`;

function phraseReussite(p: Passage): string {
  const r = resume(p.compte_rendu);
  if (p.essai) {
    const k = nbPropositions(p);
    return [k ? `Essai : ${plusieurs(k, "proposition préparée", "propositions préparées")}, rien n'a été envoyé.` : "Essai : rien à proposer ce jour-là.", r].filter(Boolean).join(" ");
  }
  const k = p.nb_livrables ?? 0;
  return [k ? `${plusieurs(k, "proposition déposée", "propositions déposées")} dans « Aujourd'hui ».` : "Rien à valider.", r].filter(Boolean).join(" ");
}

/** Historique en phrases, du plus récent au plus ancien ; un échec rattrapé tient en une ligne. */
export function historique(passages: Passage[], maintenant = new Date()): LigneHistorique[] {
  const ordre = [...passages].sort((a, b) => Date.parse(a.debut) - Date.parse(b.debut));
  const lignes: LigneHistorique[] = [];
  for (let i = 0; i < ordre.length; i++) {
    const p = ordre[i];
    const suivant = ordre[i + 1];
    if (p.statut === "en_cours") {
      // Un passage resté « en cours » plus de 15 minutes a été interrompu.
      const perdu = maintenant.getTime() - Date.parse(p.debut) > 15 * 60_000;
      lignes.push(perdu
        ? { date: p.debut, ton: "erreur", texte: `Passage de ${heure(p.debut)} interrompu avant la fin.` }
        : { date: p.debut, ton: "en_cours", texte: p.essai ? "Essai en cours…" : "En cours…" });
      continue;
    }
    if (p.statut === "erreur" && suivant && suivant.tentative > p.tentative && suivant.statut !== "en_cours") {
      const raison = resume(p.compte_rendu) || "incident technique";
      const issue = suivant.statut === "ok" ? `réussi. ${phraseReussite(suivant)}` : `nouvel échec (${resume(suivant.compte_rendu) || "incident technique"}).`;
      lignes.push({ date: p.debut, ton: suivant.statut === "ok" ? "incident" : "erreur", texte: `Échec à ${heure(p.debut)} : ${raison.replace(/[.!?…]$/, "")}. Nouvel essai à ${heure(suivant.debut)} : ${issue}` });
      i++;
      continue;
    }
    if (p.statut === "erreur") {
      lignes.push({ date: p.debut, ton: "erreur", texte: `Échec à ${heure(p.debut)} : ${(resume(p.compte_rendu) || "incident technique").replace(/[.!?…]$/, "")}.${p.tentative === 1 && !p.essai && !p.manuel ? " Nouvel essai prévu une heure plus tard." : ""}` });
      continue;
    }
    lignes.push({ date: p.debut, ton: p.essai ? "essai" : "ok", texte: phraseReussite(p) });
  }
  return lignes.reverse();
}

/** « a tourné 3 fois, sans erreur bloquante » (en-tête de l'écran Routine). */
export function bilanPassages(lignes: LigneHistorique[]): string {
  const vrais = lignes.filter((l) => l.ton !== "en_cours");
  if (!vrais.length) return "n'a pas encore tourné";
  const erreurs = vrais.filter((l) => l.ton === "erreur").length;
  return `a tourné ${vrais.length} fois, ${erreurs ? plusieurs(erreurs, "erreur", "erreurs") : "sans erreur bloquante"}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Proposition de Léa (« Quelle tâche ne voulez-vous plus faire vous-même ? »)
// ─────────────────────────────────────────────────────────────────────────────

export type Proposition = {
  titre: string; agent: string; etapes: Etape[]; consigne: string; planning: Planning;
  question: { texte: string; reponses: string[] };
};

/** Consigne donnée au modèle pour proposer une routine (pas un prompt d'agent). */
/** Service relié par le client (API ou serveur MCP « connecté ») : les agents s'en servent pendant la routine. */
export type ServiceRelie = { nom: string; genre: "API" | "serveur MCP"; description?: string };

export function consigneProposition(agents: { id: string; prenom: string; metier: string }[], capacites: Capacite[], services: ServiceRelie[] = []): string {
  const outils = [
    ...capacites.map((c) => NOMS_CAPACITES[c]),
    ...services.map((s) => `${s.nom} (${s.genre}${s.description ? ` : ${s.description.replace(/\s+/g, " ").slice(0, 150)}` : ""})`),
  ];
  return [
    "Tu es Léa, coordinatrice d'une équipe d'agents IA au service d'un dirigeant de petite entreprise à La Réunion.",
    "Le dirigeant décrit une tâche qu'il ne veut plus faire lui-même. Propose une routine : une chaîne de 2 à 6 étapes, chacune une phrase courte dont le sujet est un agent de l'équipe (« Théo repère… »), exécutée à des jours et heures fixes.",
    "",
    "Équipe disponible (n'utilise que ces identifiants) :",
    ...agents.map((a) => `- ${a.id} : ${a.prenom}, ${a.metier}`),
    "",
    `Outils reliés : ${outils.length ? outils.join(", ") : "aucun (les agents peuvent seulement rédiger, chercher sur le web et ranger des notes)"}.`,
    ...(services.length ? ["Les API et serveurs MCP ci-dessus sont utilisables par tous les agents : ils y lisent directement ; ce qui y crée, modifie ou envoie est proposé au dirigeant et ne part qu'après sa validation. Nomme le service dans l'étape concernée (« Hugo envoie la newsletter par Brevo »)."] : []),
    "Les agents ne peuvent ni payer, ni envoyer de SMS, ni lire un compte bancaire. N'invente aucun outil.",
    "",
    "Règles :",
    "- Toute étape qui envoie, publie ou paie est de type « envoi » et vient après une étape « validation » (le dirigeant valide).",
    "- Le dirigeant n'écrit jamais de consigne et ne choisit pas l'agent : c'est toi qui le fais.",
    "- Pose UNE seule question utile au dirigeant, avec 2 ou 3 réponses courtes.",
    "- Si la tâche est impossible avec ces outils, dis-le dans « impossible », en une phrase.",
    "- La consigne détaille, pour l'agent qui exécute, ce qu'il faut faire à chaque étape (outils à utiliser, ce qu'il ne faut pas inventer).",
    "",
    "Réponds uniquement par un objet JSON :",
    `{"titre": "…", "agent": "identifiant de l'agent qui exécute", "etapes": [{"type": "agent", "agent": "…", "texte": "…"}, {"type": "validation"}, {"type": "envoi", "agent": "…", "texte": "…"}], "consigne": "…", "planning": {"jours": [1], "heures": [8]}, "question": {"texte": "…", "reponses": ["…", "…"]}, "impossible": null}`,
    "jours : 1 = lundi … 7 = dimanche ; heures : 6 à 22 (heure de La Réunion).",
  ].join("\n");
}

const PRENOM_EN_TETE = /^\s*(@?[a-zà-ÿ]+)\b/i;

/** Proposition relue et corrigée par le serveur : agents de l'équipe, validation devant tout envoi. */
export function validerProposition(brut: unknown, agents: { id: string; prenom: string }[]): Proposition | { erreur: string } {
  const b = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  if (typeof b.impossible === "string" && b.impossible.trim()) return { erreur: b.impossible.trim().slice(0, 300) };
  const ids = new Set(agents.map((a) => a.id));
  const parPrenom = new Map(agents.map((a) => [a.prenom.toLowerCase(), a.id]));
  const titre = String(b.titre ?? "").trim().slice(0, 120);
  const consigne = String(b.consigne ?? "").trim().slice(0, 3500);
  if (!titre || consigne.length < 20) return { erreur: "Léa n'a pas pu proposer de routine pour cette tâche. Reformulez-la en une phrase." };
  const etapes = (Array.isArray(b.etapes) ? b.etapes : []).slice(0, 8).flatMap((x): Etape[] => {
    const e = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    if (e.type === "validation") return [{ type: "validation" }];
    if (e.type !== "agent" && e.type !== "envoi") return [];
    let texte = String(e.texte ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
    // L'agent : identifiant donné, sinon le prénom qui ouvre la phrase.
    const tete = PRENOM_EN_TETE.exec(texte)?.[1]?.replace("@", "").toLowerCase();
    const agent = ids.has(String(e.agent)) ? String(e.agent) : tete ? parPrenom.get(tete) ?? (ids.has(tete) ? tete : null) : null;
    if (!texte || !agent) return [];
    const prenom = agents.find((a) => a.id === agent)!.prenom;
    // Le sujet de la phrase est l'agent : « @theo » dans le texte enregistré.
    texte = texte.replace(new RegExp(`^@?(${prenom}|${agent})\\b`, "i"), "").trim();
    return [{ type: e.type, agent, texte: `@${agent} ${texte.replace(/^[,:]\s*/, "")}` }];
  });
  if (!etapes.some((e) => e.type !== "validation")) return { erreur: "Léa n'a pas pu découper cette tâche en étapes. Reformulez-la en une phrase." };
  const normalisees = normaliserEtapes(etapes).slice(0, 8);
  const pilote = ids.has(String(b.agent)) ? String(b.agent) : normalisees.find((e) => e.agent)!.agent!;
  const p = planningValide((b.planning ?? {}) as { heures?: unknown; jours?: unknown });
  const planning = "erreur" in p ? { heures: [8], jours: [1, 2, 3, 4, 5] } : { heures: p.heures.filter((h) => h >= 6 && h <= 22), jours: p.jours };
  if (!planning.heures.length) planning.heures = [8];
  const q = (b.question && typeof b.question === "object" ? b.question : {}) as Record<string, unknown>;
  const reponses = (Array.isArray(q.reponses) ? q.reponses : []).map((x) => String(x ?? "").trim().slice(0, 80)).filter(Boolean).slice(0, 3);
  const texteQ = String(q.texte ?? "").trim().slice(0, 200);
  return {
    titre, agent: pilote, etapes: normalisees, consigne, planning,
    question: texteQ && reponses.length >= 2 ? { texte: texteQ, reponses } : { texte: "Voulez-vous être prévenu même quand il n'y a rien à faire ?", reponses: ["Oui", "Non"] },
  };
}
