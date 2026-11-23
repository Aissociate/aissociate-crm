import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight, BadgeCheck, CalendarCheck, Check, ChevronDown, Clock, FileText, Lock, MessageSquare,
  ShieldCheck, Sparkles, Users, X, Zap,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO, { SITE_URL } from '../components/SEO';
import { supabase } from '@/lib/supabase';
import { APPLICATIONS_UN_CLIC, logoConnecteur } from '@/lib/tarifConnecteurs';
import { bulletin, COMPTEURS, CONTRATS, INTEGRATION_HT, INTERRUPTEURS, normaliser, type ContratId } from '../../../supabase/functions/studio/contrats';
import SamDemo from '../components/SamDemo';

/**
 * Page d'accueil du site (/) : page de vente « Studio IA » : l'équipe d'agents IA d'Aissociate.
 * Structure en tunnel (accroche → histoire → mécanisme → équipe → preuve →
 * offre empilée → garantie → pour qui → FAQ → appel à l'action + P.-S.).
 * Le formulaire envoie au CRM comme les autres formulaires du site
 * (contact_requests → prospect via le trigger lead_to_contact).
 *
 * ⚠ Les montants viennent de la grille des contrats du Studio
 * (supabase/functions/studio/contrats.ts, la même que la facturation) ; les
 * reprendre aussi dans scripts/prerender.mjs (balises SEO et données structurées)
 * et dans le prompt de Sam (supabase/functions/studio-demo).
 */

// ── L'offre ─────────────────────────────────────────────────────────────────
const PAYANTS = CONTRATS.filter((c) => c.prix > 0);
const PRIX_MIN = PAYANTS[0].prix;
const eur = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
const LIEN_ESSAI = '/studio/demarrer?depuis=agents-ia';
const prixAvenant = (id: string) => [...COMPTEURS, ...INTERRUPTEURS].find((a) => a.id === id)!.prix;

// ── L'équipe (miroir du catalogue du Studio : super-pouvoirs réels) ─────────
type Agent = {
  id: string; prenom: string; metier: string; couleur: string; accroche: string;
  pouvoirs: string[]; cas: { titre: string; texte: string }[]; minutes: number;
};
const AGENTS: Agent[] = [
  {
    id: 'lea', prenom: 'Léa', metier: 'Assistante générale', couleur: '#ea6a1e', minutes: 20,
    accroche: 'Votre bras droit pour tout ce qui encombre la journée.',
    pouvoirs: ['Rédiger un e-mail au bon ton', 'Synthétiser un document en 5 points et des actions', 'Organiser votre semaine (urgent / important)'],
    cas: [
      { titre: 'Le contrat de 30 pages', texte: 'Vous le collez, Léa en sort l\'essentiel, les échéances et ce qu\'il faut négocier.' },
      { titre: 'Le lundi matin', texte: 'Vous videz votre tête en vrac ; elle vous rend un planning jour par jour.' },
    ],
  },
  {
    id: 'hugo', prenom: 'Hugo', metier: 'Marketing & réseaux sociaux', couleur: '#ec4899', minutes: 30,
    accroche: 'Vos réseaux tenus, sans y passer vos soirées.',
    pouvoirs: ['Générer un post (Facebook, Instagram, LinkedIn), 3 variantes notées', 'Construire le calendrier éditorial du mois', 'Créer un visuel par IA, prêt à publier', 'Créer une courte vidéo pour les réseaux'],
    cas: [
      { titre: 'Le mois de décembre', texte: 'Un calendrier de 12 publications calé sur vos événements, vos prix et votre ton.' },
      { titre: 'L\'idée du jour', texte: 'Une phrase de vous, un post et son visuel en retour, en quelques minutes.' },
    ],
  },
  {
    id: 'sam', prenom: 'Sam', metier: 'Commercial & prospection', couleur: '#3b82f6', minutes: 25,
    accroche: 'La prospection que vous repoussez depuis trois mois.',
    pouvoirs: ['Séquence de prospection en 3 messages (LinkedIn ou e-mail)', 'Script d\'appel : découverte, objections, closing', 'Trois réponses à une objection client'],
    cas: [
      { titre: '« C\'est trop cher »', texte: 'Trois réponses prêtes, de la plus douce à la plus directe, adaptées à votre offre.' },
      { titre: 'Les comités d\'entreprise', texte: 'Une séquence personnalisée pour décrocher les commandes groupées.' },
    ],
  },
  {
    id: 'ines', prenom: 'Inès', metier: 'SEO & contenus web', couleur: '#10b981', minutes: 45,
    accroche: 'Être trouvé sur Google par ceux qui vous cherchent déjà.',
    pouvoirs: ['Article de blog optimisé (title, meta, FAQ)', '20 idées de mots-clés classées par intention', 'Audit d\'une page et réécriture du title et du H1'],
    cas: [
      { titre: 'Le blog en friche', texte: 'Un article solide par semaine, structuré pour Google et pour vos clients.' },
      { titre: 'La page qui ne convertit pas', texte: 'Une note sur 10, cinq corrections prioritaires et les textes réécrits.' },
    ],
  },
  {
    id: 'mael', prenom: 'Maël', metier: 'Administratif & juridique', couleur: '#8b5cf6', minutes: 40,
    accroche: 'Les documents qu\'on ne fait jamais, enfin faits.',
    pouvoirs: ['Modèle de CGV adapté à votre activité', 'Relance d\'impayé : de l\'amiable à la mise en demeure', 'Check-list RGPD priorisée'],
    cas: [
      { titre: 'La facture de 90 jours', texte: 'Le bon courrier au bon niveau de fermeté, pénalités légales comprises.' },
      { titre: 'Le site sans CGV', texte: 'Un modèle complet, à faire valider par votre conseil pour les enjeux importants.' },
    ],
  },
  {
    id: 'nora', prenom: 'Nora', metier: 'RH & formation', couleur: '#eab308', minutes: 30,
    accroche: 'Recruter, intégrer, faire grandir votre équipe.',
    pouvoirs: ['Annonce de recrutement attractive et non discriminante', 'Grille d\'entretien (méthode STAR)', 'Financer une formation : FAF, OPCO, CPF'],
    cas: [
      { titre: 'Le poste qui ne trouve personne', texte: 'Une annonce qui parle aux bons candidats, et la grille pour les départager.' },
      { titre: 'Monter en compétences', texte: 'Les financements mobilisables pour vous ou vos salariés, et le plan d\'action.' },
    ],
  },
  {
    id: 'theo', prenom: 'Théo', metier: 'Comptabilité & gestion', couleur: '#0891b2', minutes: 30,
    accroche: 'Vos chiffres à jour, sans y passer vos soirées.',
    pouvoirs: ['Facture ou devis conforme, TVA DOM comprise', 'Prévisionnel de trésorerie mois par mois', 'Prix de revient, marge et seuil de rentabilité'],
    cas: [
      { titre: 'Le mois qui coince', texte: 'Le prévisionnel qui montre le creux de trésorerie avant qu\'il arrive, et les actions pour l\'éviter.' },
      { titre: 'La boîte à chaussures', texte: 'Les dépenses classées par compte, prêtes pour votre expert-comptable, justificatifs manquants signalés.' },
    ],
  },
];

