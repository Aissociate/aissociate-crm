/**
 * Évaluations de fin de formation — questionnaires GÉNÉRIQUES, valables pour
 * toute formation du catalogue (aucune question n'est propre à une thématique).
 *
 *   - à chaud : rempli en fin de formation — satisfaction, atteinte des
 *     objectifs, auto-évaluation avant / après (Qualiopi indicateurs 11 et 30) ;
 *   - à froid : envoyé à J+30 — mise en pratique, impact sur le poste, freins.
 *
 * Partagé par la page publique `/evaluation/:token` et la saisie depuis le
 * CRM : les deux notent exactement la même chose. Les réponses brutes sont
 * stockées avec la note, qui reste recalculable depuis `noter()`.
 */

export type EvaluationType = 'chaud' | 'froid';

export type Question =
  | { id: string; type: 'scale'; q: string; low?: string; high?: string; req?: boolean }
  | { id: string; type: 'nps'; q: string; req?: boolean }
  | { id: string; type: 'radio' | 'check'; q: string; options: string[]; hint?: string; req?: boolean }
  | { id: string; type: 'textarea'; q: string; ph?: string; req?: boolean };

export type Section = { id: string; titre: string; intro: string; questions: Question[] };

export type Champ = { id: string; label: string; type?: 'email'; req?: boolean; ph?: string };

export type Reponses = {
  version: 1;
  champs: Record<string, string>;
  valeurs: Record<string, string | string[]>;
};

export type Note = {
  /** Moyenne des échelles 1-5, une décimale ; null si aucune échelle remplie. */
  note: number | null;
  pct: number | null;
  /** Recommandation 0-10. */
  nps: number | null;
  /** Écart d'auto-évaluation après − avant (à chaud uniquement). */
  progression: number | null;
};

export const DELAI_FROID_JOURS = 30;

export const TYPE_LABELS: Record<EvaluationType, string> = {
  chaud: 'À chaud',
  froid: 'À froid (J+30)',
};

export const LIBELLES_DEFAUT: Record<EvaluationType, string> = {
  chaud: 'Évaluation de fin de formation',
  froid: 'Votre formation, un mois après',
};

export const CHAMPS: Champ[] = [
  { id: 'nom', label: 'Nom et prénom', req: true },
  { id: 'email', label: 'Adresse email', type: 'email', req: true },
  { id: 'orga', label: 'Entreprise / organisation' },
  { id: 'poste', label: 'Fonction' },
  { id: 'formation', label: 'Formation suivie' },
];

const ACCORD = { low: "Pas du tout d'accord", high: "Tout à fait d'accord" };

