import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO, { SITE_URL } from '../components/SEO';
import { supabase } from '@/lib/supabase';
import { CALC, OPEN, PROFIL, SJT, duree, parseNombre, rapportCRM, type Reponses } from '../data/testCommercial';

/**
 * Test commercial des candidats partenaires (/affiliation/test), réservé aux commerciaux indépendants
 * (bouton dédié sur /affiliation ; les autres profils passent par le formulaire de candidature).
 * À la fin, les réponses et la note partent dans contact_requests (type « Partenariat (test commercial) ») :
 * le déclencheur lead_to_contact en fait un prospect + une opportunité dans le CRM, rapport complet dans le besoin.
 * La note n'est jamais montrée au candidat. Les réponses sont gardées dans le navigateur s'il ferme la page.
 */
const CLE = 'ais-test-commercial-site-v1';
const ETAPES = ['intro', 'profil', 'sjt', 'calc', 'open', 'fin'] as const;
type Etape = (typeof ETAPES)[number];
const LIBELLES: Partial<Record<Etape, string>> = { profil: 'Profil', sjt: 'Situations', calc: 'Calculs', open: 'Écrit' };

const IDENTITE = [
  { k: 'prenom', l: 'Prénom', type: 'text', ac: 'given-name' },
  { k: 'nom', l: 'Nom', type: 'text', ac: 'family-name' },
  { k: 'email', l: 'E-mail', type: 'email', ac: 'email' },
  { k: 'tel', l: 'Téléphone', type: 'tel', ac: 'tel' },
  { k: 'commune', l: 'Commune de résidence', type: 'text', ac: 'address-level2' },
  { k: 'linkedin', l: 'Profil LinkedIn (facultatif)', type: 'text', ac: 'off', facultatif: true },
];

type Etat = Reponses & { etape: Etape; ordre: Record<string, string[]>; envoye?: boolean };

const melanger = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const neuf = (): Etat => ({
  etape: 'intro', identite: {}, profil: {}, sjt: {}, calc: {}, open: {},
  ordre: Object.fromEntries(SJT.map((q) => [q.id, melanger(q.o.map((o) => o.k))])),
});
function charger(): Etat {
  try { const s = JSON.parse(localStorage.getItem(CLE) || 'null'); if (s && s.ordre && s.identite) return s; } catch { /* stockage indisponible */ }
  return neuf();
}

const champ = 'mt-1 block w-full border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none focus:border-orange-500';

