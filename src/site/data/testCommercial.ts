/**
 * Test commercial des candidats partenaires (/affiliation/test).
 * Repris du test HTML autonome « Test commercial – Agents IA », aligné sur l'offre actuelle :
 * 30 % du montant encaissé la 1re année puis 10 % tant que le client reste abonné ; stage gratuit au lieu de l'essai de 7 jours.
 * La note n'est jamais montrée au candidat : elle part dans le CRM avec ses réponses.
 */

export const COMPS = {
  PROSP: 'Prospection & prise de RDV', DECOUV: 'Découverte & qualification', ARGU: 'Argumentation valeur',
  OBJ: 'Traitement des objections', CLOSE: 'Closing & suivi', ETH: 'Éthique & posture',
  CALC: 'Calcul & modèle économique', PROFIL: 'Profil & disponibilité',
} as const;
export type Comp = keyof typeof COMPS;

export const SEUIL_CONVOQUER = 70;
export const SEUIL_ETUDIER = 55;

type Option = { k: string; t: string; p: number; ko?: string };
export type QProfil = { k: string; q: string; opts: Option[] };
export type QSjt = { id: string; c: Comp; q: string; o: Option[] };
export type QCalc = { id: string; q: string; unit: string; a: number; tol: number };
export type QOpen = { id: string; q: string; min: number };

export const PROFIL: QProfil[] = [
  { k: 'statut', q: 'Votre statut pour exercer en indépendant', opts: [
    { k: 'a', t: 'Je suis déjà indépendant (micro-entreprise, agent commercial, société)', p: 5 },
    { k: 'b', t: 'Je peux créer mon statut sous 15 jours', p: 4 },
    { k: 'c', t: 'Je cherche un contrat salarié', p: 0, ko: 'Ne souhaite pas exercer en indépendant' }] },
  { k: 'commission', q: 'La rémunération est uniquement à la commission. Est-ce compatible avec votre situation ?', opts: [
    { k: 'a', t: 'Oui, c’est ce que je recherche', p: 5 },
    { k: 'b', t: 'Oui, en complément d’une autre activité', p: 4 },
    { k: 'c', t: 'Non, j’ai besoin d’un fixe', p: 0, ko: 'Refuse la rémunération à la commission' }] },
  { k: 'dispo', q: 'Temps que vous pouvez consacrer à la mission chaque semaine', opts: [
    { k: 'a', t: 'Moins de 10 h', p: 0, ko: 'Disponibilité inférieure à 10 h/semaine' },
    { k: 'b', t: '10 à 20 h', p: 3 }, { k: 'c', t: '20 à 35 h', p: 5 }, { k: 'd', t: 'Plus de 35 h', p: 5 }] },
  { k: 'b2b', q: 'Votre expérience de la vente aux entreprises (B2B)', opts: [
    { k: 'a', t: 'Aucune', p: 0 }, { k: 'b', t: 'Moins de 2 ans', p: 2 }, { k: 'c', t: '2 à 5 ans', p: 4 }, { k: 'd', t: 'Plus de 5 ans', p: 5 }] },
  { k: 'prosp', q: 'Votre pratique de la prospection (téléphone, terrain)', opts: [
    { k: 'a', t: 'Jamais pratiquée', p: 0 }, { k: 'b', t: 'Occasionnelle', p: 2 }, { k: 'c', t: 'Régulière', p: 4 }, { k: 'd', t: 'C’était le cœur de mon métier', p: 5 }] },
  { k: 'reunion', q: 'Votre connaissance du tissu économique réunionnais', opts: [
    { k: 'a', t: 'Faible', p: 0 }, { k: 'b', t: 'Correcte', p: 1 }, { k: 'c', t: 'Bonne, j’ai un réseau', p: 2 }, { k: 'd', t: 'Très bonne, je connais de nombreux dirigeants', p: 3 }] },
  { k: 'creole', q: 'Créole réunionnais', opts: [
    { k: 'a', t: 'Je le parle', p: 2 }, { k: 'b', t: 'Je le comprends', p: 1 }, { k: 'c', t: 'Non', p: 0 }] },
  { k: 'num', q: 'Votre aisance avec les outils numériques et l’IA', opts: [
    { k: 'a', t: 'Débutant', p: 0 }, { k: 'b', t: 'À l’aise', p: 1 }, { k: 'c', t: 'J’utilise l’IA au quotidien', p: 2 }] },
  { k: 'equip', q: 'Votre équipement', opts: [
    { k: 'a', t: 'Ordinateur, téléphone et connexion fiable', p: 0 },
    { k: 'b', t: 'Il me manque l’un des trois', p: 0, ko: 'Équipement de travail incomplet' }] },
];
const PROFIL_MAX = 32;