const faqAgents = () => [
  { question: 'Est-ce un chatbot de plus ?', answer: "Non. Chaque agent est un spécialiste avec des missions cadrées (ses « super-pouvoirs »). Il connaît votre entreprise : votre fiche, vos tarifs, votre charte, les contenus que vous avez déjà validés. Si une demande sort de son métier, il ne bricole pas : il la confie au bon collègue." },
  { question: 'Combien ça coûte vraiment ?', answer: `Vos agents commencent en stage, gratuitement et sans limite de durée (10 h de travail par mois, sans accès à vos outils). Ensuite, vous choisissez un contrat : ${PAYANTS.map((c) => `${c.nom} à ${eur(c.prix)}`).join(', ')} HT par mois, agents illimités. Vous ne payez que les heures de travail et les accès à vos outils dont ils ont besoin. En CDD, sans engagement ; en CDI annuel, deux mois offerts.` },
  { question: 'Puis-je essayer avant de payer ?', answer: "Oui : tout commence par un stage gratuit, sans carte bancaire et sans limite de durée. Vous décrivez votre entreprise en 10 minutes, votre espace s'ouvre aussitôt et vos identifiants arrivent par e-mail. Vous signez un contrat seulement quand vous voulez plus d'heures ou brancher vos outils : rien n'est facturé automatiquement." },
  { question: 'Les connecteurs sont-ils compris ?', answer: `Chaque outil relié (messagerie, agenda, réseau social, logiciel…) utilise un badge d'accès. Les contrats en comprennent : ${PAYANTS.map((c) => `${c.badges} en ${c.nom.toLowerCase()}`).join(', ')}. Un badge de plus coûte ${eur(prixAvenant('badges'))} HT par mois. Le stage n'en comprend pas.` },
  { question: 'En combien de temps est-ce opérationnel ?', answer: `Vos agents répondent dès l'ouverture de votre espace, avec ce que vous avez décrit dans le questionnaire. Si vous voulez aller plus vite, un formateur installe vos agents et forme votre équipe en une demi-journée (parcours d'intégration à ${eur(INTEGRATION_HT)} HT, finançable par votre OPCO).` },
  { question: 'Les agents envoient-ils des messages à ma place ?', answer: "Ils préparent, vous validez. Rien ne part vers vos clients sans votre accord. Les connecteurs (Google Workspace, Outlook, Facebook, Instagram, LinkedIn, TikTok…) permettent de préparer du contenu directement adapté à vos outils." },
  { question: 'Et mes données ?', answer: "Votre espace est cloisonné : vos données ne sont visibles que de vous et de votre équipe. Hébergement en Union européenne, mots de passe et secrets chiffrés, conformité RGPD." },
];

