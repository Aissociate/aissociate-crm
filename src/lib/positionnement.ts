/**
 * Test de positionnement « L'IA dans votre métier » — contenu, barème et synthèse.
 *
 * Ce module est la SEULE source du questionnaire : il alimente à la fois la
 * page publique tokenisée (`/positionnement/:token`) et la saisie depuis le CRM
 * quand le formateur reconstitue le positionnement d'un apprenant absent. Toute
 * évolution du contenu ou du barème se fait ici, jamais en double.
 *
 * Les réponses brutes sont stockées telles quelles en base : si le barème
 * évolue, un positionnement ancien reste recalculable.
 */

export const SEMAINES_TRAVAILLEES = 44;

export type OptionQcm = readonly [cle: string, libelle: string];

export type ChampType = 'text' | 'email' | 'select' | 'textarea';
export type Champ = {
  id: string; label: string; type: ChampType;
  options?: string[]; req?: boolean; full?: boolean; ph?: string;
};

export type Question =
  | { id: string; type: 'radio'; q: string; options: readonly OptionQcm[]; hint?: string;
      domain?: DomaineCle; pts?: number; correct?: string }
  | { id: string; type: 'check'; q: string; options: readonly OptionQcm[]; hint?: string;
      domain?: DomaineCle; ptsEach?: number; correct?: string[]; wrong?: string[] }
  | { id: string; type: 'scale'; q: string; low: string; high: string };

export type Section = {
  n: number; id: string; titre: string; intro: string;
  champs?: Champ[]; questions?: Question[]; custom?: 'objectifs' | 'irritants';
};

export type DomaineCle = 'comprendre' | 'formuler' | 'cadre' | 'avance';

export const DOMAINES: Record<DomaineCle, string> = {
  comprendre: "Compréhension de l'IA générative",
  formuler: 'Formulation des demandes',
  cadre: 'Cadre, données et responsabilité',
  avance: 'Pratiques avancées',
};