export const SJT: QSjt[] = [
  { id: 's1', c: 'PROSP', q: 'Vous appelez un fichier de 40 restaurants à Saint-Denis. Au 12ᵉ appel, vous n’avez essuyé que des refus secs.', o: [
    { k: 'a', t: 'J’arrête la session : douze refus d’affilée, c’est le signe que le fichier est mal ciblé, et je le signale.', p: 0 },
    { k: 'b', t: 'Je finis le fichier en notant le motif de chaque refus, puis je retravaille mon accroche avant la session suivante.', p: 3 },
    { k: 'c', t: 'Je bascule sur un secteur que je connais mieux pour reprendre confiance, et je reviendrai aux restaurants ensuite.', p: 1 },
    { k: 'd', t: 'Je continue au même rythme sans rien modifier : à ce stade, c’est la loi des grands nombres qui joue.', p: 1 }] },
  { id: 's2', c: 'PROSP', q: 'Le standard vous répond : « Le gérant n’est pas disponible. C’est à quel sujet ? »', o: [
    { k: 'a', t: '« C’est personnel, je rappellerai. » La standardiste n’a pas à filtrer, autant ne pas lui donner de prise.', p: 0 },
    { k: 'b', t: 'Je lui présente l’offre en détail : si elle est convaincue, elle saura la défendre auprès de son patron.', p: 1 },
    { k: 'c', t: '« [Prénom], d’Aissociate. C’est au sujet du temps passé sur les devis. Quand puis-je le joindre ? »', p: 3 },
    { k: 'd', t: 'Je lui demande le portable du gérant pour le joindre en direct, en promettant que ce sera très court.', p: 1 }] },
  { id: 's3', c: 'DECOUV', q: 'Premier rendez-vous avec la gérante d’une agence immobilière à Saint-Paul. Quelle est votre priorité ?', o: [
    { k: 'a', t: 'Lancer une démonstration en direct : rien ne convainc mieux qu’un agent qui répond sous ses yeux.', p: 1 },
    { k: 'b', t: 'Lui demander où son équipe perd du temps chaque semaine, sur quelles tâches, et combien d’heures cela représente.', p: 3 },
    { k: 'c', t: 'Aborder les conditions tarifaires d’emblée, pour vérifier le budget avant d’investir une heure.', p: 0 },
    { k: 'd', t: 'Lui expliquer le fonctionnement des modèles d’IA, pour qu’elle sache ce qu’elle achète et ait confiance.', p: 0 }] },
  { id: 's4', c: 'DECOUV', q: 'Le prospect vous dit : « On manque de temps pour tout. »', o: [
    { k: 'a', t: '« C’est exactement le problème que notre agent résout : il travaille pour vous jour et nuit. »', p: 1 },
    { k: 'b', t: '« Sur quelles tâches, précisément ? Et combien d’heures par semaine cela vous prend-il, à peu près ? »', p: 3 },
    { k: 'c', t: '« Je vous comprends, c’est le quotidien de tous les dirigeants de TPE : vous n’êtes pas le seul. »', p: 1 },
    { k: 'd', t: '« Avez-vous pensé à recruter un assistant ? Je peux vous montrer pourquoi notre solution est plus souple. »', p: 1 }] },
  { id: 's5', c: 'ARGU', q: 'Comment présentez-vous un « employé virtuel IA » à un plombier qui emploie 4 salariés ?', o: [
    { k: 'a', t: '« Un modèle de langage relié à vos outils par API, qui automatise vos flux administratifs. »', p: 0 },
    { k: 'b', t: '« Un assistant qui prépare vos devis et relance vos clients pendant que vous êtes sur les chantiers. »', p: 3 },
    { k: 'c', t: '« La technologie de ChatGPT, mais configurée pour votre entreprise et vos propres documents. »', p: 1 },
    { k: 'd', t: '« L’avenir de l’artisanat : d’ici deux ans, ceux qui ne s’y seront pas mis seront dépassés. »', p: 0 }] },
  { id: 's6', c: 'ARGU', q: 'Le client hésite sur le prix du contrat.', o: [
    { k: 'a', t: 'Je chiffre avec lui ce que lui coûtent aujourd’hui les devis perdus et les relances oubliées.', p: 3 },
    { k: 'b', t: 'Je lui accorde une remise de ma propre initiative, pour ne pas laisser filer une vente presque faite.', p: 0 },
    { k: 'c', t: 'Je lui explique que nos tarifs sont alignés sur le marché et qu’il ne trouvera pas moins cher.', p: 0 },
    { k: 'd', t: 'Je lui propose de commencer en stage gratuit, sans carte bancaire, pour qu’il constate le gain avant de payer.', p: 2 }] },
  { id: 's7', c: 'OBJ', q: '« L’IA va remplacer mes salariés, je ne veux pas de ça chez moi. »', o: [
    { k: 'a', t: '« Rassurez-vous : l’IA reste un gadget, elle ne peut pas faire le travail d’un vrai salarié. »', p: 0 },
    { k: 'b', t: '« Je comprends. Quelles tâches vos équipes aiment le moins ? C’est celles-là que l’agent reprend. »', p: 3 },
    { k: 'c', t: '« C’est un mouvement inévitable : autant en profiter le premier plutôt que de le subir après les autres. »', p: 0 },
    { k: 'd', t: '« Au contraire : vous pourrez ne pas remplacer le prochain départ et alléger vos charges. »', p: 0 }] },
  { id: 's8', c: 'OBJ', q: '« Envoyez-moi une documentation par mail. »', o: [
    { k: 'a', t: 'Je l’envoie aussitôt et je le laisse revenir vers moi : insister risquerait de griller le contact.', p: 0 },
    { k: 'b', t: '« Volontiers. Qu’est-ce qui vous prend le plus de temps ? On en parle 15 minutes jeudi ? »', p: 3 },
    { k: 'c', t: 'J’insiste poliment pour fixer un rendez-vous tout de suite : une plaquette envoyée n’est jamais lue.', p: 1 },
    { k: 'd', t: 'J’envoie la plaquette le jour même et je note une relance téléphonique à J+7 dans mon agenda.', p: 2 }] },
  { id: 's9', c: 'OBJ', q: '« J’ai déjà essayé ChatGPT, ça ne marche pas pour mon métier. »', o: [
    { k: 'a', t: '« Vous l’avez sans doute mal paramétré : c’est fréquent, peu de gens savent écrire de bons prompts. »', p: 0 },
    { k: 'b', t: '« Qu’avez-vous essayé de lui faire faire ? » Puis je compare avec un agent réglé sur ses documents.', p: 3 },
    { k: 'c', t: '« Notre outil n’a rien à voir avec ChatGPT : c’est une solution professionnelle, pas un gadget. »', p: 1 },
    { k: 'd', t: 'Je n’insiste pas : un prospect déçu par l’IA est rarement récupérable, mieux vaut passer au suivant.', p: 0 }] },
  { id: 's10', c: 'CLOSE', q: 'Fin d’un bon rendez-vous. Le prospect : « C’est intéressant, je vais réfléchir. »', o: [
    { k: 'a', t: '« Très bien, prenez le temps qu’il faut, je reste disponible pour la moindre question. »', p: 0 },
    { k: 'b', t: '« Qu’est-ce qui vous fait hésiter ? » Puis je propose de démarrer en stage gratuit, avec un point fixé dans 7 jours.', p: 3 },
    { k: 'c', t: '« Si vous signez aujourd’hui, je peux obtenir un geste commercial, mais seulement aujourd’hui. »', p: 1 },
    { k: 'd', t: 'Je le rappelle chaque jour de la semaine pour rester présent dans son esprit au moment où il décidera.', p: 0 }] },
  { id: 's11', c: 'CLOSE', q: 'Vous avez 25 prospects intéressés que vous n’avez pas relancés depuis deux semaines.', o: [
    { k: 'a', t: 'Je relance d’abord ceux avec qui le courant est le mieux passé : ce sont eux qui signeront vite.', p: 0 },
    { k: 'b', t: 'Je les trie par niveau d’intérêt, je fixe une action datée pour chacun et je commence demain matin.', p: 3 },
    { k: 'c', t: 'Je leur envoie à tous le même e-mail de relance soigné, pour gagner du temps et toucher tout le monde.', p: 1 },
    { k: 'd', t: 'Je les laisse venir : un prospect vraiment intéressé finit toujours par rappeler de lui-même.', p: 0 }] },
  { id: 's12', c: 'ETH', q: 'Un prospect demande si l’agent IA peut garantir zéro erreur dans ses devis.', o: [
    { k: 'a', t: '« Oui, c’est l’avantage d’une machine : contrairement à un humain, elle ne se fatigue pas. »', p: 0 },
    { k: 'b', t: '« Non. Il réduit nettement les erreurs, et vous gardez toujours la main sur la validation. »', p: 3 },
    { k: 'c', t: '« Je ne suis pas technicien : je me renseigne auprès de l’équipe et je vous rappelle avec une réponse. »', p: 1 },
    { k: 'd', t: 'Je recentre sur le temps gagné, qui est le vrai bénéfice, sans entrer dans ce débat technique.', p: 0 }] },
  { id: 's13', c: 'ETH', q: 'Un concurrent a dénigré Aissociate auprès de votre prospect.', o: [
    { k: 'a', t: 'Je rétablis l’équilibre en signalant à mon tour les faiblesses connues de ce concurrent.', p: 0 },
    { k: 'b', t: 'Je reste factuel sur notre offre et je propose le stage gratuit, pour qu’il juge sur pièce.', p: 3 },
    { k: 'c', t: 'Je baisse mon prix sans rien dire, pour que la comparaison tourne en notre faveur.', p: 0 },
    { k: 'd', t: 'Je lui demande ce qui lui a été dit, puis je réponds point par point, preuves à l’appui.', p: 2 }] },
  { id: 's14', c: 'PROSP', q: 'En indépendant, vous traversez une semaine sans motivation.', o: [
    { k: 'a', t: 'J’en profite pour me former et préparer mes fichiers : prospecter sans énergie donne de mauvais appels.', p: 1 },
    { k: 'b', t: 'Je tiens mes créneaux de prospection et mon objectif d’appels quotidien, quoi qu’il arrive : la motivation suit l’action.', p: 3 },
    { k: 'c', t: 'Je demande à Aissociate de me fixer des horaires et un cadre, pour me remettre dans le rythme.', p: 1 },
    { k: 'd', t: 'Je me concentre sur les rendez-vous qu’on me transmet, en attendant que l’envie revienne.', p: 0 }] },
];