const PAS_A_PAS = [
  { j: 'Aujourd\'hui', t: 'Le stage', d: 'Questionnaire de 10 minutes : votre espace s\'ouvre, vos agents travaillent gratuitement 10 h par mois.' },
  { j: 'Quand vous voulez', t: 'Le contrat', d: 'Plus d\'heures, des badges d\'accès à vos outils, des responsables : vous choisissez, sans engagement en CDD.' },
  { j: 'En option', t: 'Le parcours d\'intégration', d: `Une demi-journée avec un formateur : outils branchés, équipe formée. ${eur(INTEGRATION_HT)} HT, finançable OPCO.` },
];

const portrait = (id: string) => `/agents-ia/studio/${id}.webp`;
const allerA = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

export default function AgentsIA() {
  const [etat, setEtat] = useState<'saisie' | 'envoi' | 'ok' | 'erreur'>('saisie');
  const [erreur, setErreur] = useState('');
  const [faqOuverte, setFaqOuverte] = useState<number | null>(0);
  // Anti-spam : champ piège invisible + temps minimal de saisie (trigger base en renfort).
  const [piege, setPiege] = useState('');
  const [ouvertLe] = useState(() => Date.now());
  const faq = useMemo(() => faqAgents(), []);
  const [contratChoisi, setContratChoisi] = useState<ContratId>('plein');
  const [cdi, setCdi] = useState(false);

  const calcul = useMemo(() => {
    const c = CONTRATS.find((x) => x.id === contratChoisi)!;
    const b = bulletin(normaliser({ contrat: contratChoisi, cdi }));
    return { c, mensuel: b.mensuel_ht, annuel: b.annuel_ht };
  }, [contratChoisi, cdi]);


  const envoyer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (piege || Date.now() - ouvertLe < 3000) { setEtat('ok'); return; }
    const nom = String(f.get('nom') ?? '').trim().replace(/\s+/g, ' ');
    const societe = String(f.get('societe') ?? '').trim();
    const tel = String(f.get('tel') ?? '').trim();
    const email = String(f.get('email') ?? '').trim().toLowerCase();
    const [premier, ...reste] = nom.split(' ');
    setEtat('envoi'); setErreur('');
    const { error } = await supabase.from('contact_requests').insert([{
      first_name: reste.length ? premier : null,
      last_name: reste.length ? reste.join(' ') : premier,
      email: email || null, phone: tel, company: societe || null,
      request_type: 'Studio IA (agents IA)',
      message: `Demande d'appel de 20 min — Studio IA. Entreprise : ${societe}. `
        + `Contrat envisagé : ${calcul.c.nom} ${cdi ? '(CDI annuel)' : '(CDD mensuel)'}, ${eur(calcul.mensuel)} HT/mois.`,
      source: window.location.pathname, status: 'new',
    }]);
    if (error) { setErreur(error.message); setEtat('erreur'); return; }
    setEtat('ok');
  };

  const Cta = ({ texte = 'Réserver mon appel de 20 min', clair = false }: { texte?: string; clair?: boolean }) => (
    <button type="button" onClick={() => allerA('capture')}
      className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${clair ? 'bg-white text-neutral-900 hover:bg-neutral-100' : 'bg-orange-500 text-neutral-950 hover:bg-orange-400'}`}>
      {texte} <ArrowRight className="h-4 w-4" />
    </button>
  );

  const Essai = ({ texte = 'Commencer en stage gratuit', plein = false }: { texte?: string; plein?: boolean }) => (
    <a href={LIEN_ESSAI}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-orange-400 ${plein ? 'w-full' : ''}`}>
      {texte} <ArrowRight className="h-4 w-4" />
    </a>
  );

  return (
    <>
      <SEO
        title={`Studio IA : votre équipe d'agents IA — stage gratuit, contrats dès ${PRIX_MIN} €/mois | Aissociate`}
        description={`Sept agents IA spécialistes (assistante, marketing, commercial, SEO, juridique, RH, comptabilité) qui connaissent votre entreprise. Ils commencent en stage gratuit, sans limite de durée ; contrats dès ${PRIX_MIN} € HT/mois, agents illimités, accompagnement à La Réunion.`}
        keywords="agent IA PME, agents IA La Réunion, agent IA gratuit, assistant IA entreprise 974, IA marketing réseaux sociaux, automatisation TPE Réunion"
        url={`${SITE_URL}/`}
        image={`${SITE_URL}/agents-ia/studio/equipe-og.jpg`}
        imageAlt="Studio IA Aissociate : l'équipe d'agents IA"
        breadcrumbs={[{ name: 'Accueil', url: SITE_URL }]}
        faqData={faq}
      />
      <Header />
      <main id="contenu" className="bg-[#F2ECE4] font-sans text-neutral-900">

        {/* ── 1. Accroche ── */}
        <section className="relative overflow-hidden bg-neutral-950 text-white">
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-neutral-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Studio IA · Aissociate · Saint-Denis, La Réunion
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
              Arrêtez de tout faire seul.<br />
              <span className="text-orange-400">Votre équipe d'agents IA</span> s'en charge.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-neutral-300">
              Sept spécialistes qui connaissent vos prix, votre ton et vos clients : posts, prospection, e-mails, articles,
              courriers, recrutement. Vous décidez, ils préparent. Ils commencent <b className="text-white">en stage, gratuitement et sans limite de durée</b>, sans carte bancaire.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Essai />
              <button type="button" onClick={() => allerA('sam')} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/10">
                <MessageSquare className="h-4 w-4" /> Parler à Sam, notre agent IA
              </button>
              <button type="button" onClick={() => allerA('offre')} className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-neutral-300 hover:text-white">
                Voir les prix
              </button>
            </div>
            {/* L'équipe au complet (Nano Banana) : Léa au premier plan, puis Sam et Hugo, puis Inès, Maël et Nora. */}
            <figure className="relative -mx-4 mt-12 sm:-mx-8">
              <img src="/agents-ia/studio/equipe.webp" width={1800} height={764} {...{ fetchpriority: 'high' }}
                alt="L'équipe d'agents IA du Studio : Léa, Sam, Hugo, Inès, Maël et Nora"
                className="w-full select-none [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_72%,transparent)]" />
              <figcaption className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-wrap justify-center gap-1.5 px-4">
                {AGENTS.map((a) => (
                  <span key={a.id} className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-xs text-neutral-200 backdrop-blur">
                    <span className="h-2 w-2 rounded-full" style={{ background: a.couleur }} /> {a.prenom} · {a.metier.split(' ')[0]}
                  </span>
                ))}
              </figcaption>
            </figure>
            <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-neutral-300">
              {[
                [BadgeCheck, 'Stage gratuit, sans limite de durée ni carte bancaire'],
                [Clock, `Contrats dès ${PRIX_MIN} € HT/mois, sans engagement en CDD`],
                [Lock, 'Données hébergées en Europe, RGPD'],
                [ShieldCheck, 'Aissociate, organisme certifié Qualiopi'],
              ].map(([Icone, t]) => {
                const I = Icone as typeof Clock;
                return <li key={t as string} className="flex items-center gap-2"><I className="h-4 w-4 text-orange-400" /> {t as string}</li>;
              })}
            </ul>
          </div>
        </section>

        {/* ── 2. Histoire ── */}
        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">Vous vous reconnaissez ?</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Il est 21 h. Vous êtes encore sur vos mails.</h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-neutral-700">
            <p>La journée, vous faites votre métier. Le soir, tout le reste : le post Facebook qu'il « faudrait » publier, le devis à relancer, la facture impayée, l'annonce pour recruter, les CGV que vous n'avez jamais écrites.</p>
            <p>Vous avez essayé ChatGPT. Une page blanche, des réponses génériques, et il faut tout lui réexpliquer à chaque fois : vos prix, vos clients, votre façon de parler.</p>
            <p className="font-medium text-neutral-900">Le problème n'est pas l'IA. C'est qu'on vous a donné un outil, alors qu'il vous fallait une équipe.</p>
          </div>
        </section>

        {/* ── 2 bis. Démo en direct : Sam, notre propre agent commercial ── */}
        <section id="sam" className="bg-neutral-950 py-20 text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-orange-400">Démo en direct</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Ne nous croyez pas sur parole. Parlez à Sam.</h2>
              <p className="mt-5 text-neutral-300">
                Sam est notre propre agent commercial, construit avec le Studio IA. Il connaît notre offre, répond à vos questions,
                vous propose les agents utiles pour votre activité… et, si vous le souhaitez, il transmet votre demande à un conseiller.
              </p>
              <p className="mt-4 text-neutral-300">C'est exactement ce que fera le vôtre pour vos clients.</p>
              <ul className="mt-6 space-y-2 text-sm text-neutral-400">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Vos coordonnées ne partent qu'avec votre accord</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Votre demande arrive directement dans notre CRM</li>
              </ul>
            </div>
            <SamDemo />
          </div>
        </section>

        {/* ── 3. Mécanisme ── */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Pas un chatbot de plus. Une équipe qui connaît votre maison.</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                { I: Zap, t: 'Des spécialistes, pas des généralistes', d: "Chaque agent a son métier et ses missions cadrées. Hors de son domaine, il ne bricole pas : il passe la main au bon collègue, en un clic." },
                { I: FileText, t: 'Ils connaissent votre entreprise', d: "Votre fiche, vos tarifs, votre charte, vos plaquettes et chaque contenu que vous avez validé : tout est relu avant chaque mission. Fini de tout réexpliquer." },
                { I: ShieldCheck, t: 'Vous gardez la main', d: "Ils préparent, vous validez. Rien ne part vers un client sans votre accord. Chaque réponse se garde, se note et se retrouve dans votre espace." },
              ].map(({ I, t, d }) => (
                <div key={t} className="rounded-2xl border border-neutral-200 p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><I className="h-5 w-5" /></span>
                  <h3 className="mt-4 text-lg font-semibold">{t}</h3>
                  <p className="mt-2 text-neutral-600">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 4. L'équipe ── */}
        <section id="equipe" className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">L'équipe</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Sept agents. Sept métiers. Choisissez ceux dont vous avez besoin.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {AGENTS.map((a) => (
              <article key={a.id} className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                <div className="relative h-56 overflow-hidden" style={{ background: a.couleur }}>
                  <img src={portrait(a.id)} alt={`${a.prenom}, agent IA ${a.metier}`} loading="lazy" width={640} height={640}
                    className="absolute bottom-0 left-1/2 h-[118%] w-auto max-w-none -translate-x-1/2 object-cover object-top" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-6 pb-4 pt-10 text-white">
                    <h3 className="text-2xl font-semibold">{a.prenom}</h3>
                    <p className="text-sm text-white/85">{a.metier}</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                <p className="font-medium">{a.accroche}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-neutral-400">Ses super-pouvoirs</p>
                <ul className="mt-2 space-y-1.5">
                  {a.pouvoirs.map((p) => <li key={p} className="flex gap-2 text-sm text-neutral-700"><Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />{p}</li>)}
                </ul>
                <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-neutral-400">Cas d'usage</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {a.cas.map((c) => (
                    <div key={c.titre} className="rounded-xl bg-neutral-50 p-3">
                      <p className="text-sm font-medium">{c.titre}</p>
                      <p className="mt-1 text-sm text-neutral-600">{c.texte}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-auto flex items-center gap-1.5 pt-5 text-xs text-neutral-500"><Clock className="h-3.5 w-3.5" /> Environ {a.minutes} minutes gagnées par mission (estimation)</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── 5. Preuve : un exemple réel ── */}
        <section className="bg-neutral-950 py-20 text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-orange-400">Vu en démonstration</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Une seule phrase. Un post juste du premier coup.</h2>
              <p className="mt-5 text-neutral-300">
                Une boulangerie (fictive) de Saint-Pierre utilise le Studio depuis un mois. On demande à Hugo : « Prépare le post Facebook
                du 2 décembre prévu dans notre calendrier ». Sans autre consigne, il retrouve le calendrier validé, les prix des bûches,
                la date limite de précommande, la charte de ton… et évite de doublonner le post du Marché de Noël, déjà prévu.
              </p>
              <p className="mt-4 text-sm text-neutral-500">Réponse réelle générée par le Studio sur un espace de démonstration ; entreprise et données fictives.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <img src={portrait('hugo')} alt="" className="h-9 w-9 rounded-full object-cover object-top" style={{ background: '#ec4899' }} />
                <div><p className="text-sm font-medium">Hugo</p><p className="text-xs text-neutral-400">Marketing & réseaux sociaux</p></div>
              </div>
              <div className="mt-4 space-y-2 text-sm leading-relaxed text-neutral-200">
                <p>🎄 Les précommandes de nos bûches de Noël sont ouvertes !</p>
                <p>Comme chaque année, elles sont préparées dans notre atelier, avec nos fruits du Sud sauvage :</p>
                <p>• Bûche letchi-passion, 8 parts — 38 €<br />• Bûche vanille Bourbon-chocolat, 8 parts — 36 €</p>
                <p>Réservez la vôtre dès maintenant en boutique ou par message sur notre page. Précommandes ouvertes jusqu'au 20 décembre.</p>
                <p>Zot lé invité !<br />L'équipe des Délices 🥐</p>
              </div>
              <p className="mt-4 rounded-lg bg-white/5 px-3 py-2 text-xs text-neutral-400">
                Note de Hugo : « Je n'ai pas évoqué le Marché de Noël ici : il a son propre post le 12 décembre. »
              </p>
            </div>
          </div>
        </section>

        {/* ── 6. Mise en place ── */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Vos agents travaillent dès aujourd'hui. Vous montez en charge à votre rythme.</h2>
          <p className="mt-3 max-w-2xl text-neutral-600">Votre espace s'ouvre à la fin du questionnaire. Vous n'êtes pas seul pour autant : une équipe humaine, à La Réunion, répond à vos questions et peut tout installer avec vous.</p>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {PAS_A_PAS.map((p, i) => (
              <li key={p.t} className="rounded-2xl border border-neutral-200 bg-white p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">{i + 1}</span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-orange-600">{p.j}</p>
                <h3 className="mt-1 text-lg font-semibold">{p.t}</h3>
                <p className="mt-2 text-neutral-600">{p.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── 7. L'offre empilée + calculateur ── */}
        <section id="offre" className="bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">L'offre</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Tout ce que vous obtenez.</h2>
            <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
              <ul className="space-y-3">
                {[
                  ['Votre espace Studio IA privé', 'Accès par identifiant et mot de passe pour vous et votre équipe, depuis ordinateur ou mobile.'],
                  ['Les agents de votre choix, configurés pour vous', 'Fiche entreprise, ton, consignes propres à chaque agent.'],
                  ['Leurs super-pouvoirs', 'Missions cadrées par des formulaires simples : résultat fiable, sans savoir « parler à l\'IA ».'],
                  ['Votre base de connaissances', 'Tarifs, plaquettes, charte, FAQ : lus par les agents avant chaque mission.'],
                  ['Visuels et vidéos IA', 'Générés à la demande, rangés dans votre galerie, prêts à publier.'],
                  ['Des badges d\'accès à vos outils', `Messagerie, agenda, réseaux sociaux, logiciels : ${PAYANTS.map((c) => c.badges).join(', ')} badges selon le contrat, ${eur(prixAvenant('badges'))} HT / mois le badge de plus (détail ci-dessous).`],
                  ['Formation continue', 'Vos agents reçoivent toutes les mises à jour sans supplément, quel que soit le contrat.'],
                  ['Un stage gratuit, sans limite de durée', 'Sans carte bancaire. Rien n\'est facturé tant que vous ne signez pas de contrat.'],
                ].map(([t, d]) => (
                  <li key={t} className="flex gap-3 rounded-xl border border-neutral-200 p-4">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div><p className="font-medium">{t}</p><p className="text-sm text-neutral-600">{d}</p></div>
                  </li>
                ))}
              </ul>

              <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="rounded-2xl border-2 border-neutral-900 p-6">
                  <p className="font-semibold">Choisissez votre contrat</p>
                  <div role="group" aria-label="Type d'engagement" className="mt-3 inline-flex rounded-xl bg-neutral-100 p-1 text-sm">
                    {[false, true].map((v) => (
                      <button key={String(v)} type="button" aria-pressed={cdi === v} onClick={() => setCdi(v)}
                        className={`rounded-lg px-3 py-1.5 font-medium ${cdi === v ? 'bg-white shadow-sm' : 'text-neutral-500'}`}>
                        {v ? 'CDI · 2 mois offerts' : 'CDD · sans engagement'}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {CONTRATS.map((c) => {
                      const on = c.id === contratChoisi;
                      return (
                        <button key={c.id} type="button" onClick={() => setContratChoisi(c.id)} aria-pressed={on}
                          className={`rounded-xl border p-3 text-left transition-colors ${on ? 'border-orange-500 ring-2 ring-orange-100' : 'border-neutral-200 hover:border-neutral-400'}`}>
                          <span className="flex items-center justify-between gap-2 font-semibold">{c.nom}{c.reco && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-700">Recommandé</span>}</span>
                          <span className="block text-sm text-neutral-500">{c.prix ? `${eur(c.prix)} HT / mois` : 'Gratuit, sans limite'}</span>
                        </button>
                      );
                    })}
                  </div>
                  <dl className="mt-6 space-y-3 text-sm">
                    <ul className="space-y-1.5 text-neutral-600">
                      {calcul.c.points.map((pt) => <li key={pt} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{pt}</li>)}
                    </ul>
                    <div className="flex items-end justify-between border-t border-neutral-200 pt-3">
                      <dt className="font-semibold">{calcul.c.prix ? 'Contrat' : 'Stage'}</dt>
                      <dd className="text-3xl font-semibold">{eur(calcul.mensuel)}<span className="text-sm font-normal text-neutral-500"> HT / mois</span></dd>
                    </div>
                    {calcul.annuel != null && <p className="text-xs text-neutral-500">Soit {eur(calcul.annuel)} HT réglés pour l'année (12 mois pour le prix de 10).</p>}
                    <p className="text-xs text-neutral-500">Agents illimités. 1 heure de travail = 20 actions d'agent. Avenants à tout moment : heures, badges, responsables, archives.</p>
                  </dl>
                  <div className="mt-6"><Essai plein /></div>
                  <p className="mt-2 text-center text-xs text-neutral-500">Sans carte bancaire. Vous signez le contrat depuis votre espace, quand vous voulez.</p>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                  Montants HT. En CDD, sans engagement, résiliable à tout moment depuis votre espace ; en CDI, engagement d'un an.
                </p>
              </div>
            </div>

            <div id="connecteurs" className="mt-12 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
                <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Badges d'accès compris</p>
                <p className="mt-1 text-sm text-neutral-600">Un badge = un outil ouvert à vos agents (une messagerie, un agenda, une page…).</p>
                <ul className="mt-4 space-y-2">
                  {CONTRATS.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{c.nom} : {c.badges ? `${c.badges} badges` : 'aucun badge'}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-6">
                <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">Avenants au contrat</p>
                <p className="mt-1 text-sm text-neutral-600">Modifiables à tout moment, sans changer de contrat.</p>
                <ul className="mt-4 space-y-2">
                  {[...COMPTEURS, ...INTERRUPTEURS].map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-sm"><ArrowRight className="h-4 w-4 shrink-0 text-orange-500" />{a.nom} : <b className="font-medium">{eur(a.prix)} HT</b> {a.unite}</li>
                  ))}
                </ul>
              </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 md:col-span-2">
              <p className="font-semibold">Toutes les autres applications, en un clic</p>
              <p className="mt-1 text-sm text-neutral-600">
                Vous les reliez vous-même depuis votre espace, sans attendre : un clic, vous autorisez l'accès, c'est connecté.
                Chacune utilise un badge d'accès de votre contrat. Votre logiciel n'est pas dans la liste ? Demandez-le.
              </p>
              <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                {APPLICATIONS_UN_CLIC.map((g) => (
                  <div key={g.categorie}>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{g.categorie}</dt>
                    <dd className="mt-2 flex flex-wrap gap-1.5">
                      {g.apps.map((a) => (
                        <span key={a.slug} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 py-1 pl-1.5 pr-2.5 text-sm">
                          <img src={logoConnecteur(a.slug)} alt="" width={16} height={16} loading="lazy" className="h-4 w-4" /> {a.nom}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            </div>
          </div>
        </section>

        {/* ── 8. Garantie ── */}
        <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-8">
          <ShieldCheck className="mx-auto h-12 w-12 text-orange-500" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Notre engagement : vous essayez avant de payer.</h2>
          <p className="mt-4 text-lg text-neutral-700">
            Vos agents commencent en stage, gratuitement, sans carte bancaire et sans limite de durée. Ensuite, un contrat sans engagement en CDD,
            que vous arrêtez quand vous voulez. Et si le Studio n'est pas le bon outil pour vous, nous vous le dirons franchement.
          </p>
          <div className="mt-6"><Essai /></div>
        </section>

        {/* ── 9. Pour qui ── */}
        <section className="bg-white py-20">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:px-8 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Check className="h-5 w-5 text-emerald-600" /> C'est pour vous si…</h2>
              <ul className="mt-4 space-y-2 text-neutral-700">
                {['Vous dirigez une TPE ou PME et vous faites « tout le reste » le soir', 'Vous savez ce que vous voulez dire, pas le temps de l\'écrire', 'Vous voulez garder la main sur ce qui part vers vos clients', 'Vous préférez un accompagnement local à un logiciel de plus'].map((t) => <li key={t} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />{t}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-neutral-200 p-6">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><X className="h-5 w-5 text-neutral-400" /> Ce n'est pas pour vous si…</h2>
              <ul className="mt-4 space-y-2 text-neutral-700">
                {['Vous cherchez une IA qui publie et envoie tout sans votre accord', 'Vous voulez remplacer votre expertise métier', 'Vous ne prendrez jamais dix minutes pour présenter votre entreprise'].map((t) => <li key={t} className="flex gap-2"><X className="mt-1 h-4 w-4 shrink-0 text-neutral-400" />{t}</li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* ── 10. FAQ ── */}
        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-8">
          <h2 className="text-3xl font-semibold tracking-tight">Vos questions, nos réponses.</h2>
          <div className="mt-8 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
            {faq.map((q, i) => (
              <div key={q.question}>
                <button type="button" onClick={() => setFaqOuverte(faqOuverte === i ? null : i)} aria-expanded={faqOuverte === i}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium">
                  {q.question}<ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${faqOuverte === i ? 'rotate-180' : ''}`} />
                </button>
                {faqOuverte === i && <p className="px-5 pb-5 text-neutral-600">{q.answer}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ── 11. Appel à l'action ── */}
        <section id="capture" className="bg-neutral-950 py-20 text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Vingt minutes pour voir si votre équipe vous attend.</h2>
              <p className="mt-4 text-neutral-300">
                Un conseiller Aissociate vous rappelle sous 24 h ouvrées. On regarde votre activité et on choisit les bons agents
                avec vous. Sans engagement.
              </p>
              <p className="mt-3 text-sm text-neutral-400">
                Vous préférez discuter ? <button type="button" onClick={() => allerA('sam')} className="underline hover:text-white">Sam peut prendre votre demande</button>.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-neutral-300">
                <li className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-orange-400" /> Appel gratuit de 20 minutes</li>
                <li className="flex items-center gap-2"><Users className="h-4 w-4 text-orange-400" /> Contrat envisagé : {calcul.c.nom}{calcul.c.prix ? ` · ${eur(calcul.mensuel)} HT / mois` : ''}</li>
                <li className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-orange-400" /> Réponse franche, même si ce n'est pas pour vous</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-6 text-neutral-900">
              {etat === 'ok' ? (
                <div className="py-10 text-center" role="status">
                  <Sparkles className="mx-auto h-10 w-10 text-orange-500" />
                  <p className="mt-4 text-lg font-semibold">C'est noté !</p>
                  <p className="mt-1 text-neutral-600">Un conseiller Aissociate vous rappelle sous 24 h ouvrées.</p>
                </div>
              ) : (
                <form onSubmit={(e) => void envoyer(e)} className="space-y-3">
                  {[
                    ['nom', 'Votre nom et prénom', 'text', 'Marie Dupont', 'name'],
                    ['societe', 'Votre entreprise', 'text', 'Votre TPE', 'organization'],
                    ['email', 'Votre e-mail', 'email', 'marie@votre-tpe.re', 'email'],
                    ['tel', 'Votre téléphone', 'tel', '06 92 00 00 00', 'tel'],
                  ].map(([nom, label, type, ph, ac]) => (
                    <label key={nom} className="block">
                      <span className="mb-1 block text-sm font-medium">{label}</span>
                      <input name={nom} type={type} placeholder={ph} autoComplete={ac} required
                        className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 focus:bg-white" />
                    </label>
                  ))}
                  {/* Piège à robots : invisible pour un humain. */}
                  <div className="absolute -left-[9999px]" aria-hidden="true">
                    <label htmlFor="ag-site">Site web</label>
                    <input id="ag-site" name="site" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
                  </div>
                  <button type="submit" disabled={etat === 'envoi'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-neutral-950 hover:bg-orange-400 disabled:opacity-60">
                    {etat === 'envoi' ? 'Envoi en cours…' : 'Réserver mon appel de 20 min'} <ArrowRight className="h-4 w-4" />
                  </button>
                  {etat === 'erreur' && <p className="text-sm text-red-600" role="alert">Une erreur est survenue{erreur ? ` (${erreur})` : ''}. Réessayez, ou appelez-nous au 06 92 24 68 60.</p>}
                  <p className="text-center text-xs text-neutral-500">Sans engagement · données hébergées en Union européenne · RGPD</p>
                  <p className="border-t border-neutral-200 pt-3 text-center text-sm text-neutral-600">
                    Vous préférez essayer tout de suite ? <a href={LIEN_ESSAI} className="font-semibold text-orange-600 underline">Ouvrez votre espace en stage gratuit</a> : votre espace est prêt dès la fin du questionnaire.
                  </p>
                </form>
              )}
            </div>
          </div>
          <div className="mx-auto mt-14 max-w-3xl px-4 text-neutral-300 sm:px-8">
            <p><b className="text-white">P.-S.</b> Dans un an, vous aurez soit passé encore 300 soirées sur vos mails, vos posts et vos relances, soit une équipe qui les prépare pour vous. Les deux coûtent quelque chose. Une seule vous rend votre temps.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Essai /><Cta texte="Je réserve mon appel" clair /></div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