export const SECTIONS: Section[] = [
  {
    n: 1, id: 'identite', titre: 'Qui êtes-vous',
    intro: 'Ces informations permettent de rattacher votre positionnement à votre dossier de formation.',
    champs: [
      { id: 'nom', label: 'Nom et prénom', type: 'text', req: true },
      { id: 'email', label: 'Adresse email', type: 'email', req: true },
      { id: 'orga', label: 'Entreprise ou organisation', type: 'text' },
      { id: 'poste', label: 'Fonction / intitulé de poste', type: 'text', req: true },
      { id: 'secteur', label: "Secteur d'activité", type: 'select', options: [
        '', 'Commerce et distribution', 'BTP et travaux', 'Transport et logistique',
        'Tourisme, hôtellerie, restauration', 'Santé et action sociale', 'Services aux entreprises',
        'Banque, assurance, immobilier', 'Industrie et agroalimentaire', 'Agriculture et pêche',
        'Administration et collectivité', 'Association', 'Formation et enseignement',
        'Informatique et numérique', 'Artisanat', 'Profession libérale', 'Autre'] },
      { id: 'anciennete', label: 'Ancienneté dans cette fonction', type: 'select',
        options: ['', "Moins d'un an", '1 à 3 ans', '3 à 10 ans', 'Plus de 10 ans'] },
      { id: 'encadre', label: 'Nombre de personnes que vous encadrez', type: 'select',
        options: ['', 'Aucune', '1 à 3', '4 à 10', 'Plus de 10'] },
      { id: 'formation', label: 'Formation visée', type: 'text' },
    ],
  },
  {
    n: 2, id: 'pratique', titre: 'Votre pratique actuelle',
    intro: "Aucune bonne réponse ici : il s'agit de mesurer votre point de départ réel.",
    questions: [
      { id: 'q1', type: 'radio', q: "À quelle fréquence utilisez-vous un outil d'IA générative (ChatGPT, Claude, Copilot, Gemini, Le Chat…) dans un cadre professionnel ?",
        options: [['a', 'Jamais'], ['b', 'Quelques fois par mois'], ['c', 'Plusieurs fois par semaine'], ['d', "Quotidiennement — c'est intégré à mon travail"]] },
      { id: 'q2', type: 'check', q: 'Quels outils avez-vous déjà utilisés, même une seule fois ?', hint: 'Plusieurs réponses possibles.',
        options: [['a', 'ChatGPT'], ['b', 'Claude'], ['c', 'Gemini'], ['d', 'Copilot (Microsoft 365)'], ['e', 'Le Chat (Mistral)'], ['f', 'Perplexity'], ['g', "Un générateur d'images (Midjourney, DALL·E…)"], ['h', 'NotebookLM'], ['i', "Un outil d'automatisation (Make, n8n, Zapier)"], ['j', 'Aucun de ces outils']] },
      { id: 'q3', type: 'radio', q: "Dans quel cadre l'utilisez-vous principalement ?",
        options: [['a', 'Usage personnel uniquement'], ['b', 'Usage professionnel ponctuel, de ma propre initiative'], ['c', "Usage professionnel, avec un outil fourni par l'employeur"], ['d', "Je forme ou conseille déjà d'autres personnes"], ['e', "Je ne l'utilise pas"]] },
      { id: 'q4', type: 'radio', q: "Votre organisation dispose-t-elle d'une charte ou d'une règle écrite encadrant l'usage de l'IA ?",
        options: [['a', "Oui, et je l'ai lue"], ['b', "Oui, mais je ne l'ai pas lue"], ['c', 'Non'], ['d', 'Je ne sais pas']] },
    ],
  },
  {
    n: 3, id: 'comprendre', titre: "Comprendre l'IA générative",
    intro: "Une seule réponse exacte par question. Répondez sans chercher : une mauvaise réponse ici n'a aucune conséquence, elle nous indique simplement quoi expliquer.",
    questions: [
      { id: 'q5', type: 'radio', domain: 'comprendre', pts: 2, correct: 'b',
        q: 'Un grand modèle de langage (LLM) produit sa réponse en :',
        options: [['a', 'retrouvant la phrase la plus proche dans une base de données'],
          ['b', 'prédisant le fragment de texte suivant le plus probable, un fragment après l’autre'],
          ['c', 'appliquant des règles logiques écrites par des ingénieurs'],
          ['d', 'interrogeant Internet en temps réel à chaque question']] },
      { id: 'q6', type: 'radio', domain: 'comprendre', pts: 2, correct: 'b',
        q: "On parle d'« hallucination » lorsque le modèle :",
        options: [['a', 'met beaucoup de temps à répondre'],
          ['b', 'produit une information fausse, énoncée avec assurance et dans une forme crédible'],
          ['c', 'refuse de répondre à une question'],
          ['d', 'répond dans une autre langue que celle attendue']] },
      { id: 'q7', type: 'radio', domain: 'comprendre', pts: 2, correct: 'b',
        q: "La « fenêtre de contexte » d'un modèle désigne :",
        options: [['a', "la durée de validité de l'abonnement"],
          ['b', 'la quantité de texte que le modèle peut prendre en compte en une seule fois'],
          ['c', "le nombre d'utilisateurs simultanés autorisés"],
          ['d', "le délai avant que la conversation ne s'efface"]] },
      { id: 'q8', type: 'radio', domain: 'comprendre', pts: 2, correct: 'b',
        q: 'Vous avez besoin du chiffre exact figurant dans un rapport interne. La méthode la plus fiable consiste à :',
        options: [['a', 'poser la question directement au modèle et lui faire confiance'],
          ['b', "lui fournir le document source et lui demander de s'en tenir strictement à son contenu"],
          ['c', 'reformuler la question trois fois et retenir la réponse la plus fréquente'],
          ['d', "lui demander s'il est certain de sa réponse"]] },
      { id: 'q9', type: 'radio', domain: 'comprendre', pts: 2, correct: 'b',
        q: 'Parmi ces affirmations, laquelle est exacte ?',
        options: [['a', 'Le modèle apprend de chacune de vos conversations et se met à jour en conséquence'],
          ['b', "Le modèle a une date de coupure de connaissances et ignore ce qui s'est produit après, sauf s'il dispose d'une recherche web"],
          ['c', "Le modèle connaît toujours la date et l'heure du jour"],
          ['d', 'Deux modèles différents donnent toujours la même réponse à une même question']] },
      { id: 'q10', type: 'radio', domain: 'comprendre', pts: 2, correct: 'b',
        q: 'Le terme « RAG » désigne une technique qui consiste à :',
        options: [['a', 'accélérer la vitesse de génération du modèle'],
          ['b', "faire chercher au modèle des extraits pertinents dans vos propres documents avant qu'il ne réponde"],
          ['c', 'réduire le coût d’utilisation en compressant les questions'],
          ['d', 'traduire automatiquement les réponses']] },
    ],
  },
  {
    n: 4, id: 'formuler', titre: 'Savoir formuler une demande',
    intro: "La qualité d'un résultat dépend davantage de la consigne que de l'outil.",
    questions: [
      { id: 'q11', type: 'radio', domain: 'formuler', pts: 2, correct: 'b',
        q: 'Laquelle de ces deux demandes produira le meilleur résultat ?',
        options: [['a', '« Fais-moi un compte rendu de réunion. »'],
          ['b', '« À partir des notes ci-dessous, rédige un compte rendu de 400 mots destiné au comité de direction, en trois parties : décisions prises, points en suspens, prochaines étapes avec responsable et échéance. »'],
          ['c', 'Les deux se valent, le modèle comprend l’intention'],
          ['d', 'La première : il faut laisser le modèle libre de sa forme']] },
      { id: 'q12', type: 'radio', domain: 'formuler', pts: 2, correct: 'c',
        q: 'Le premier résultat obtenu est décevant. Que faites-vous en priorité ?',
        options: [['a', "J'abandonne, l'outil n'est pas adapté à mon métier"],
          ['b', 'Je relance exactement la même demande'],
          ['c', "J'explique ce qui ne convient pas et ce que j'attends précisément, puis j'itère"],
          ['d', "Je change d'outil"]] },
      { id: 'q13', type: 'check', domain: 'formuler', ptsEach: 1,
        correct: ['a', 'b', 'c', 'd', 'e'], wrong: ['f', 'g'],
        q: "Quels éléments améliorent réellement la qualité d'une réponse ?",
        hint: 'Plusieurs réponses possibles — deux propositions sont des idées reçues.',
        options: [['a', "Préciser le rôle ou l'expertise attendue (« en tant que juriste… »)"],
          ['b', "Donner le contexte et l'enjeu de la demande"],
          ['c', 'Fournir un exemple du résultat attendu'],
          ['d', 'Imposer un format et une longueur'],
          ['e', 'Énoncer les critères qui feront que le résultat est réussi'],
          ['f', 'Écrire en majuscules pour insister'],
          ['g', "Préciser que c'est très important pour vous"]] },
      { id: 'q14', type: 'radio', domain: 'formuler', pts: 2, correct: 'b',
        q: 'Pour un travail long — analyser un dossier de quarante pages — la meilleure approche est :',
        options: [['a', 'tout coller d’un bloc et demander « résume »'],
          ['b', 'découper le travail en étapes, valider chaque étape, puis assembler'],
          ['c', 'demander un résumé en trois lignes pour aller vite'],
          ['d', "éviter l'IA, la tâche est trop complexe"]] },
    ],
  },
  {
    n: 5, id: 'cadre', titre: 'Cadre, données et responsabilité',
    intro: "Le volet le plus souvent négligé — et celui qui expose le plus l'organisation.",
    questions: [
      { id: 'q15', type: 'radio', domain: 'cadre', pts: 2, correct: 'b',
        q: "Un collègue s'apprête à copier dans un outil d'IA grand public un fichier contenant les noms, adresses et informations sensibles de clients. Vous :",
        options: [['a', "ne voyez pas de difficulté particulière, l'outil est réputé"],
          ['b', "lui rappelez que ces données ne doivent pas être transmises à un service non validé par l'organisation"],
          ['c', 'lui conseillez de retirer seulement les noms de famille'],
          ['d', "lui suggérez de le faire depuis son compte personnel pour ne pas engager l'entreprise"]] },
      { id: 'q16', type: 'radio', domain: 'cadre', pts: 2, correct: 'b',
        q: "Un document produit avec l'IA contient une erreur et a été diffusé à un client. Qui en est responsable ?",
        options: [['a', "L'éditeur de l'outil"], ['b', 'Vous, et votre organisation'],
          ['c', "Personne, l'erreur est technique"], ['d', 'Le modèle qui a généré le texte']] },
      { id: 'q17', type: 'radio', domain: 'cadre', pts: 2, correct: 'b',
        q: "Le règlement européen sur l'intelligence artificielle (AI Act) prévoit notamment :",
        options: [['a', "l'interdiction de l'IA générative en entreprise"],
          ['b', "une obligation d'informer les personnes lorsqu'elles interagissent avec une IA, et des obligations renforcées pour les usages à haut risque"],
          ['c', 'une taxe sur chaque requête effectuée'],
          ['d', 'aucune obligation pour les entreprises de moins de 250 salariés']] },
      { id: 'q18', type: 'radio', domain: 'cadre', pts: 2, correct: 'a',
        q: "Avant de diffuser un texte rédigé avec l'aide de l'IA, l'étape indispensable est :",
        options: [['a', 'vérifier les faits, les chiffres et les sources citées'],
          ['b', 'reformuler quelques phrases pour que le style paraisse humain'],
          ['c', 'changer la police de caractères'],
          ['d', "aucune, le texte est prêt à l'emploi"]] },
    ],
  },
  {
    n: 6, id: 'avance', titre: 'Aller plus loin',
    intro: "Ces questions servent à distinguer les profils déjà autonomes. Ne pas savoir y répondre est parfaitement normal.",
    questions: [
      { id: 'q19', type: 'check', domain: 'avance', ptsEach: 1,
        correct: ['a', 'b', 'c', 'd', 'e', 'f'], wrong: [],
        q: "Avez-vous déjà réalisé l'une de ces actions ?", hint: 'Plusieurs réponses possibles.',
        options: [['a', 'Créé un assistant personnalisé réutilisable (GPT, Projet, Gem…)'],
          ['b', "Connecté un outil d'IA à vos propres documents"],
          ['c', 'Automatisé une tâche récurrente de bout en bout'],
          ['d', 'Utilisé une API ou un accès programmatique'],
          ['e', 'Comparé plusieurs modèles sur une même tâche'],
          ['f', 'Rédigé une consigne système réutilisée par toute une équipe'],
          ['g', 'Aucune de ces actions']] },
      { id: 'q20', type: 'radio', domain: 'avance', pts: 2, correct: 'b',
        q: "Un « agent » se distingue d'un simple assistant conversationnel parce qu'il :",
        options: [['a', 'répond plus rapidement'],
          ['b', 'enchaîne plusieurs étapes et utilise des outils pour atteindre un objectif fixé'],
          ['c', "dispose d'une voix de synthèse"],
          ['d', "coûte plus cher à l'usage"]] },
    ],
  },
  {
    n: 7, id: 'ressenti', titre: "Votre rapport à l'outil",
    intro: 'Deux échelles et une question de ressenti. Répondez franchement : une appréhension non dite reste un frein pendant toute la formation.',
    questions: [
      { id: 's1', type: 'scale', q: 'Votre aisance générale avec les outils numériques',
        low: 'Je suis vite en difficulté', high: 'Je me débrouille seul en toutes circonstances' },
      { id: 's2', type: 'scale', q: "Votre aisance avec l'IA générative en particulier",
        low: "Je n'y ai jamais touché", high: "Je l'utilise couramment et j'en connais les limites" },
      { id: 'q21', type: 'check', q: "Ce que vous ressentez principalement face à l'IA dans votre métier :",
        hint: 'Plusieurs réponses possibles.',
        options: [['a', 'De la curiosité'], ['b', "Du scepticisme sur l'utilité réelle"],
          ['c', 'Une inquiétude pour mon métier ou mon poste'],
          ['d', 'Une pression de ma hiérarchie ou de mes clients'], ['e', "De l'enthousiasme"],
          ['f', "Un sentiment d'être déjà en retard"], ['g', "De l'indifférence"]] },
    ],
  },
  {
    n: 8, id: 'objectifs', titre: 'Vos objectifs opérationnels',
    intro: "Un objectif opérationnel décrit ce que vous devrez être capable de faire à l'issue de la formation — pas ce que vous devrez savoir. « Comprendre l'IA » n'est pas un objectif ; « rédiger en vingt minutes un compte rendu de réunion exploitable à partir de mes notes » en est un.",
    custom: 'objectifs',
  },
  {
    n: 9, id: 'irritants', titre: 'Ce qui vous coûte le plus cher',
    intro: "Listez les tâches de votre poste ou de votre secteur qui prennent le plus de temps, génèrent le plus d'erreurs ou coûtent le plus cher. C'est la partie la plus utile de ce questionnaire : les cas pratiques de la formation seront construits à partir de ces réponses.",
    custom: 'irritants',
  },
  {
    n: 10, id: 'conditions', titre: 'Conditions pratiques',
    intro: 'Dernière ligne droite. Ces éléments conditionnent le déroulement de la session.',
    champs: [
      { id: 'outils_dispo', label: "Outils d'IA disponibles ou autorisés sur votre poste", type: 'text', full: true, ph: 'ex. Copilot Microsoft 365, aucun, je ne sais pas' },
      { id: 'materiel', label: 'Matériel dont vous disposerez pendant la formation', type: 'select',
        options: ['', 'Un ordinateur portable professionnel', 'Un ordinateur portable personnel', 'Une tablette', 'Aucun, je compte sur le matériel fourni'] },
      { id: 'dispo', label: 'Contraintes de disponibilité à signaler', type: 'text', ph: 'ex. indisponible le vendredi après-midi' },
      { id: 'amenagement', label: 'Avez-vous besoin d’un aménagement particulier ?', type: 'select',
        options: ['', 'Non', 'Oui — je souhaite être contacté à ce sujet'] },
      { id: 'amenagement_p', label: "Précisions sur l'aménagement souhaité (facultatif)", type: 'text', full: true, ph: 'Toute demande sera traitée confidentiellement avec le référent handicap' },
      { id: 'attentes', label: 'Une remarque, une attente ou une question à transmettre au formateur', type: 'textarea', full: true },
    ],
  },
];