export const CALC: QCalc[] = [
  { id: 'c1', q: 'Exemple fictif : un client a un contrat à 150 € HT par mois. Quelle commission totale touchez-vous sur ses deux premières années (30 % la 1re année, puis 10 %) ?', unit: '€', a: 720, tol: 0.5 },
  { id: 'c2', q: 'Vous signez 15 % des rendez-vous que vous menez. Combien de rendez-vous vous faut-il pour 9 signatures dans le mois ?', unit: 'RDV', a: 60, tol: 0 },
  { id: 'c3', q: 'Exemple fictif : vous signez 10 clients chaque mois, contrat moyen de 150 € HT/mois, tous restent abonnés. Quelle commission percevez-vous au titre du 4ᵉ mois (30 % des contrats des clients signés les mois 1 à 4) ?', unit: '€', a: 1800, tol: 0.5 },
  { id: 'c4', q: 'Vous passez 50 appels par jour. Un appel sur 10 aboutit à un rendez-vous et 15 % des rendez-vous signent. Combien de signatures obtenez-vous en 20 jours ouvrés ?', unit: 'signatures', a: 15, tol: 0 },
];

export const OPEN: QOpen[] = [
  { id: 'o1', q: 'Pitch téléphonique de 30 secondes : vous appelez le gérant d’un garage automobile à Saint-Pierre que vous ne connaissez pas. Écrivez mot pour mot ce que vous dites.', min: 150 },
  { id: 'o2', q: 'Le prospect vous répond : « L’IA, c’est pour les grosses boîtes. Nous, on est trois. » Écrivez votre réponse.', min: 120 },
  { id: 'o3', q: 'Décrivez votre semaine type de prospection : créneaux, nombre d’appels visé, façon de suivre vos prospects.', min: 120 },
  { id: 'o4', q: 'Pourquoi cette mission en indépendant vous intéresse-t-elle ? Quel revenu mensuel visez-vous à 6 mois, et que ferez-vous pour l’atteindre ?', min: 120 },
  { id: 'o5', q: 'Votre réseau : quels secteurs ou quelles entreprises réunionnaises pouvez-vous approcher rapidement ? (facultatif)', min: 0 },
];