const CHAUD: Section[] = [
  {
    id: 'objectifs', titre: 'Objectifs et contenu',
    intro: "Votre appréciation du programme au regard de ce qui vous avait été annoncé.",
    questions: [
      { id: 'obj_clairs', type: 'scale', q: 'Les objectifs de la formation étaient clairement annoncés.', ...ACCORD, req: true },
      { id: 'obj_atteints', type: 'scale', q: 'Les objectifs de la formation ont été atteints.', ...ACCORD, req: true },
      { id: 'contenu_adapte', type: 'scale', q: 'Le contenu correspondait à mes besoins et à mon poste.', ...ACCORD, req: true },
      { id: 'pratique', type: 'scale', q: "L'équilibre entre apports théoriques et mises en pratique était satisfaisant.", ...ACCORD, req: true },
    ],
  },
  {
    id: 'animation', titre: 'Animation pédagogique',
    intro: 'Votre regard sur le formateur et la conduite des séances.',
    questions: [
      { id: 'maitrise', type: 'scale', q: 'Le formateur maîtrisait son sujet.', ...ACCORD, req: true },
      { id: 'clarte', type: 'scale', q: 'Les explications étaient claires et illustrées d\'exemples.', ...ACCORD, req: true },
      { id: 'ecoute', type: 'scale', q: 'Le formateur était à l\'écoute et disponible pour répondre aux questions.', ...ACCORD, req: true },
      { id: 'rythme', type: 'scale', q: 'Le rythme était adapté au groupe.', ...ACCORD, req: true },
    ],
  },
  {
    id: 'organisation', titre: 'Organisation et moyens',
    intro: 'Information préalable, supports, conditions matérielles ou techniques.',
    questions: [
      { id: 'info_prealable', type: 'scale', q: "J'ai été bien informé(e) avant la formation (programme, convocation, modalités).", ...ACCORD, req: true },
      { id: 'supports', type: 'scale', q: 'Les supports pédagogiques remis sont utiles et de qualité.', ...ACCORD, req: true },
      { id: 'conditions', type: 'scale', q: 'Les conditions matérielles (salle, outils, connexion à distance) étaient satisfaisantes.', ...ACCORD, req: true },
      { id: 'duree', type: 'scale', q: 'La durée de la formation était adaptée au contenu.', ...ACCORD, req: true },
    ],
  },
  {
    id: 'acquis', titre: 'Vos acquis',
    intro: "Une auto-évaluation : elle mesure votre progression ressentie, sans aucun enjeu de note.",
    questions: [
      { id: 'niveau_avant', type: 'scale', q: 'Mon niveau sur le sujet AVANT la formation.', low: 'Débutant', high: 'Expert', req: true },
      { id: 'niveau_apres', type: 'scale', q: 'Mon niveau sur le sujet APRÈS la formation.', low: 'Débutant', high: 'Expert', req: true },
      { id: 'capable', type: 'scale', q: 'Je me sens capable d\'appliquer ce que j\'ai appris dans mon travail.', ...ACCORD, req: true },
    ],
  },
  {
    id: 'bilan', titre: 'Bilan',
    intro: 'Votre appréciation d\'ensemble et vos suggestions.',
    questions: [
      { id: 'satisfaction', type: 'scale', q: 'Globalement, je suis satisfait(e) de cette formation.', ...ACCORD, req: true },
      { id: 'nps', type: 'nps', q: 'Recommanderiez-vous cette formation à un collègue ?', req: true },
      { id: 'points_forts', type: 'textarea', q: 'Ce que vous avez le plus apprécié', ph: 'Points forts, moments utiles…' },
      { id: 'ameliorations', type: 'textarea', q: 'Ce qui pourrait être amélioré', ph: 'Contenu, rythme, organisation…' },
      { id: 'besoins', type: 'textarea', q: 'Avez-vous d\'autres besoins de formation ?' },
    ],
  },
];

const FROID: Section[] = [
  {
    id: 'pratique', titre: 'Mise en pratique',
    intro: 'Un mois après la formation, ce que vous en avez fait concrètement.',
    questions: [
      {
        id: 'mise_en_pratique', type: 'radio', req: true,
        q: 'Avez-vous mis en pratique ce que vous avez appris ?',
        options: ['Oui, régulièrement', 'Oui, ponctuellement', 'Pas encore, mais c\'est prévu', 'Non'],
      },
      { id: 'utile', type: 'scale', q: 'Les acquis de la formation me sont utiles dans mon poste.', ...ACCORD, req: true },
      { id: 'autonome', type: 'scale', q: 'Je suis autonome sur les compétences travaillées.', ...ACCORD, req: true },
      { id: 'efficacite', type: 'scale', q: 'La formation a amélioré mon efficacité ou la qualité de mon travail.', ...ACCORD, req: true },
      { id: 'exemple', type: 'textarea', q: 'Un exemple concret d\'application', ph: 'Une tâche, une situation où la formation vous a servi…' },
    ],
  },
  {
    id: 'impact', titre: 'Impact',
    intro: 'Ce que la formation a changé dans votre quotidien.',
    questions: [
      {
        id: 'temps_gagne', type: 'radio',
        q: 'Estimation du temps gagné par semaine grâce à la formation',
        options: ['Aucun', 'Moins d\'une heure', '1 à 3 heures', '3 à 5 heures', 'Plus de 5 heures'],
      },
      {
        id: 'freins', type: 'check',
        q: 'Qu\'est-ce qui a freiné la mise en pratique ?', hint: 'Plusieurs réponses possibles.',
        options: [
          'Manque de temps', 'Outils ou matériel non disponibles', 'Manque d\'accompagnement après la formation',
          'Contenu éloigné de mon poste', 'Besoin de pratique supplémentaire', 'Aucun frein',
        ],
      },
      { id: 'freins_detail', type: 'textarea', q: 'Précisions sur les freins rencontrés' },
    ],
  },
  {
    id: 'recul', titre: 'Avec le recul',
    intro: 'Votre appréciation d\'ensemble, un mois après.',
    questions: [
      { id: 'satisfaction', type: 'scale', q: 'Avec le recul, je suis satisfait(e) de cette formation.', ...ACCORD, req: true },
      { id: 'nps', type: 'nps', q: 'Recommanderiez-vous cette formation à un collègue ?', req: true },
      { id: 'besoins', type: 'textarea', q: 'Quels besoins complémentaires identifiez-vous aujourd\'hui ?' },
      {
        id: 'recontact', type: 'radio',
        q: 'Souhaitez-vous être recontacté(e) pour un accompagnement complémentaire ?',
        options: ['Oui', 'Non'],
      },
    ],
  },
];

