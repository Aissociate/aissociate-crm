import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight, BadgeCheck, CalendarCheck, Check, ChevronDown, Clock, FileText, Lock, MessageSquare,
  ShieldCheck, Sparkles, Users, X, Zap,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO, { SITE_URL } from '../components/SEO';
import { supabase } from '@/lib/supabase';
import SamDemo from '../components/SamDemo';

/**
 * Page de vente « Studio IA » (/agents-ia) : l'équipe d'agents IA d'Aissociate.
 * Structure en tunnel (accroche → histoire → mécanisme → équipe → preuve →
 * offre empilée → garantie → pour qui → FAQ → appel à l'action + P.-S.).
 * Le formulaire envoie au CRM comme les autres formulaires du site
 * (contact_requests → prospect via le trigger lead_to_contact).
 *
 * ⚠ Tous les montants de l'offre sont dans OFFRE ci-dessous : à modifier là, et
 * dans scripts/prerender.mjs (balises SEO et données structurées).
 */

// ── L'offre ─────────────────────────────────────────────────────────────────
const OFFRE = {
  socle: 499,                 // initialisation de l'espace, HT, une fois
  parAgent: 199,              // mise en place de chaque agent, HT, une fois
  // Abonnement mensuel HT : prix du 1er, 2e, … 5e agent (dégressif jusqu'à -50 %).
  mensuelParRang: [99, 87, 74, 62, 49.5],
  delaiJours: 15,
  // Kap Numérik (Région Réunion) — indicatif, sous réserve : voir mention sous le calculateur.
  kap: { taux: 0.8, plafond: 3200 },
};
const eur = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
const mensuelRang = (i: number) => OFFRE.mensuelParRang[Math.min(i, OFFRE.mensuelParRang.length - 1)];

