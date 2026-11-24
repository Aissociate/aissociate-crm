import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Briefcase, Calculator, Check, GraduationCap, Handshake, Megaphone,
  MonitorSmartphone, Repeat, Users, Building2,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO, { SITE_URL } from '../components/SEO';
import { supabase } from '@/lib/supabase';
import { CONTRATS } from '../../../supabase/functions/studio/contrats';

/**
 * Programme partenaires (/affiliation) : recrutement d'apporteurs d'affaires pour le Studio IA.
 * Commission : 30 % du montant HT encaissé les 12 premiers mois d'un client, puis 10 % tant qu'il reste abonné.
 * Les candidatures arrivent dans contact_requests (type « Partenariat (affiliation) »), comme les autres demandes du site.
 * Les commerciaux indépendants ont un bouton à part vers le test commercial noté (/affiliation/test).
 */
const TAUX_AN_1 = 0.3;
const TAUX_ENSUITE = 0.1;
const PAYANTS = CONTRATS.filter((c) => c.prix > 0);

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

const PROFILS = [
  { icone: Briefcase, titre: 'Experts-comptables et conseils', texte: 'Vos clients vous demandent comment gagner du temps : vous avez une réponse concrète à leur proposer.' },
  { icone: Users, titre: 'Consultants et indépendants', texte: 'Vous accompagnez des TPE et des PME : le Studio IA prolonge votre mission et vous rapporte chaque mois.' },
  { icone: MonitorSmartphone, titre: 'Agences web et de communication', texte: 'Vos clients veulent publier plus sans payer plus : leurs agents produisent, vous gardez la stratégie.' },
  { icone: GraduationCap, titre: 'Formateurs', texte: 'Vos stagiaires repartent avec une équipe d’agents prête à l’emploi, et vous avec une commission.' },
  { icone: Building2, titre: 'Réseaux et associations d’entrepreneurs', texte: 'Un avantage concret à offrir à vos membres, avec un interlocuteur à La Réunion.' },
  { icone: Megaphone, titre: 'Créateurs de contenu', texte: 'Votre audience parle d’entrepreneuriat ou de productivité : recommandez un outil que l’on peut essayer gratuitement.' },
];

const ETAPES = [
  { t: 'Vous candidatez', d: 'Deux minutes pour nous dire qui vous êtes et à qui vous parlez.' },
  { t: 'On fait connaissance', d: 'Un échange de 20 minutes, puis votre contrat de partenariat, votre lien personnel et vos supports de présentation.' },
  { t: 'Vous recommandez', d: 'Vos contacts commencent en stage gratuit. Dès qu’ils signent un contrat, vos commissions démarrent.' },
];

const FAQ = [
  { question: 'Combien vais-je toucher ?', answer: '30 % du montant hors taxes encaissé pendant les 12 premiers mois de chaque client que vous nous apportez, puis 10 % tant qu’il reste abonné, sans limite de durée.' },
  { question: 'Comment un client m’est-il attribué ?', answer: 'Par votre lien personnel, ou parce que vous nous l’avez présenté vous-même. En cas de doute, nous en parlons avec vous avant la signature.' },
  { question: 'Faut-il être expert en IA ?', answer: 'Non. Vous recommandez, nous installons et accompagnons. Vos clients sont suivis par l’équipe Aissociate à La Réunion.' },
  { question: 'Mes contacts doivent-ils payer pour essayer ?', answer: 'Non. Ils commencent en stage gratuit, sans limite de durée ni carte bancaire. C’est ce qui rend la recommandation facile.' },
  { question: 'Puis-je l’utiliser pour mes propres clients ?', answer: 'Oui, c’est même le cas le plus courant : un cabinet ou une agence qui équipe ses clients et touche une commission sur leurs contrats.' },
  { question: 'Quand suis-je payé ?', answer: 'Les commissions sont calculées sur les sommes réellement encaissées. Le rythme et les modalités de versement figurent dans votre contrat de partenariat.' },
];