export const SECTIONS: Record<EvaluationType, Section[]> = { chaud: CHAUD, froid: FROID };

export const reponsesVides = (): Reponses => ({ version: 1, champs: {}, valeurs: {} });

const toutesQuestions = (type: EvaluationType) => SECTIONS[type].flatMap((s) => s.questions);

const remplie = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim() !== '';

/** Part (%) des questions obligatoires renseignées — pour la barre de progression. */
export function progression(type: EvaluationType, r: Reponses): number {
  const req = toutesQuestions(type).filter((q) => q.req);
  const champs = CHAMPS.filter((c) => c.req);
  const total = req.length + champs.length;
  const faits = req.filter((q) => remplie(r.valeurs[q.id])).length
    + champs.filter((c) => (r.champs[c.id] ?? '').trim()).length;
  return total ? Math.round((faits / total) * 100) : 0;
}

/** Libellés des questions obligatoires restées sans réponse. */
export function questionsManquantes(type: EvaluationType, r: Reponses): string[] {
  return toutesQuestions(type).filter((q) => q.req && !remplie(r.valeurs[q.id])).map((q) => q.q);
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return typeof v === 'string' && v !== '' && !Number.isNaN(n) ? n : null;
};

export function noter(type: EvaluationType, r: Reponses): Note {
  // L'auto-évaluation avant / après mesure une progression, pas une
  // satisfaction : elle n'entre pas dans la moyenne.
  const horsMoyenne = new Set(['niveau_avant', 'niveau_apres']);
  const echelles = toutesQuestions(type)
    .filter((q) => q.type === 'scale' && !horsMoyenne.has(q.id))
    .map((q) => num(r.valeurs[q.id]))
    .filter((n): n is number => n != null);
  const note = echelles.length
    ? Math.round((echelles.reduce((a, b) => a + b, 0) / echelles.length) * 10) / 10
    : null;
  const avant = num(r.valeurs.niveau_avant);
  const apres = num(r.valeurs.niveau_apres);
  return {
    note,
    pct: note != null ? Math.round(((note - 1) / 4) * 100) : null,
    nps: num(r.valeurs.nps),
    progression: avant != null && apres != null ? apres - avant : null,
  };
}

export function appreciation(note: number | null): string {
  if (note == null) return '—';
  if (note >= 4.5) return 'Très satisfaisant';
  if (note >= 3.5) return 'Satisfaisant';
  if (note >= 2.5) return 'Mitigé';
  return 'Insatisfaisant';
}