export const TACHES_SUGGEREES = [
  'Comptes rendus de réunion', "Réponses aux appels d'offres", 'Reporting et tableaux de bord',
  'Tri et réponse aux emails', 'Recherche d’information dans nos documents', 'Rédaction de devis',
  'Saisie et ressaisie de données', 'Création de supports de présentation', 'Traduction de documents',
  'Veille concurrentielle ou réglementaire', 'Réponses clients répétitives',
  "Rédaction d'offres d'emploi et tri des CV", 'Préparation des formations internes',
  'Relances impayés', 'Rédaction de procédures',
];

export const FREQUENCES = ['', 'Plusieurs fois par jour', 'Quotidienne', 'Hebdomadaire', 'Mensuelle', 'Ponctuelle mais lourde'];
export const REALISEE_PAR = ['', 'Moi seul', 'Mon équipe', 'Plusieurs services', 'Un prestataire externe'];
export const NATURES_COUT = ['', 'Le temps passé', 'Les erreurs et les reprises', "Le délai d'attente pour les autres", 'La charge mentale', 'Le coût externe (prestataire, licence)'];

// ── Forme des réponses ──────────────────────────────────────────────────────
export type Tache = { tache: string; frequence: string; heures: string; qui: string; cout: string };
export type Objectif = { but: string; critere: string };