export const PROBES: Record<Comp, string> = {
  PROSP: 'Jeu de rôle : appel à froid de 2 minutes, standard compris. Combien d’appels par jour tient-il réellement ?',
  DECOUV: 'Demandez-lui les 5 questions qu’il pose en premier rendez-vous ; vérifiez qu’il quantifie le temps perdu.',
  ARGU: 'Faites-lui présenter l’offre à un boulanger en 3 phrases, sans jargon.',
  OBJ: 'Enchaînez trois objections (« trop cher », « pas le temps », « l’IA remplace mes salariés ») et observez s’il questionne avant de répondre.',
  CLOSE: 'Demandez comment il obtient un engagement daté et quel outil il utilise pour ses relances.',
  ETH: 'Testez ce qu’il promettrait pour signer : délai, résultats garantis, remises.',
  CALC: 'Refaites un calcul de commission à voix haute : comprend-il le récurrent ?',
  PROFIL: 'Vérifiez statut, disponibilité réelle et expérience vérifiable (références).',
};

export type Reponses = {
  identite: Record<string, string>;
  profil: Record<string, string>;
  sjt: Record<string, string>;
  calc: Record<string, string>;
  open: Record<string, string>;
  debut?: number;
  fin?: number;
};

export function parseNombre(s: string | undefined): number {
  if (s == null) return NaN;
  const t = String(s).replace(/[\s  €]/g, '').replace(/[a-zA-Zéè]/g, '').replace(',', '.');
  return t === '' ? NaN : parseFloat(t);
}