/** Restitution texte de l'évaluation — c'est la pièce versée au dossier. */
export function construireSynthese(
  type: EvaluationType, r: Reponses, n: Note,
  opts?: { origine?: 'apprenant' | 'formateur'; auteur?: string },
): string {
  const l: string[] = [];
  l.push(`${type === 'chaud' ? 'ÉVALUATION À CHAUD' : 'ÉVALUATION À FROID (J+30)'} — ${r.champs.formation || 'Formation'}`);
  l.push('');
  l.push(`Apprenant : ${r.champs.nom || '—'}${r.champs.poste ? ` — ${r.champs.poste}` : ''}`);
  if (r.champs.orga) l.push(`Organisation : ${r.champs.orga}`);
  if (r.champs.email) l.push(`Email : ${r.champs.email}`);
  l.push(`Date : ${new Date().toLocaleDateString('fr-FR')}`);
  if (opts?.origine === 'formateur') {
    l.push(`Saisie par l'organisme${opts.auteur ? ` (${opts.auteur})` : ''} — l'apprenant n'a pas répondu lui-même.`);
  }
  l.push('');
  l.push(`Note moyenne : ${n.note != null ? `${n.note.toLocaleString('fr-FR')} / 5 — ${appreciation(n.note)}` : '—'}`);
  if (n.nps != null) l.push(`Recommandation : ${n.nps} / 10`);
  if (n.progression != null) {
    l.push(`Auto-évaluation : ${r.valeurs.niveau_avant} / 5 avant → ${r.valeurs.niveau_apres} / 5 après (${n.progression >= 0 ? '+' : ''}${n.progression})`);
  }

  for (const s of SECTIONS[type]) {
    l.push('');
    l.push(s.titre.toUpperCase());
    for (const q of s.questions) {
      const v = r.valeurs[q.id];
      if (!remplie(v)) continue;
      if (q.type === 'scale') l.push(`- ${q.q} : ${v} / 5`);
      else if (q.type === 'nps') l.push(`- ${q.q} : ${v} / 10`);
      else if (q.type === 'check') l.push(`- ${q.q} : ${(v as string[]).join(', ')}`);
      else if (q.type === 'textarea') l.push(`- ${q.q} :\n  ${String(v).trim().replace(/\n/g, '\n  ')}`);
      else l.push(`- ${q.q} : ${v}`);
    }
  }
  return l.join('\n');
}

/** Échéance J+30 (AAAA-MM-JJ) depuis une date de fin de formation. */
export function echeanceFroid(dateFin: string | null | undefined): string | null {
  if (!dateFin) return null;
  const d = new Date(`${dateFin.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + DELAI_FROID_JOURS);
  return d.toISOString().slice(0, 10);
}

/** Corps du mail d'invitation (texte : c'est lui que la Messagerie affiche). */
export function messageInvitation(type: EvaluationType, nom: string | null, url: string, relance = false) {
  const intro = type === 'chaud'
    ? `${relance ? 'Petit rappel : merci' : 'Merci'} d'avoir participé à la formation. Pourriez-vous prendre 5 minutes pour nous dire ce que vous en avez pensé ? Vos réponses nous servent directement à améliorer nos formations.`
    : `${relance ? 'Petit rappel : il y a' : 'Il y a'} environ un mois, vous suiviez votre formation. Où en êtes-vous ? Ce court questionnaire (5 minutes) nous permet de mesurer ce que la formation vous a réellement apporté au quotidien.`;
  const bouton = type === 'chaud' ? 'Donner mon avis' : 'Répondre au questionnaire';
  const texte = [`Bonjour ${nom ?? ''},`, '', intro, '', `${bouton} : ${url}`, '', 'Merci,', "L'équipe Aissociate"].join('\n');
  const html = `
    <p>Bonjour ${nom ?? ''},</p>
    <p>${intro}</p>
    <p><a href="${url}" style="background:#ea6a1e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${bouton}</a></p>
    <p>Ou copiez ce lien : ${url}</p>
    <p>Merci,<br/>L'équipe Aissociate</p>`;
  return { texte, html };
}