export type Reponses = {
  /** Champs libres des sections 1 et 10, indexés par `Champ.id`. */
  champs: Record<string, string>;
  /** Questions à réponse unique et échelles, indexées par `Question.id`. */
  radios: Record<string, string>;
  /** Questions à choix multiples. */
  checks: Record<string, string[]>;
  objectifs: Objectif[];
  priorite: string;
  taches: Tache[];
};

export const reponsesVides = (): Reponses => ({
  champs: {}, radios: {}, checks: {},
  objectifs: [{ but: '', critere: '' }, { but: '', critere: '' }, { but: '', critere: '' }],
  priorite: '',
  taches: [tacheVide(), tacheVide(), tacheVide()],
});

export const tacheVide = (tache = ''): Tache => ({ tache, frequence: '', heures: '', qui: '', cout: '' });

/**
 * Avancement du remplissage, en pourcentage. Sert la barre de progression :
 * on compte les champs et questions effectivement renseignés, plus une unité
 * pour « au moins une tâche chronophage listée » — la section la plus utile
 * au formateur, et celle qu'on abandonne le plus volontiers.
 */
export function progression(r: Reponses): number {
  const ids: string[] = [];
  for (const s of SECTIONS) {
    for (const c of s.champs ?? []) ids.push(c.id);
    for (const q of s.questions ?? []) ids.push(q.id);
  }
  let faits = 0;
  for (const id of ids) {
    if ((r.champs[id] ?? '').trim()) { faits++; continue; }
    if ((r.radios[id] ?? '').trim()) { faits++; continue; }
    if ((r.checks[id] ?? []).length) faits++;
  }
  const o = r.objectifs[0];
  if (o?.but.trim()) faits++;
  if (o?.critere.trim()) faits++;
  if (r.priorite.trim()) faits++;
  const tache = r.taches.some((t) => t.tache.trim()) ? 1 : 0;
  const total = ids.length + 3 + 1;
  return Math.min(100, Math.round(((faits + tache) / total) * 100));
}