export function duree(ms: number) {
  const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60;
  return `${m} min ${String(s).padStart(2, '0')} s`;
}

/** Barème d'origine : situations 55 pts, calculs 15, profil 30 ; tout critère bloquant écarte le dossier. */
export function noter(d: Reponses) {
  const ko: string[] = [];
  let pp = 0;
  PROFIL.forEach((p) => { const o = p.opts.find((x) => x.k === d.profil[p.k]); if (o) { pp += o.p; if (o.ko) ko.push(o.ko); } });
  const comp = Object.fromEntries(Object.keys(COMPS).map((k) => [k, { got: 0, max: 0 }])) as Record<Comp, { got: number; max: number }>;
  let sr = 0;
  const sjtDet = SJT.map((q) => {
    const o = q.o.find((x) => x.k === d.sjt[q.id]);
    const p = o ? o.p : 0;
    sr += p; comp[q.c].got += p; comp[q.c].max += 3;
    const best = q.o.reduce((a, b) => (b.p > a.p ? b : a));
    return { q, o, p, best };
  });
  let cr = 0;
  const calcDet = CALC.map((c) => { const v = parseNombre(d.calc[c.id]); const ok = !isNaN(v) && Math.abs(v - c.a) <= c.tol; if (ok) cr++; return { c, v: d.calc[c.id], ok }; });
  comp.CALC = { got: cr, max: CALC.length };
  comp.PROFIL = { got: pp, max: PROFIL_MAX };
  const sjtS = (sr / (SJT.length * 3)) * 55, calcS = (cr / CALC.length) * 15, profS = (Math.min(pp, PROFIL_MAX) / PROFIL_MAX) * 30;
  const global = Math.round(sjtS + calcS + profS);
  const verdict = ko.length ? 'Non éligible (critère bloquant)'
    : global >= SEUIL_CONVOQUER ? 'À convoquer en entretien'
    : global >= SEUIL_ETUDIER ? 'À étudier' : 'Non retenu';
  const pct = Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, v.max ? Math.round((v.got / v.max) * 100) : 0])) as Record<Comp, number>;
  const faibles = (Object.entries(pct) as [Comp, number][]).filter(([k]) => k !== 'PROFIL').sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k]) => k);
  return { global, verdict, ko, pct, sjtDet, calcDet, faibles, parts: { sjt: Math.round(sjtS), calc: Math.round(calcS), prof: Math.round(profS) } };
}