function Choix({ name, legende, numero, options, valeur, onChange }: {
  name: string; legende: string; numero?: string; options: { k: string; t: string }[]; valeur?: string; onChange: (k: string) => void;
}) {
  return (
    <fieldset className="border-t border-neutral-300 pt-6 first:border-0 first:pt-0">
      <legend className="w-full">
        {numero && <span className="block font-mono text-xs uppercase tracking-[0.12em] text-orange-700">{numero}</span>}
        <span className={numero ? 'mt-1 block text-lg' : 'block font-semibold'}>{legende}</span>
      </legend>
      <div className="mt-3 grid gap-2">
        {options.map((o) => (
          <label key={o.k} className={`flex cursor-pointer items-start gap-3 border px-4 py-3 text-sm ${valeur === o.k ? 'border-orange-500 bg-orange-50' : 'border-neutral-300 bg-white hover:border-neutral-500'}`}>
            <input type="radio" name={name} value={o.k} checked={valeur === o.k} onChange={() => onChange(o.k)} className="mt-0.5 h-4 w-4 shrink-0 accent-orange-500" />
            <span>{o.t}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Chrono à part : son tic chaque seconde ne redessine pas tout le test. */
function Chrono({ debut }: { debut: number }) {
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setMaintenant(Date.now()), 1000); return () => clearInterval(t); }, []);
  return <p className="mt-2 text-right font-mono text-xs text-neutral-500">Temps écoulé : {duree(maintenant - debut)}</p>;
}

export default function AffiliationTest() {
  const [st, setSt] = useState<Etat>(charger);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [piege, setPiege] = useState('');
  const titre = useRef<HTMLHeadingElement>(null);

  useEffect(() => { try { localStorage.setItem(CLE, JSON.stringify(st)); } catch { /* stockage indisponible */ } }, [st]);

  const maj = <K extends 'identite' | 'profil' | 'sjt' | 'calc' | 'open'>(bloc: K, k: string, v: string) =>
    setSt((s) => ({ ...s, [bloc]: { ...s[bloc], [k]: v } }));

  const aller = (etape: Etape) => {
    setErreur('');
    setSt((s) => ({ ...s, etape }));
    window.scrollTo({ top: 0 });
    setTimeout(() => titre.current?.focus({ preventScroll: true }), 0);
  };

  const valider = (): string => {
    if (st.etape === 'profil') {
      const manque = IDENTITE.filter((c) => !c.facultatif && !(st.identite[c.k] || '').trim());
      if (manque.length) return `Merci de compléter : ${manque.map((c) => c.l).join(', ')}.`;
      if (!/^\S+@\S+\.\S+$/.test(st.identite.email || '')) return 'L’adresse e-mail semble incorrecte.';
      const m = PROFIL.filter((p) => !st.profil[p.k]).length;
      if (m) return `Il reste ${m} question(s) sans réponse.`;
    }
    if (st.etape === 'sjt') { const m = SJT.filter((q) => !st.sjt[q.id]).length; if (m) return `Il reste ${m} situation(s) sans réponse.`; }
    if (st.etape === 'calc' && CALC.some((c) => isNaN(parseNombre(st.calc[c.id])))) return 'Répondez à chaque calcul par un nombre.';
    if (st.etape === 'open' && OPEN.some((o) => o.min && (st.open[o.id] || '').trim().length < o.min))
      return 'Développez un peu plus votre réponse (voir le minimum indiqué sous chaque champ).';
    return '';
  };

  const envoyer = async (d: Etat) => {
    if (piege) { aller('fin'); return; }
    setEnvoi(true); setErreur('');
    const { texte, score } = rapportCRM(d);
    const I = d.identite;
    const { error } = await supabase.from('contact_requests').insert([{
      first_name: I.prenom?.trim() || null,
      last_name: I.nom?.trim() || '',
      email: (I.email || '').trim().toLowerCase(),
      phone: I.tel?.trim() || '',
      company: null,
      request_type: `Partenariat (test commercial) — ${score.global}/100, ${score.verdict}`,
      message: texte,
      source: '/affiliation/test',
      status: 'new',
    }]);
    setEnvoi(false);
    if (error) { setErreur(`Envoi impossible : ${error.message}`); return; }
    setSt((s) => ({ ...s, envoye: true }));
    aller('fin');
  };

  const suivant = async () => {
    const e = valider();
    if (e) { setErreur(e); return; }
    if (st.etape === 'open') {
      const d = { ...st, fin: st.fin ?? Date.now() };
      setSt(d);
      await envoyer(d);
      return;
    }
    aller(ETAPES[ETAPES.indexOf(st.etape) + 1]);
  };

  const idx = ETAPES.indexOf(st.etape);
  const enCours = st.debut && st.etape !== 'intro' && st.etape !== 'fin';
  const precedent = ETAPES[idx - 1];

  const nav = (libelle = 'Continuer') => (
    <>
      {erreur && <p role="alert" className="mt-6 font-medium text-red-700">{erreur}</p>}
      <div className="mt-8 flex flex-wrap justify-between gap-3">
        <button type="button" onClick={() => aller(precedent)} className="inline-flex items-center gap-2 border border-neutral-300 px-5 py-3 text-sm font-semibold hover:bg-white">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <button type="button" onClick={suivant} disabled={envoi} className="inline-flex items-center gap-2 bg-orange-500 px-6 py-3 text-sm font-semibold text-neutral-950 hover:bg-orange-400 disabled:opacity-60">
          {envoi ? 'Envoi en cours…' : libelle} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </>
  );

  const enTete = (sur: string, h: string, p: string) => (
    <div className="mb-8">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-orange-700">{sur}</p>
      <h1 ref={titre} tabIndex={-1} className="mt-2 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">{h}</h1>
      <p className="mt-3 max-w-2xl text-neutral-700">{p}</p>
    </div>
  );

  return (
    <>
      <SEO
        title="Test commercial · Programme partenaires Studio IA | Aissociate"
        description="Le test de candidature au programme partenaires du Studio IA d'Aissociate : profil, mises en situation, calculs et réponses écrites."
        url={`${SITE_URL}/affiliation/test/`}
        noindex
      />
      <Header />
      <main id="contenu" className="bg-[#F2ECE4] font-sans text-neutral-900">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8 sm:py-16">
          {st.etape !== 'intro' && st.etape !== 'fin' && (
            <div className="mb-8">
              <ol className="flex gap-1.5" aria-label="Progression">
                {(Object.keys(LIBELLES) as Etape[]).map((k) => {
                  const i = ETAPES.indexOf(k);
                  return (
                    <li key={k} aria-current={i === idx ? 'step' : undefined}
                      className={`flex-1 border-t-4 pt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] ${i === idx ? 'border-orange-500 text-neutral-900' : i < idx ? 'border-orange-700 text-neutral-500' : 'border-neutral-300 text-neutral-500'}`}>
                      {LIBELLES[k]}
                    </li>
                  );
                })}
              </ol>
              {enCours && <Chrono debut={st.debut as number} />}
            </div>
          )}

          {st.etape === 'intro' && (
            <section>
              <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-orange-700">Programme partenaires · La Réunion · 100 % à distance</p>
              <h1 ref={titre} tabIndex={-1} className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight outline-none sm:text-5xl">
                Commercial indépendant (H/F) <span className="text-orange-600">Agents IA</span>
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-neutral-700">
                Aissociate déploie des « employés virtuels » IA dans les TPE et PME réunionnaises : un assistant qui prend en charge
                les devis, les relances, les réponses aux clients et les publications. Nous cherchons des partenaires pour prospecter,
                décrocher des rendez-vous et signer.
              </p>
              <dl className="mt-8 grid gap-px bg-neutral-300 sm:grid-cols-3">
                {[
                  ['Commission', '30 % du montant encaissé la première année, puis 10 % tant que le client reste abonné'],
                  ['Essai sans risque', 'Vos prospects commencent en stage gratuit, sans carte bancaire'],
                  ['Autonomie', 'Statut indépendant, vous organisez votre temps'],
                ].map(([t, d]) => (
                  <div key={t} className="bg-white p-5"><dt className="font-semibold">{t}</dt><dd className="mt-1 text-sm text-neutral-600">{d}</dd></div>
                ))}
              </dl>
              <div className="mt-8 bg-white p-6">
                <h2 className="text-xl font-semibold">Comment se déroule le test</h2>
                <ul className="mt-3 space-y-1.5 text-neutral-700">
                  <li><b>Votre profil</b> : statut, disponibilité, expérience.</li>
                  <li><b>{SJT.length} mises en situation</b> : choisissez la réaction qui vous ressemble le plus.</li>
                  <li><b>{CALC.length} calculs rapides</b> : commissions et objectifs.</li>
                  <li><b>4 réponses écrites</b> : votre pitch, une objection, votre organisation, vos motivations.</li>
                </ul>
                <p className="mt-4 text-sm text-neutral-600">
                  Comptez 20 à 25 minutes. Vos réponses sont gardées sur cet appareil si vous fermez la page.
                  À la fin, elles nous sont envoyées directement.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => { setSt((s) => ({ ...s, debut: s.debut ?? Date.now() })); aller('profil'); }}
                  className="inline-flex items-center gap-2 bg-orange-500 px-6 py-3 text-sm font-semibold text-neutral-950 hover:bg-orange-400">
                  {st.debut ? 'Reprendre le test' : 'Commencer le test'} <ArrowRight className="h-4 w-4" />
                </button>
                <Link to="/affiliation" className="text-sm font-semibold underline underline-offset-4">Revoir le programme partenaires</Link>
              </div>
            </section>
          )}

          {st.etape === 'profil' && (
            <section>
              {enTete('Étape 1 sur 4', 'Votre profil', 'Soyez précis : ces informations servent à préparer l’entretien.')}
              <div className="grid gap-4 sm:grid-cols-2">
                {IDENTITE.map((c) => (
                  <label key={c.k} className="text-sm font-medium">{c.l}
                    <input type={c.type} autoComplete={c.ac} value={st.identite[c.k] || ''} onChange={(e) => maj('identite', c.k, e.target.value)} className={champ} />
                  </label>
                ))}
              </div>
              {/* Piège à robots : invisible pour un humain. */}
              <div className="absolute -left-[9999px]" aria-hidden="true">
                <label htmlFor="tc-url">Adresse</label>
                <input id="tc-url" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
              </div>
              <div className="mt-10 space-y-6">
                {PROFIL.map((p) => (
                  <Choix key={p.k} name={`p-${p.k}`} legende={p.q} options={p.opts} valeur={st.profil[p.k]} onChange={(v) => maj('profil', p.k, v)} />
                ))}
              </div>
              {nav()}
            </section>
          )}

          {st.etape === 'sjt' && (
            <section>
              {enTete('Étape 2 sur 4', 'Mises en situation', 'Pour chaque situation, choisissez la réaction la plus proche de ce que vous feriez réellement. Il n’y a pas de piège de formulation.')}
              <div className="space-y-6">
                {SJT.map((q, i) => (
                  <Choix key={q.id} name={`s-${q.id}`} numero={`Situation ${i + 1} / ${SJT.length}`} legende={q.q}
                    options={(st.ordre[q.id] || q.o.map((o) => o.k)).map((k) => q.o.find((o) => o.k === k)!).filter(Boolean)}
                    valeur={st.sjt[q.id]} onChange={(v) => maj('sjt', q.id, v)} />
                ))}
              </div>
              {nav()}
            </section>
          )}

          {st.etape === 'calc' && (
            <section>
              {enTete('Étape 3 sur 4', 'Calculs rapides', 'Les montants sont des exemples fictifs. Répondez par un nombre ; la calculatrice est autorisée.')}
              <div className="space-y-6">
                {CALC.map((c, i) => (
                  <div key={c.id} className="border-t border-neutral-300 pt-6 first:border-0 first:pt-0">
                    <span className="block font-mono text-xs uppercase tracking-[0.12em] text-orange-700">Calcul {i + 1} / {CALC.length}</span>
                    <label htmlFor={`c-${c.id}`} className="mt-1 block text-lg">{c.q}</label>
                    <div className="mt-3 flex max-w-xs items-center gap-3">
                      <input id={`c-${c.id}`} type="text" inputMode="decimal" value={st.calc[c.id] || ''} onChange={(e) => maj('calc', c.id, e.target.value)} className={`${champ} mt-0`} />
                      <span className="text-neutral-600">{c.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              {nav()}
            </section>
          )}

          {st.etape === 'open' && (
            <section>
              {enTete('Étape 4 sur 4', 'Vos réponses écrites', 'Écrivez comme vous parleriez au prospect. Pas besoin d’être long : soyez concret.')}
              <div className="space-y-6">
                {OPEN.map((o, i) => {
                  const n = (st.open[o.id] || '').trim().length;
                  return (
                    <div key={o.id} className="border-t border-neutral-300 pt-6 first:border-0 first:pt-0">
                      <span className="block font-mono text-xs uppercase tracking-[0.12em] text-orange-700">Question {i + 1} / {OPEN.length}</span>
                      <label htmlFor={`o-${o.id}`} className="mt-1 block text-lg">{o.q}</label>
                      <textarea id={`o-${o.id}`} rows={6} value={st.open[o.id] || ''} onChange={(e) => maj('open', o.id, e.target.value)} className={champ} />
                      <p className={`mt-1 text-right font-mono text-xs ${o.min && n >= o.min ? 'text-green-700' : 'text-neutral-500'}`}>
                        {n} caractères{o.min && n < o.min ? ` · minimum ${o.min}` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
              {nav('Terminer et envoyer')}
            </section>
          )}

          {st.etape === 'fin' && (
            <section role="status">
              <Check className="h-10 w-10 text-orange-600" />
              <h1 ref={titre} tabIndex={-1} className="mt-4 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">Merci, vos réponses nous sont parvenues.</h1>
              <p className="mt-4 max-w-2xl text-lg text-neutral-700">
                Nous revenons vers chaque candidat sous quelques jours ouvrés. Les candidats retenus passent un entretien de 30 minutes
                avec une mise en situation téléphonique.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/affiliation" className="inline-flex items-center gap-2 border border-neutral-300 px-6 py-3 text-sm font-semibold hover:bg-white">Retour au programme partenaires</Link>
                <Link to="/" className="inline-flex items-center gap-2 bg-orange-500 px-6 py-3 text-sm font-semibold text-neutral-950 hover:bg-orange-400">Découvrir le Studio IA <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