// ── Notation ────────────────────────────────────────────────────────────────
export type ScoreDomaine = { got: number; max: number; pct: number };
export type DetailReponse = {
  id: string; question: string; type: 'radio' | 'check';
  donnee: string; attendu?: string; juste: boolean | null; points: number;
};
export type Score = {
  got: number; max: number; pct: number; niveau: string;
  domaines: Record<DomaineCle, ScoreDomaine>;
  detail: DetailReponse[];
};

export const NIVEAUX: { min: number; nom: string; reco: string }[] = [
  { min: 80, nom: 'Référent', reco: "Vous maîtrisez les fondamentaux et vous avez déjà mis les mains dans des usages avancés. La formation ne doit pas vous réexpliquer ce que vous savez : elle portera sur la conception d'assistants réutilisables, l'automatisation de bout en bout, et la diffusion des usages auprès de vos équipes. Vous serez sollicité comme appui pendant les travaux pratiques." },
  { min: 60, nom: 'Autonome', reco: "Vos bases sont solides et votre pratique est réelle. L'enjeu n'est plus de découvrir mais d'industrialiser : consignes réutilisables, connexion à vos propres documents, automatisation de vos tâches récurrentes, et surtout maîtrise du cadre de conformité qui conditionne un déploiement en entreprise." },
  { min: 35, nom: 'Initié', reco: "Vous avez déjà touché à l'outil et vous en percevez l'intérêt, mais votre pratique reste intuitive et irrégulière. La formation consolidera la méthode : structurer une demande, itérer efficacement, reconnaître une réponse douteuse, et transposer ces réflexes aux tâches concrètes que vous avez listées." },
  { min: 0, nom: 'Découverte', reco: "Vous partez du socle, ce qui est le point de départ le plus fréquent et le plus confortable : aucune habitude à corriger. La formation commencera par les fondamentaux — ce qu'est réellement un modèle, ce qu'il sait et ne sait pas faire — avant de construire pas à pas vos premiers usages sur vos propres dossiers." },
];