/** Rapport en texte, lisible tel quel dans la fiche du prospect du CRM. */
export function rapportCRM(d: Reponses) {
  const s = noter(d);
  const I = d.identite;
  const l: string[] = [];
  l.push(`TEST COMMERCIAL (programme partenaires) — ${s.global}/100 — ${s.verdict}`);
  l.push(`Situations ${s.parts.sjt}/55 · Calculs ${s.parts.calc}/15 · Profil ${s.parts.prof}/30`
    + (d.debut && d.fin ? ` · Durée ${duree(d.fin - d.debut)}${d.fin - d.debut < 8 * 60000 ? ' (très rapide)' : ''}` : ''));
  if (s.ko.length) l.push(`Critères bloquants : ${s.ko.join(' ; ')}`);
  l.push(`Commune : ${I.commune || '—'}${I.linkedin ? ` · LinkedIn : ${I.linkedin}` : ''}`);
  l.push('', 'COMPÉTENCES');
  (Object.keys(COMPS) as Comp[]).forEach((k) => l.push(`- ${COMPS[k]} : ${s.pct[k]} %`));
  l.push('', 'À CREUSER EN ENTRETIEN');
  s.faibles.forEach((k) => l.push(`- ${COMPS[k]} : ${PROBES[k]}`));
  l.push('', 'RÉPONSES ÉCRITES');
  OPEN.forEach((o, i) => l.push(`${i + 1}. ${o.q}`, `   → ${(d.open[o.id] || '—').trim()}`));
  l.push('', 'MISES EN SITUATION');
  s.sjtDet.forEach((x, i) => {
    l.push(`${i + 1}. [${COMPS[x.q.c]}] ${x.p}/3 — ${x.o ? x.o.t : '—'}`);
    if (x.p < 3) l.push(`   Attendu : ${x.best.t}`);
  });
  l.push('', 'CALCULS');
  s.calcDet.forEach((x, i) => l.push(`${i + 1}. ${x.v || '—'} ${x.ok ? '✓' : '✗'} (attendu ${x.c.a.toLocaleString('fr-FR')} ${x.c.unit})`));
  l.push('', 'PROFIL DÉCLARÉ');
  PROFIL.forEach((p) => { const o = p.opts.find((x) => x.k === d.profil[p.k]); l.push(`- ${p.q} : ${o ? o.t : '—'} (${o ? o.p : 0} pt)`); });
  return { texte: l.join('\n'), score: s };
}