export default function Affiliation() {
  const [clients, setClients] = useState(10);
  const [annees, setAnnees] = useState(5);
  const [contratId, setContratId] = useState(PAYANTS.find((c) => c.id === 'plein')?.id ?? PAYANTS[0].id);
  const [etat, setEtat] = useState<'idle' | 'envoi' | 'ok' | 'erreur'>('idle');
  const [erreur, setErreur] = useState('');
  const [piege, setPiege] = useState('');
  const [ouvertLe] = useState(() => Date.now());

  const calcul = useMemo(() => {
    const c = PAYANTS.find((x) => x.id === contratId) ?? PAYANTS[0];
    const annuel = clients * c.prix * 12;
    const an1 = annuel * TAUX_AN_1;
    const ensuite = annuel * TAUX_ENSUITE;
    // Année par année sur la durée de vie choisie : 30 % la 1re, 10 % les suivantes.
    const parAn = Array.from({ length: annees }, (_, i) => (i === 0 ? an1 : ensuite));
    const total = parAn.reduce((s, x) => s + x, 0);
    return { c, an1, ensuite, mois1: an1 / 12, moisEnsuite: ensuite / 12, parAn, total };
  }, [clients, contratId, annees]);

  const allerA = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const envoyer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (piege || Date.now() - ouvertLe < 3000) { setEtat('ok'); return; }
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? '').trim();
    setEtat('envoi'); setErreur('');
    const { error } = await supabase.from('contact_requests').insert([{
      first_name: v('prenom') || null,
      last_name: v('nom'),
      email: v('email').toLowerCase() || null,
      phone: v('tel'),
      company: v('societe') || null,
      request_type: 'Partenariat (affiliation)',
      message: `Candidature au programme partenaires du Studio IA. Profil : ${v('profil')}. Réseau : ${v('reseau')}.`
        + (v('site') ? ` Site ou profil : ${v('site')}.` : '')
        + (v('message') ? ` Message : ${v('message')}` : ''),
      source: window.location.pathname, status: 'new',
    }]);
    if (error) { setErreur(error.message); setEtat('erreur'); return; }
    setEtat('ok');
  };

  const Postuler = ({ texte = 'Devenir partenaire' }: { texte?: string }) => (
    <button type="button" onClick={() => allerA('candidature')}
      className="inline-flex items-center gap-2 bg-orange-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-orange-400">
      {texte} <ArrowRight className="h-4 w-4" />
    </button>
  );

  const champ = 'mt-1 block w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-orange-500';

  return (
    <>
      <SEO
        title="Programme partenaires Studio IA : 30 % la première année, 10 % ensuite | Aissociate"
        description="Recommandez le Studio IA d'Aissociate à vos clients et à votre réseau : 30 % du montant encaissé la première année, puis 10 % tant que le client reste abonné. Experts-comptables, consultants, agences, formateurs à La Réunion et ailleurs."
        keywords="programme affiliation IA, apporteur d'affaires IA, partenariat agents IA, commission récurrente, affiliation SaaS La Réunion"
        url={`${SITE_URL}/affiliation/`}
        breadcrumbs={[{ name: 'Accueil', url: SITE_URL }, { name: 'Programme partenaires', url: `${SITE_URL}/affiliation/` }]}
        faqData={FAQ}
      />
      <Header />
      <main id="contenu" className="bg-[#F2ECE4] font-sans text-neutral-900">

        {/* ── Accroche ── */}
        <section className="bg-neutral-950 text-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-orange-400">Programme partenaires · Studio IA</p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                Recommandez le Studio IA.<br />
                Touchez <span className="text-orange-400">30&nbsp;%</span> la première année, puis 10&nbsp;% tant que votre client reste.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-neutral-300">
                Vos clients et votre réseau cherchent du temps. Vous leur présentez une équipe d’agents IA qu’ils essaient gratuitement ;
                nous les installons et les accompagnons. Vous touchez une commission sur chaque mois payé.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Postuler />
                <button type="button" onClick={() => allerA('simulateur')}
                  className="inline-flex items-center gap-2 border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/10">
                  <Calculator className="h-4 w-4" /> Simuler mes revenus
                </button>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px bg-white/15">
              {[
                ['30 %', 'du montant encaissé les 12 premiers mois'],
                ['10 %', 'ensuite, tant que le client reste abonné'],
                ['0 €', 'pour essayer : vos contacts commencent en stage gratuit'],
                ['974', 'une équipe à La Réunion qui accompagne vos clients'],
              ].map(([chiffre, texte]) => (
                <div key={chiffre} className="bg-neutral-950 p-6">
                  <dt className="font-display text-4xl font-extrabold tracking-tight text-orange-400">{chiffre}</dt>
                  <dd className="mt-2 text-sm text-neutral-300">{texte}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Simulateur ── */}
        <section id="simulateur" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-8">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-orange-600">Simulateur</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Combien pourriez-vous gagner ?</h2>
          <div className="mt-10 grid gap-px bg-neutral-300 lg:grid-cols-2">
            <div className="space-y-8 bg-white p-8">
              <div>
                <label htmlFor="sim-clients" className="flex items-baseline justify-between text-sm font-medium">
                  Clients apportés <span className="font-display text-2xl font-extrabold">{clients}</span>
                </label>
                <input id="sim-clients" type="range" min={1} max={100} value={clients}
                  onChange={(e) => setClients(Number(e.target.value))} className="mt-3 w-full accent-orange-500" />
              </div>
              <fieldset>
                <legend className="text-sm font-medium">Contrat moyen de vos clients</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {PAYANTS.map((c) => (
                    <label key={c.id} className={`cursor-pointer border px-4 py-3 text-sm ${contratId === c.id ? 'border-orange-500 bg-orange-50' : 'border-neutral-300'}`}>
                      <input type="radio" name="sim-contrat" value={c.id} checked={contratId === c.id} onChange={() => setContratId(c.id)} className="sr-only" />
                      <span className="block font-semibold">{c.nom}</span>
                      <span className="text-neutral-600">{c.prix} € HT/mois</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="sim-annees" className="flex items-baseline justify-between text-sm font-medium">
                  Durée de vie moyenne d’un client
                  <span className="font-display text-2xl font-extrabold">{annees} an{annees > 1 ? 's' : ''}</span>
                </label>
                <input id="sim-annees" type="range" min={1} max={10} value={annees}
                  onChange={(e) => setAnnees(Number(e.target.value))} className="mt-3 w-full accent-orange-500" />
                <p className="mt-2 text-xs text-neutral-500">30 % la première année, puis 10 % chaque année tant que le client reste abonné, sans limite de durée.</p>
              </div>
            </div>
            <div className="flex flex-col justify-between gap-6 bg-neutral-950 p-8 text-white" aria-live="polite">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-neutral-400">1re année · 30 %</p>
                  <p className="font-display text-4xl font-extrabold tracking-tight text-orange-400">{eur(calcul.an1)}</p>
                  <p className="mt-1 text-sm text-neutral-300">{eur(calcul.mois1)} par mois</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-400">Années suivantes · 10 %</p>
                  <p className="font-display text-4xl font-extrabold tracking-tight">{eur(calcul.ensuite)}</p>
                  <p className="mt-1 text-sm text-neutral-300">{eur(calcul.moisEnsuite)} par mois</p>
                </div>
              </div>
              {/* Année par année : la hauteur des barres suit le montant. */}
              <div aria-hidden="true" className="flex h-24 items-end gap-1.5">
                {calcul.parAn.map((m, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className={`w-full ${i === 0 ? 'bg-orange-400' : 'bg-white/30'}`}
                      style={{ height: `${Math.max(4, (m / (calcul.an1 || 1)) * 80)}px` }} />
                    <span className="text-[10px] text-neutral-500">A{i + 1}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/15 pt-5">
                <p className="text-sm text-neutral-400">Total sur la durée de vie ({annees} an{annees > 1 ? 's' : ''})</p>
                <p className="font-display text-5xl font-extrabold tracking-tight text-orange-400">{eur(calcul.total)}</p>
              </div>
              <p className="text-xs text-neutral-500">
                Estimation pour {clients} client{clients > 1 ? 's' : ''} en contrat {calcul.c.nom.toLowerCase()} mensuel, tous abonnés pendant {annees} an{annees > 1 ? 's' : ''}.
                Commission calculée sur le montant HT encaissé, hors avenants.
              </p>
            </div>
          </div>
          <div className="mt-8"><Postuler texte="Je veux ces revenus : je candidate" /></div>
        </section>

        {/* ── Pourquoi ── */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Un produit facile à recommander. Des revenus qui durent.</h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {[
                { i: Repeat, t: 'Des commissions récurrentes', d: '30 % la première année, puis 10 % chaque mois tant que le client reste. Un client fidèle vous rapporte pendant des années.' },
                { i: BadgeCheck, t: 'Un essai sans risque', d: 'Vos contacts commencent en stage gratuit, sans carte bancaire ni limite de durée. Recommander ne leur coûte rien.' },
                { i: Handshake, t: 'Nous faisons le reste', d: 'Installation, accompagnement, support : vos clients sont suivis par Aissociate, organisme certifié Qualiopi à La Réunion.' },
              ].map(({ i: I, t, d }) => (
                <div key={t} className="border-t-2 border-neutral-900 pt-5">
                  <I className="h-6 w-6 text-orange-600" />
                  <h3 className="mt-4 text-xl font-semibold">{t}</h3>
                  <p className="mt-2 text-neutral-600">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pour qui ── */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pour qui ?</h2>
          <p className="mt-3 max-w-2xl text-lg text-neutral-700">Pour celles et ceux qui conseillent déjà des dirigeants de TPE et de PME.</p>
          <div className="mt-10 grid gap-px bg-neutral-300 sm:grid-cols-2 lg:grid-cols-3">
            {PROFILS.map(({ icone: I, titre, texte }) => (
              <div key={titre} className="bg-[#F2ECE4] p-6">
                <I className="h-6 w-6 text-neutral-900" />
                <h3 className="mt-4 font-semibold">{titre}</h3>
                <p className="mt-2 text-sm text-neutral-600">{texte}</p>
              </div>
            ))}
          </div>
          {/* Seul accès au test commercial : les autres profils passent par le formulaire de candidature. */}
          <div className="mt-px flex flex-col gap-6 bg-neutral-950 p-6 text-white sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-orange-400">Commerciaux indépendants</p>
              <h3 className="mt-2 text-2xl font-semibold">Vous prospectez et signez pour vivre ?</h3>
              <p className="mt-2 max-w-2xl text-neutral-300">
                Votre candidature passe par un test commercial en ligne de 20 à 25 minutes : profil, mises en situation, calculs et réponses écrites.
              </p>
            </div>
            <Link to="/affiliation/test"
              className="inline-flex shrink-0 items-center gap-2 bg-orange-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-orange-400">
              Passer le test commercial <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── Étapes ── */}
        <section className="bg-neutral-950 py-20 text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Trois étapes, pas plus.</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {ETAPES.map((e, i) => (
                <li key={e.t}>
                  <span className="font-display text-5xl font-extrabold text-orange-400">{i + 1}</span>
                  <h3 className="mt-3 text-xl font-semibold">{e.t}</h3>
                  <p className="mt-2 text-neutral-300">{e.d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10"><Postuler /></div>
          </div>
        </section>

        {/* ── Candidature ── */}
        <section id="candidature" className="mx-auto grid max-w-6xl scroll-mt-20 gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-orange-600">Candidature</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Devenez partenaire du Studio IA.</h2>
            <p className="mt-4 text-lg text-neutral-700">Nous lisons chaque candidature et vous rappelons pour faire connaissance.</p>
            <ul className="mt-6 space-y-3 text-neutral-700">
              {['30 % la première année, 10 % ensuite', 'Un lien personnel et des supports de présentation', 'Un interlocuteur Aissociate à La Réunion'].map((t) => (
                <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" /> {t}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white p-6 sm:p-8">
            {etat === 'ok' ? (
              <div role="status">
                <Check className="h-8 w-8 text-orange-600" />
                <p className="mt-4 text-xl font-semibold">Merci, votre candidature est bien arrivée.</p>
                <p className="mt-2 text-neutral-600">Nous vous rappelons sous peu pour en parler.</p>
              </div>
            ) : (
              <form onSubmit={envoyer} className="relative grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">Prénom<input name="prenom" required autoComplete="given-name" className={champ} /></label>
                <label className="text-sm font-medium">Nom<input name="nom" required autoComplete="family-name" className={champ} /></label>
                <label className="text-sm font-medium">E-mail<input name="email" type="email" required autoComplete="email" className={champ} /></label>
                <label className="text-sm font-medium">Téléphone<input name="tel" type="tel" required autoComplete="tel" className={champ} /></label>
                <label className="text-sm font-medium">Entreprise<input name="societe" autoComplete="organization" className={champ} /></label>
                <label className="text-sm font-medium">Site ou profil LinkedIn<input name="site" type="text" className={champ} /></label>
                <label className="text-sm font-medium">Vous êtes
                  <select name="profil" required defaultValue="" className={champ}>
                    <option value="" disabled>Choisir</option>
                    {PROFILS.map((p) => <option key={p.titre}>{p.titre}</option>)}
                    <option>Autre</option>
                  </select>
                </label>
                <label className="text-sm font-medium">Taille de votre réseau
                  <select name="reseau" required defaultValue="" className={champ}>
                    <option value="" disabled>Choisir</option>
                    <option>Moins de 20 clients ou contacts dirigeants</option>
                    <option>20 à 100</option>
                    <option>100 à 500</option>
                    <option>Plus de 500</option>
                  </select>
                </label>
                <label className="text-sm font-medium sm:col-span-2">Un mot sur votre activité (facultatif)
                  <textarea name="message" rows={3} className={champ} />
                </label>
                {/* Piège à robots : invisible pour un humain. */}
                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <label htmlFor="af-url">Adresse</label>
                  <input id="af-url" name="url" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
                </div>
                {etat === 'erreur' && <p role="alert" className="text-sm text-red-700 sm:col-span-2">Envoi impossible : {erreur}. Écrivez-nous à contact@aissociate.re.</p>}
                <button type="submit" disabled={etat === 'envoi'}
                  className="flex items-center justify-center gap-2 bg-orange-500 py-3 text-sm font-semibold text-neutral-950 hover:bg-orange-400 disabled:opacity-60 sm:col-span-2">
                  {etat === 'envoi' ? 'Envoi en cours…' : 'Envoyer ma candidature'} <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-8">
            <h2 className="text-3xl font-semibold tracking-tight">Vos questions, nos réponses.</h2>
            <dl className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
              {FAQ.map((q) => (
                <div key={q.question} className="py-5">
                  <dt className="font-semibold">{q.question}</dt>
                  <dd className="mt-2 text-neutral-600">{q.answer}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Postuler />
              <a href="/" className="inline-flex items-center gap-2 border border-neutral-300 px-6 py-3 text-sm font-semibold hover:bg-neutral-50">
                Découvrir le Studio IA
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