export const niveauDe = (pct: number) => NIVEAUX.find((n) => pct >= n.min) ?? NIVEAUX[NIVEAUX.length - 1];

export const toutesLesQuestions = (): Question[] => SECTIONS.flatMap((s) => s.questions ?? []);

const libelleOption = (q: Question, cle: string): string => {
  if (q.type === 'scale') return cle;
  return q.options.find(([k]) => k === cle)?.[1] ?? '(sans réponse)';
};

/**
 * Score par domaine. Les QCM à choix multiples comptent un point par bonne
 * case et retirent un point par « idée reçue » cochée, sans jamais descendre
 * sous zéro : se tromper ne doit pas coûter plus cher que ne rien cocher.
 */
export function noter(r: Reponses): Score {
  const domaines = {} as Record<DomaineCle, ScoreDomaine>;
  for (const cle of Object.keys(DOMAINES) as DomaineCle[]) domaines[cle] = { got: 0, max: 0, pct: 0 };
  const detail: DetailReponse[] = [];

  for (const q of toutesLesQuestions()) {
    if (q.type === 'scale' || !q.domain) continue;
    const D = domaines[q.domain];

    if (q.type === 'radio') {
      const pts = q.pts ?? 0;
      D.max += pts;
      const donnee = r.radios[q.id] ?? null;
      const juste = donnee != null && donnee === q.correct;
      if (juste) D.got += pts;
      detail.push({
        id: q.id, question: q.q, type: 'radio',
        donnee: donnee ? libelleOption(q, donnee) : 'sans réponse',
        attendu: q.correct ? libelleOption(q, q.correct) : undefined,
        juste, points: juste ? pts : 0,
      });
    } else {
      const parCase = q.ptsEach ?? 1;
      const bonnes = q.correct ?? [];
      D.max += bonnes.length * parCase;
      const cochees = r.checks[q.id] ?? [];
      let pts = 0;
      for (const v of cochees) {
        if (bonnes.includes(v)) pts += parCase;
        else if ((q.wrong ?? []).includes(v)) pts -= parCase;
      }
      pts = Math.max(0, pts);
      D.got += pts;
      detail.push({
        id: q.id, question: q.q, type: 'check',
        donnee: cochees.length ? cochees.map((v) => libelleOption(q, v)).join(' ; ') : 'rien',
        juste: null, points: pts,
      });
    }
  }

  let got = 0, max = 0;
  for (const cle of Object.keys(domaines) as DomaineCle[]) {
    const d = domaines[cle];
    d.pct = d.max ? Math.round((d.got / d.max) * 100) : 0;
    got += d.got; max += d.max;
  }
  const pct = max ? Math.round((got / max) * 100) : 0;
  return { got, max, pct, niveau: niveauDe(pct).nom, domaines, detail };
}

