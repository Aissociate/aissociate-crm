// Questionnaire d'onboarding public (/studio/demarrer) : la demande arrive dans
// CRM › Studio IA clients › Demandes, notée /100, avec un lead dans le CRM.
// La définition des questions est partagée avec l'Edge Function (source unique).
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { appel } from '../api';
import { Bouton, cx } from '../composants';
import { AGENTS_CATALOGUE, SECTIONS, type Question, type Reponses } from '../../../supabase/functions/studio/questionnaire';

const BROUILLON = 'studio.questionnaire';
const champ = 'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 focus:bg-white';

type Contact = { contact_nom: string; email: string; telephone: string };

function lireBrouillon(): { reponses: Reponses; contact: Contact } {
  try {
    const b = JSON.parse(localStorage.getItem(BROUILLON) ?? '');
    if (b && typeof b === 'object') return { reponses: b.reponses ?? {}, contact: { contact_nom: '', email: '', telephone: '', ...b.contact } };
  } catch { /* brouillon absent ou stockage bloqué */ }
  return { reponses: {}, contact: { contact_nom: '', email: '', telephone: '' } };
}

function ChampQuestion({ q, valeur, onChange }: { q: Question; valeur: Reponses[string]; onChange: (v: string | string[]) => void }) {
  const v = Array.isArray(valeur) ? valeur : String(valeur ?? '');
  if (q.type === 'multi') {
    const choisis = Array.isArray(valeur) ? valeur : [];
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {AGENTS_CATALOGUE.map((a) => {
          const actif = choisis.includes(a.id);
          return (
            <button key={a.id} type="button" aria-pressed={actif}
              onClick={() => onChange(actif ? choisis.filter((x) => x !== a.id) : [...choisis, a.id])}
              className={cx('flex items-center gap-3 rounded-xl border p-2.5 text-left text-sm transition-colors',
                actif ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white hover:border-neutral-400')}>
              <img src={`/agents-ia/studio/${a.id}.webp`} alt="" width={40} height={40} className="h-10 w-10 rounded-full bg-neutral-100 object-cover object-top" />
              <span className="flex-1">{a.libelle}</span>
              {actif && <Check className="h-4 w-4" />}
            </button>
          );
        })}
      </div>
    );
  }
  if (q.type === 'ouinon' || q.type === 'choix') {
    const options = q.type === 'ouinon' ? ['oui', 'non'] : q.options ?? [];
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={v === o} onClick={() => onChange(v === o ? '' : o)}
            className={cx('rounded-full border px-4 py-1.5 text-sm capitalize transition-colors',
              v === o ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white hover:border-neutral-400')}>
            {o}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === 'long') return <textarea rows={3} className={champ} value={v as string} onChange={(e) => onChange(e.target.value)} />;
  return (
    <input className={champ} value={v as string} onChange={(e) => onChange(e.target.value)}
      type={q.type === 'date' ? 'date' : 'text'} inputMode={q.type === 'nombre' || q.type === 'montant' ? 'decimal' : undefined} />
  );
}

export default function Questionnaire() {
  const [params] = useSearchParams();
  const initial = useMemo(lireBrouillon, []);
  const [reponses, setReponses] = useState<Reponses>(() => {
    // Agent présélectionné depuis la page de vente (?agent=hugo).
    const pre = params.get('agent');
    const r = { ...initial.reponses };
    if (pre && AGENTS_CATALOGUE.some((a) => a.id === pre) && !(r.agents as string[] | undefined)?.length) r.agents = [pre];
    return r;
  });
  const [contact, setContact] = useState<Contact>(initial.contact);
  const [etape, setEtape] = useState(0);
  const [accord, setAccord] = useState(false);
  const [piege, setPiege] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState<'' | 'essai' | 'essai_sans_mail' | 'deja_client' | 'demande'>('');

  useEffect(() => { document.title = 'Démarrer avec le Studio IA — Aissociate'; }, []);
  useEffect(() => {
    try { localStorage.setItem(BROUILLON, JSON.stringify({ reponses, contact })); } catch { /* stockage bloqué */ }
  }, [reponses, contact]);

  const section = SECTIONS[etape];
  const derniere = etape === SECTIONS.length - 1;

  const manquante = (): string | null => {
    if (etape === 0) {
      if (!contact.contact_nom.trim()) return 'Indiquez votre nom.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) return 'Indiquez une adresse e-mail valide.';
    }
    const q = section.questions.find((x) => {
      const v = reponses[x.id];
      return x.requis && (Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim());
    });
    return q ? `Réponse manquante : ${q.libelle}` : null;
  };

  const suivant = async () => {
    const m = manquante();
    if (m) { setErreur(m); return; }
    setErreur('');
    if (!derniere) { setEtape(etape + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!accord) { setErreur('Cochez la case d\'accord pour ouvrir votre essai.'); return; }
    setEnvoi(true);
    try {
      const r = await appel<{ essai?: boolean; identifiants_envoyes?: boolean; deja_client?: boolean }>('onboarding_soumettre', {
        ...contact, reponses, accord, site_web_entreprise: piege, depuis: params.get('depuis') ?? document.referrer.slice(0, 60),
      });
      try { localStorage.removeItem(BROUILLON); } catch { /* */ }
      setFini(r.essai ? (r.identifiants_envoyes ? 'essai' : 'essai_sans_mail') : r.deja_client ? 'deja_client' : 'demande');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Envoi impossible');
    } finally { setEnvoi(false); }
  };

  if (fini) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f6f4] px-4 font-sans">
        <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-6 w-6" /></div>
          <h1 className="text-2xl font-semibold">{fini === 'essai' ? 'Votre Studio est prêt !' : 'Merci, c\'est bien reçu !'}</h1>
          <p className="mt-3 text-sm text-neutral-600">
            {fini === 'essai' && <>Vos identifiants viennent de vous être envoyés par e-mail (pensez à vérifier les indésirables). Votre essai gratuit de 7 jours démarre aujourd'hui : vos agents vous attendent déjà.</>}
            {fini === 'essai_sans_mail' && <>Votre espace d'essai est créé, mais l'e-mail avec vos identifiants n'a pas pu partir. Nous vous les envoyons au plus vite : écrivez-nous à contact@aissociate.re si vous ne les recevez pas.</>}
            {fini === 'deja_client' && <>Cette adresse e-mail a déjà un accès au Studio : connectez-vous avec vos identifiants habituels (ou « Mot de passe oublié ? » sur la page de connexion).</>}
            {fini === 'demande' && <>Nous étudions vos réponses et revenons vers vous sous 48 h ouvrées avec votre plan de démarrage. Vos identifiants d'accès au Studio vous seront transmis dès que votre espace sera prêt.</>}
          </p>
          {fini === 'essai' || fini === 'deja_client'
            ? <Link to="/studio/connexion" className="mt-6 inline-block rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Se connecter</Link>
            : <Link to="/agents-ia" className="mt-6 inline-block text-sm text-neutral-500 underline">Retour à la présentation</Link>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f4] font-sans text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/agents-ia" className="text-lg font-bold">A(I)ssociate <span className="text-orange-500">Studio</span></Link>
          <span className="text-xs text-neutral-500">Étape {etape + 1} sur {SECTIONS.length}</span>
        </div>
        <div className="h-1 bg-neutral-100"><div className="h-1 bg-orange-500 transition-all" style={{ width: `${((etape + 1) / SECTIONS.length) * 100}%` }} /></div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {etape === 0 && (
          <p className="mb-6 text-sm text-neutral-600">
            <b className="text-neutral-900">Essai gratuit de 7 jours, sans carte bancaire.</b> Décrivez votre entreprise en 10 minutes : à la fin,
            votre espace s'ouvre aussitôt avec les agents choisis, et vos identifiants arrivent par e-mail. Vos agents démarrent
            avec ces informations. Vos réponses sont gardées sur cet appareil si vous faites une pause.
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{section.titre}</h1>
        {section.intro && <p className="mt-1 text-sm text-neutral-500">{section.intro}</p>}

        <div className="mt-6 space-y-5 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          {etape === 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              {([['contact_nom', 'Votre nom', 'name'], ['email', 'E-mail (vos identifiants y seront envoyés)', 'email'], ['telephone', 'Téléphone (facultatif)', 'tel']] as const).map(([k, l, ac]) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-sm font-medium text-neutral-700">{l}{k !== 'telephone' && <span className="text-orange-600"> *</span>}</span>
                  <input className={champ} autoComplete={ac} type={k === 'email' ? 'email' : 'text'} value={contact[k]}
                    onChange={(e) => setContact({ ...contact, [k]: e.target.value })} />
                </label>
              ))}
            </div>
          )}
          {section.questions.map((q) => (
            <div key={q.id}>
              <p className="mb-2 text-sm font-medium text-neutral-800">{q.libelle}{q.requis && <span className="text-orange-600"> *</span>}</p>
              <ChampQuestion q={q} valeur={reponses[q.id]} onChange={(v) => setReponses({ ...reponses, [q.id]: v })} />
            </div>
          ))}
          {/* Champ piège anti-robots, invisible pour un humain */}
          <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0"
            value={piege} onChange={(e) => setPiege(e.target.value)} name="site_web_entreprise" />
          {derniere && (
            <label className="flex items-start gap-3 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
              <input type="checkbox" checked={accord} onChange={(e) => setAccord(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span>J'accepte qu'Aissociate utilise ces informations pour étudier ma demande, me recontacter et préparer mon espace. Elles ne sont jamais revendues.</span>
            </label>
          )}
        </div>

        {erreur && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
        <div className="mt-6 flex justify-between">
          <Bouton variante="clair" disabled={etape === 0} onClick={() => { setErreur(''); setEtape(etape - 1); }}>
            <ArrowLeft className="h-4 w-4" /> Précédent
          </Bouton>
          <Bouton onClick={suivant} disabled={envoi}>
            {derniere ? (envoi ? 'Ouverture de votre espace…' : 'Ouvrir mon essai gratuit') : <>Suivant <ArrowRight className="h-4 w-4" /></>}
          </Bouton>
        </div>
      </main>
    </div>
  );
}