// ── L'équipe (miroir du catalogue du Studio : super-pouvoirs réels) ─────────
type Agent = {
  id: string; prenom: string; metier: string; couleur: string; accroche: string;
  pouvoirs: string[]; cas: { titre: string; texte: string }[]; minutes: number;
};
const AGENTS: Agent[] = [
  {
    id: 'lea', prenom: 'Léa', metier: 'Assistante générale', couleur: '#f97316', minutes: 20,
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
];

const FAQ_AGENTS = [
  { question: 'Est-ce un chatbot de plus ?', answer: "Non. Chaque agent est un spécialiste avec des missions cadrées (ses « super-pouvoirs »). Il connaît votre entreprise : votre fiche, vos tarifs, votre charte, les contenus que vous avez déjà validés. Si une demande sort de son métier, il ne bricole pas : il la confie au bon collègue." },
  { question: 'Combien ça coûte vraiment ?', answer: `Une mise en place unique de ${OFFRE.socle} € HT, plus ${OFFRE.parAgent} € HT par agent. Puis un abonnement de ${OFFRE.mensuelParRang[0]} € HT par mois pour le premier agent, dégressif pour les suivants, jusqu'à ${eur(OFFRE.mensuelParRang[4])} pour le cinquième (-50 %). Le calculateur de la page vous donne votre montant exact.` },
  { question: 'Puis-je le financer avec le Kap Numérik ?', answer: "La mise en place est éligible au dispositif Kap Numérik 2026 de la Région Réunion, sous réserve de l'éligibilité de votre entreprise et de l'ouverture des dépôts. Nous vérifions votre situation et montons le dossier avec vous." },
  { question: 'En combien de temps est-ce opérationnel ?', answer: `${OFFRE.delaiJours} jours : audit et onboarding, configuration de votre espace (fiche entreprise, ressources, connecteurs), tests et prise en main avec vous.` },
  { question: 'Les agents envoient-ils des messages à ma place ?', answer: "Ils préparent, vous validez. Rien ne part vers vos clients sans votre accord. Les connecteurs (Gmail, Outlook, votre messagerie, Facebook, Instagram, LinkedIn, TikTok) permettent de préparer du contenu directement adapté à vos outils." },
  { question: 'Et mes données ?', answer: "Votre espace est cloisonné : vos données ne sont visibles que de vous et de votre équipe. Hébergement en Union européenne, mots de passe et secrets chiffrés, conformité RGPD." },
];

const PAS_A_PAS = [
  { j: 'Jours 1 à 3', t: 'Audit et onboarding', d: 'Un appel pour comprendre votre activité, vos priorités et le ton de votre marque.' },
  { j: 'Jours 4 à 10', t: 'Configuration', d: 'Fiche entreprise, ressources (tarifs, plaquette, charte), agents choisis, connecteurs.' },
  { j: 'Jours 11 à 15', t: 'Tests et prise en main', d: 'Vos premières missions avec nous, ajustements, accès de votre équipe.' },
];

const portrait = (id: string) => `/agents-ia/studio/${id}.webp`;
const allerA = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

export default function AgentsIA() {
  const [choisis, setChoisis] = useState<string[]>(['lea', 'hugo']);
  const [etat, setEtat] = useState<'saisie' | 'envoi' | 'ok' | 'erreur'>('saisie');
  const [erreur, setErreur] = useState('');
  const [faqOuverte, setFaqOuverte] = useState<number | null>(0);
  // Anti-spam : champ piège invisible + temps minimal de saisie (trigger base en renfort).
  const [piege, setPiege] = useState('');
  const [ouvertLe] = useState(() => Date.now());

  const calcul = useMemo(() => {
    const n = choisis.length;
    const miseEnPlace = n ? OFFRE.socle + OFFRE.parAgent * n : 0;
    const mensuel = Array.from({ length: n }, (_, i) => mensuelRang(i)).reduce((a, b) => a + b, 0);
    const aide = Math.min(miseEnPlace * OFFRE.kap.taux, OFFRE.kap.plafond);
    const minutesSemaine = AGENTS.filter((a) => choisis.includes(a.id)).reduce((s, a) => s + a.minutes * 5, 0);
    return { n, miseEnPlace, mensuel, aide, reste: miseEnPlace - aide, heuresMois: Math.round((minutesSemaine * 4.3) / 60) };
  }, [choisis]);

  const basculer = (id: string) => setChoisis((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const envoyer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (piege || Date.now() - ouvertLe < 3000) { setEtat('ok'); return; }
    const nom = String(f.get('nom') ?? '').trim().replace(/\s+/g, ' ');
    const societe = String(f.get('societe') ?? '').trim();
    const tel = String(f.get('tel') ?? '').trim();
    const email = String(f.get('email') ?? '').trim().toLowerCase();
    const [premier, ...reste] = nom.split(' ');
    const equipe = AGENTS.filter((a) => choisis.includes(a.id)).map((a) => `${a.prenom} (${a.metier})`).join(', ') || 'à définir';
    setEtat('envoi'); setErreur('');
    const { error } = await supabase.from('contact_requests').insert([{
      first_name: reste.length ? premier : null,
      last_name: reste.length ? reste.join(' ') : premier,
      email: email || null, phone: tel, company: societe || null,
      request_type: 'Studio IA (agents IA)',
      message: `Demande d'appel de 20 min — Studio IA. Entreprise : ${societe}. Agents envisagés : ${equipe}. `
        + `Estimation affichée : mise en place ${eur(calcul.miseEnPlace)} HT, ${eur(calcul.mensuel)} HT/mois.`,
      source: window.location.pathname, status: 'new',
    }]);
    if (error) { setErreur(error.message); setEtat('erreur'); return; }
    setEtat('ok');
  };

  const Cta = ({ texte = 'Réserver mon appel de 20 min', clair = false }: { texte?: string; clair?: boolean }) => (
    <button type="button" onClick={() => allerA('capture')}
      className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${clair ? 'bg-white text-neutral-900 hover:bg-neutral-100' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
      {texte} <ArrowRight className="h-4 w-4" />
    </button>
  );

  return (
    <>
      <SEO
        title={`Studio IA : votre équipe d'agents IA en ${OFFRE.delaiJours} jours — dès ${OFFRE.mensuelParRang[0]} €/mois | Aissociate`}
        description={`Six agents IA spécialistes (assistante, marketing, commercial, SEO, juridique, RH) qui connaissent votre entreprise. Mise en place en ${OFFRE.delaiJours} jours à La Réunion, éligible Kap Numérik 2026. Dès ${OFFRE.mensuelParRang[0]} € HT/mois.`}
        keywords="agent IA PME, agents IA La Réunion, Kap Numérik 2026, assistant IA entreprise 974, IA marketing réseaux sociaux, automatisation TPE Réunion"
        url={`${SITE_URL}/agents-ia`}
        image={`${SITE_URL}/agents-ia/studio/equipe-og.jpg`}
        imageAlt="Studio IA Aissociate : l'équipe d'agents IA"
        breadcrumbs={[{ name: 'Accueil', url: SITE_URL }, { name: 'Agents IA', url: `${SITE_URL}/agents-ia` }]}
        faqData={FAQ_AGENTS}
      />
      <Header />
      <main id="contenu" className="bg-[#f6f6f4] font-sans text-neutral-900">

        {/* ── 1. Accroche ── */}
        <section className="relative overflow-hidden bg-neutral-950 text-white">
          <div className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-orange-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-pink-500/10 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-neutral-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Studio IA · Aissociate · Saint-Denis, La Réunion
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
              Arrêtez de tout faire seul.<br />
              <span className="text-orange-400">Votre équipe d'agents IA</span> s'en charge.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-neutral-300">
              Six spécialistes qui connaissent vos prix, votre ton et vos clients : posts, prospection, e-mails, articles,
              courriers, recrutement. Vous décidez, ils préparent. Opérationnels en <b className="text-white">{OFFRE.delaiJours} jours</b>.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Cta />
              <button type="button" onClick={() => allerA('sam')} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/10">
                <MessageSquare className="h-4 w-4" /> Parler à Sam, notre agent IA
              </button>
              <button type="button" onClick={() => allerA('offre')} className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-neutral-300 hover:text-white">
                Calculer mon offre
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
                [BadgeCheck, 'Mise en place éligible Kap Numérik 2026*'],
                [Clock, `Opérationnel en ${OFFRE.delaiJours} jours`],
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
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Six agents. Six métiers. Choisissez ceux dont vous avez besoin.</h2>
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
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{OFFRE.delaiJours} jours, et votre équipe est au travail.</h2>
          <p className="mt-3 max-w-2xl text-neutral-600">Vous n'avez rien à paramétrer seul : une équipe humaine, à La Réunion, installe tout avec vous.</p>
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
                  ['Les connecteurs', 'Gmail, Outlook, votre messagerie, Facebook, Instagram, LinkedIn, TikTok : nous les mettons en place avec vous.'],
                  ['L\'accompagnement humain', `Mise en place en ${OFFRE.delaiJours} jours, prise en main avec vous, support à La Réunion.`],
                  ['Le montage du dossier Kap Numérik', 'Nous vérifions votre éligibilité et préparons le dossier.'],
                ].map(([t, d]) => (
                  <li key={t} className="flex gap-3 rounded-xl border border-neutral-200 p-4">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div><p className="font-medium">{t}</p><p className="text-sm text-neutral-600">{d}</p></div>
                  </li>
                ))}
              </ul>

              <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="rounded-2xl border-2 border-neutral-900 p-6">
                  <p className="font-semibold">Composez votre équipe</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {AGENTS.map((a) => {
                      const on = choisis.includes(a.id);
                      return (
                        <button key={a.id} type="button" onClick={() => basculer(a.id)} aria-pressed={on}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 hover:border-neutral-400'}`}>
                          <img src={portrait(a.id)} alt="" className="h-5 w-5 rounded-full object-cover object-top" style={{ background: a.couleur }} /> {a.prenom}
                        </button>
                      );
                    })}
                  </div>
                  {calcul.n === 0 ? <p className="mt-6 text-sm text-neutral-500">Choisissez au moins un agent.</p> : (
                    <dl className="mt-6 space-y-3 text-sm">
                      <div className="flex justify-between"><dt>Initialisation de l'espace</dt><dd>{eur(OFFRE.socle)}</dd></div>
                      <div className="flex justify-between"><dt>Mise en place : {calcul.n} agent{calcul.n > 1 ? 's' : ''} × {OFFRE.parAgent} €</dt><dd>{eur(OFFRE.parAgent * calcul.n)}</dd></div>
                      <div className="flex justify-between border-t border-neutral-200 pt-3 font-semibold"><dt>Mise en place, une seule fois</dt><dd>{eur(calcul.miseEnPlace)} HT</dd></div>
                      <div className="flex justify-between rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">
                        <dt>Kap Numérik, estimation*</dt><dd>− {eur(calcul.aide)}</dd>
                      </div>
                      <div className="flex justify-between font-semibold"><dt>Votre reste à charge estimé</dt><dd>{eur(calcul.reste)} HT</dd></div>
                      <div className="border-t border-neutral-200 pt-3">
                        {Array.from({ length: calcul.n }, (_, i) => (
                          <div key={i} className="flex justify-between text-neutral-600">
                            <dt>{i + 1}{i ? 'e' : 'er'} agent{i > 0 && mensuelRang(i) < OFFRE.mensuelParRang[0] ? ` (−${Math.round((1 - mensuelRang(i) / OFFRE.mensuelParRang[0]) * 100)} %)` : ''}</dt>
                            <dd>{eur(mensuelRang(i))} / mois</dd>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-end justify-between border-t border-neutral-200 pt-3">
                        <dt className="font-semibold">Abonnement</dt>
                        <dd className="text-3xl font-semibold">{eur(calcul.mensuel)}<span className="text-sm font-normal text-neutral-500"> HT / mois</span></dd>
                      </div>
                      <p className="rounded-lg bg-neutral-50 px-3 py-2 text-neutral-600">
                        Soit environ <b>{calcul.heuresMois} h</b> libérées chaque mois si vous confiez une mission par jour ouvré à chaque agent (estimation).
                      </p>
                    </dl>
                  )}
                  <button type="button" onClick={() => allerA('capture')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600">
                    Je veux cette équipe <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                  * Kap Numérik 2026 (Région Réunion) : aide indicative calculée sur la mise en place uniquement (jusqu'à {Math.round(OFFRE.kap.taux * 100)} % des
                  dépenses HT pour les entreprises de 0 à 9 salariés, plafonnée à {eur(OFFRE.kap.plafond)} ; taux plus faible de 10 à 19 salariés).
                  Sous réserve de l'éligibilité de l'entreprise, de l'ouverture des dépôts et de la validation du dossier par la Région. Montants HT.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 8. Garantie ── */}
        <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-8">
          <ShieldCheck className="mx-auto h-12 w-12 text-orange-500" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Notre engagement : {OFFRE.delaiJours} jours.</h2>
          <p className="mt-4 text-lg text-neutral-700">
            Votre équipe est opérationnelle en {OFFRE.delaiJours} jours, ou nous vous remboursons la mise en place. Et si, après l'appel de découverte,
            le Studio n'est pas le bon outil pour vous, nous vous le dirons franchement.
          </p>
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
            {FAQ_AGENTS.map((q, i) => (
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
                Un conseiller Aissociate vous rappelle sous 24 h ouvrées. On regarde votre activité, on choisit les bons agents,
                on vérifie votre éligibilité au Kap Numérik. Sans engagement.
              </p>
              <p className="mt-3 text-sm text-neutral-400">
                Vous préférez discuter ? <button type="button" onClick={() => allerA('sam')} className="underline hover:text-white">Sam peut prendre votre demande</button>.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-neutral-300">
                <li className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-orange-400" /> Appel gratuit de 20 minutes</li>
                <li className="flex items-center gap-2"><Users className="h-4 w-4 text-orange-400" /> Équipe proposée : {AGENTS.filter((a) => choisis.includes(a.id)).map((a) => a.prenom).join(', ') || 'à définir ensemble'}</li>
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
                  <button type="submit" disabled={etat === 'envoi'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60">
                    {etat === 'envoi' ? 'Envoi en cours…' : 'Réserver mon appel de 20 min'} <ArrowRight className="h-4 w-4" />
                  </button>
                  {etat === 'erreur' && <p className="text-sm text-red-600" role="alert">Une erreur est survenue{erreur ? ` (${erreur})` : ''}. Réessayez, ou appelez-nous au 06 92 24 68 60.</p>}
                  <p className="text-center text-xs text-neutral-500">Sans engagement · données hébergées en Union européenne · RGPD</p>
                </form>
              )}
            </div>
          </div>
          <div className="mx-auto mt-14 max-w-3xl px-4 text-neutral-300 sm:px-8">
            <p><b className="text-white">P.-S.</b> Dans un an, vous aurez soit passé encore 300 soirées sur vos mails, vos posts et vos relances, soit une équipe qui les prépare pour vous. Les deux coûtent quelque chose. Une seule vous rend votre temps.</p>
            <div className="mt-6"><Cta texte="Je réserve mon appel" clair /></div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