/** Cumul horaire déclaré des tâches chronophages et sa projection annuelle. */
export function cumulTaches(taches: Tache[]) {
  const remplies = taches.filter((t) => t.tache.trim());
  const heures = remplies.reduce((s, t) => s + (parseFloat(t.heures) || 0), 0);
  const annuel = Math.round(heures * SEMAINES_TRAVAILLEES);
  return { remplies, heures, annuel, journees: Math.round(annuel / 7) };
}

// ── Synthèse texte ──────────────────────────────────────────────────────────
const trait = (c: string) => c.repeat(64);
const tronque = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function replier(s: string, n: number): string {
  const mots = String(s).split(/\s+/);
  const lignes: string[] = [];
  let ligne = '';
  for (const m of mots) {
    if (`${ligne} ${m}`.trim().length > n) { lignes.push(ligne.trim()); ligne = m; }
    else ligne += ` ${m}`;
  }
  if (ligne.trim()) lignes.push(ligne.trim());
  return lignes.join('\n');
}

const ORGANISME = 'Aissociate';
const BASELINE = 'Organisme de formation certifié Qualiopi';

/**
 * Synthèse en texte brut, destinée au formateur : c'est elle qu'on archive au
 * dossier et qu'on imprime. Le texte est aligné en colonnes pour rester
 * lisible tel quel dans un mail ou un PDF.
 */
export function construireSynthese(r: Reponses, s: Score, opts?: { origine?: 'apprenant' | 'formateur'; auteur?: string }): string {
  const L: string[] = [];
  const now = new Date();
  const stamp = `${now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  const val = (id: string) => (r.champs[id] ?? '').trim();

  L.push(trait('='));
  L.push("TEST DE POSITIONNEMENT — L'IA DANS VOTRE MÉTIER");
  L.push(`${ORGANISME} — ${BASELINE}`);
  L.push(`Complété le ${stamp}`);
  if (opts?.origine === 'formateur') {
    L.push(`Saisi par l'organisme${opts.auteur ? ` (${opts.auteur})` : ''} — apprenant absent ou sans réponse.`);
  }
  L.push(trait('='), '');

  L.push('1. PARTICIPANT');
  L.push(trait('-'));
  ([['Nom', 'nom'], ['Email', 'email'], ['Organisation', 'orga'], ['Fonction', 'poste'],
    ['Secteur', 'secteur'], ['Ancienneté', 'anciennete'], ['Encadrement', 'encadre'],
    ['Formation visée', 'formation']] as const).forEach(([lab, id]) => {
    L.push(`${lab.padEnd(18)}: ${val(id) || '—'}`);
  });
  L.push('');

  L.push('2. POSITIONNEMENT');
  L.push(trait('-'));
  L.push(`Niveau global      : ${s.niveau.toUpperCase()}  (${s.pct} % — ${s.got}/${s.max} points)`);
  for (const [cle, label] of Object.entries(DOMAINES) as [DomaineCle, string][]) {
    const d = s.domaines[cle];
    L.push(`${label.padEnd(36).slice(0, 36)} ${String(d.got).padStart(2)}/${String(d.max).padEnd(2)}  (${String(d.pct).padStart(3)} %)`);
  }
  L.push('', 'Orientation proposée :', replier(niveauDe(s.pct).reco, 64), '');

  L.push('3. PRATIQUE ACTUELLE DÉCLARÉE');
  L.push(trait('-'));
  for (const q of SECTIONS.find((x) => x.id === 'pratique')?.questions ?? []) {
    if (q.type === 'radio') {
      const v = r.radios[q.id];
      L.push(`• ${q.q}`, `  → ${v ? libelleOption(q, v) : 'sans réponse'}`);
    } else if (q.type === 'check') {
      const vs = r.checks[q.id] ?? [];
      L.push(`• ${q.q}`, `  → ${vs.length ? vs.map((v) => libelleOption(q, v)).join(' ; ') : 'sans réponse'}`);
    }
  }
  const q21 = SECTIONS.find((x) => x.id === 'ressenti')?.questions?.find((q) => q.id === 'q21');
  const ressenti = r.checks.q21 ?? [];
  L.push(`• Aisance numérique générale : ${r.radios.s1 ? `${r.radios.s1}/5` : '—'}`);
  L.push(`• Aisance avec l'IA générative : ${r.radios.s2 ? `${r.radios.s2}/5` : '—'}`);
  L.push(`• Ressenti : ${ressenti.length && q21 ? ressenti.map((v) => libelleOption(q21, v)).join(' ; ') : '—'}`);
  L.push('');

  L.push('4. OBJECTIFS OPÉRATIONNELS EXPRIMÉS');
  L.push(trait('-'));
  let aucun = true;
  r.objectifs.forEach((o, i) => {
    if (!o.but.trim() && !o.critere.trim()) return;
    aucun = false;
    L.push(`Objectif ${i + 1} — Être capable de : ${o.but.trim() || '—'}`);
    L.push(`            Critère de réussite : ${o.critere.trim() || '—'}`);
  });
  if (aucun) L.push('(aucun objectif renseigné)');
  if (r.priorite.trim()) L.push('', 'Priorité absolue exprimée :', replier(r.priorite.trim(), 64));
  L.push('');

  L.push('5. TÂCHES COÛTEUSES OU CHRONOPHAGES (déclaratif)');
  L.push(trait('-'));
  const { remplies, heures, annuel, journees } = cumulTaches(r.taches);
  if (!remplies.length) L.push('(aucune tâche renseignée)');
  remplies.forEach((t, i) => {
    const h = parseFloat(t.heures);
    L.push(`${String(i + 1).padStart(2, '0')}. ${t.tache.trim()}`);
    L.push(`    Fréquence : ${t.frequence || '—'} | Temps : ${Number.isNaN(h) ? '—' : `${h} h/sem`} | Réalisée par : ${t.qui || '—'}`);
    L.push(`    Nature du coût : ${t.cout || '—'}`);
  });
  if (remplies.length) {
    L.push('');
    L.push(`CUMUL DÉCLARÉ : ${heures.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h/semaine`);
    L.push(`PROJECTION    : ${annuel.toLocaleString('fr-FR')} h/an (base ${SEMAINES_TRAVAILLEES} semaines), soit ~${journees} journées de 7 h`);
  }
  L.push('');

  L.push('6. CONDITIONS PRATIQUES');
  L.push(trait('-'));
  ([['Outils disponibles', 'outils_dispo'], ['Matériel', 'materiel'],
    ['Contraintes de disponibilité', 'dispo'], ['Aménagement demandé', 'amenagement'],
    ['Précisions', 'amenagement_p']] as const).forEach(([lab, id]) => {
    L.push(`${lab.padEnd(28)}: ${val(id) || '—'}`);
  });
  if (val('attentes')) L.push('', 'Remarques transmises au formateur :', replier(val('attentes'), 64));
  L.push('');

  L.push('7. DÉTAIL DES RÉPONSES NOTÉES');
  L.push(trait('-'));
  for (const d of s.detail) {
    if (d.type === 'radio') {
      L.push(`[${d.juste ? 'OK ' : ' X '}] ${d.id.toUpperCase()} — ${tronque(d.question, 70)}`);
      L.push(`       Réponse : ${tronque(d.donnee, 66)}`);
      if (!d.juste && d.attendu) L.push(`       Attendu : ${tronque(d.attendu, 66)}`);
    } else {
      L.push(`[${String(d.points).padStart(2)} ] ${d.id.toUpperCase()} — ${tronque(d.question, 70)}`);
      L.push(`       Coché : ${tronque(d.donnee, 66)}`);
    }
  }
  L.push('', trait('='));
  L.push("Document généré automatiquement — positionnement d'entrée en formation.");
  L.push(trait('='));
  return L.join('\n');
}
