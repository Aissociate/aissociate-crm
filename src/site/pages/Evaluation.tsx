import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader as Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import EvaluationForm from '@/components/EvaluationForm';
import {
  noter, construireSynthese, progression, questionsManquantes, reponsesVides,
  type EvaluationType, type Reponses,
} from '@/lib/evaluation';

/**
 * Page publique d'évaluation — `/evaluation/:token` (à chaud ou à froid J+30).
 * Même fonctionnement que `/positionnement/:token` : pas de compte, identité
 * déclarée, brouillon conservé dans le navigateur.
 */

type Contexte = {
  type: EvaluationType; libelle: string; destinataire: string | null; email: string | null;
  formation: string | null; multi: boolean; dejaRepondu: boolean;
};

const cleBrouillon = (token: string) => `evaluation-${token}`;

function Coquille({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-app">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 flex justify-center"><Logo size="md" tagline /></div>
        {children}
        <p className="mt-8 text-center text-xs text-muted">
          Aissociate · Organisme de formation certifié Qualiopi — vos réponses restent confidentielles.
        </p>
      </div>
    </div>
  );
}

export default function Evaluation() {
  const { token } = useParams();
  const [ctx, setCtx] = useState<Contexte | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reponses, setReponses] = useState<Reponses>(reponsesVides);
  const [envoi, setEnvoi] = useState(false);
  const [manques, setManques] = useState<string[]>([]);
  const [rgpd, setRgpd] = useState(false);
  const [fini, setFini] = useState(false);

  // Lien privé : jamais indexé.
  useEffect(() => {
    document.title = 'Évaluation de formation — Aissociate';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('evaluation', { body: { action: 'get', token } });
        if (error) throw error;
        const d = data as Contexte & { error?: string };
        if (d?.error) throw new Error(d.error);
        if (!vivant) return;
        setCtx(d);

        let brouillon: Reponses | null = null;
        try {
          const brut = localStorage.getItem(cleBrouillon(token ?? ''));
          if (brut) brouillon = JSON.parse(brut) as Reponses;
        } catch { /* stockage indisponible : formulaire vide */ }
        const base = brouillon ?? reponsesVides();
        setReponses({
          ...base,
          champs: {
            ...(d.destinataire ? { nom: d.destinataire } : {}),
            ...(d.email ? { email: d.email } : {}),
            ...(d.formation ? { formation: d.formation } : {}),
            ...Object.fromEntries(Object.entries(base.champs).filter(([, v]) => v)),
          },
        });
      } catch (e) {
        if (vivant) setErreur(e instanceof Error ? e.message : 'Lien invalide.');
      } finally {
        if (vivant) setChargement(false);
      }
    })();
    return () => { vivant = false; };
  }, [token]);

  useEffect(() => {
    if (!token || chargement || fini) return;
    try { localStorage.setItem(cleBrouillon(token), JSON.stringify(reponses)); } catch { /* quota ou mode privé */ }
  }, [reponses, token, chargement, fini]);

  const pct = useMemo(() => (ctx ? progression(ctx.type, reponses) : 0), [ctx, reponses]);

  const envoyer = async () => {
    if (!ctx) return;
    const m: string[] = [];
    if (!(reponses.champs.nom ?? '').trim()) m.push('votre nom');
    const email = (reponses.champs.email ?? '').trim();
    if (!email) m.push('votre adresse email');
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) m.push('une adresse email valide');
    const q = questionsManquantes(ctx.type, reponses).length;
    if (q) m.push(`${q} question(s) obligatoire(s)`);
    if (!rgpd) m.push('votre accord sur le traitement des réponses');
    setManques(m);
    if (m.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

    setEnvoi(true);
    setErreur(null);
    const note = noter(ctx.type, reponses);
    const synthese = construireSynthese(ctx.type, reponses, note);
    try {
      const { data, error } = await supabase.functions.invoke('evaluation', {
        body: { action: 'submit', token, reponses, note, synthese },
      });
      if (error) throw error;
      const d = data as { error?: string };
      if (d?.error) throw new Error(d.error);
      setFini(true);
      try { localStorage.removeItem(cleBrouillon(token ?? '')); } catch { /* sans effet */ }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'envoi a échoué. Réessayez dans un instant.");
    } finally {
      setEnvoi(false);
    }
  };

  if (chargement) {
    return (
      <Coquille>
        <div className="card flex items-center justify-center gap-3 p-10 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Chargement du questionnaire…
        </div>
      </Coquille>
    );
  }

  if (!ctx) {
    return (
      <Coquille>
        <div className="card p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <h1 className="text-lg font-bold text-fg">Lien indisponible</h1>
          <p className="mt-2 text-sm text-muted">{erreur ?? 'Ce lien est invalide ou a expiré.'}</p>
          <p className="mt-4 text-sm text-muted">
            Contactez votre formateur ou écrivez à <strong>contact@aissociate.re</strong> pour en recevoir un nouveau.
          </p>
        </div>
      </Coquille>
    );
  }

  if (fini || ctx.dejaRepondu) {
    return (
      <Coquille>
        <div className="card p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
          <h1 className="text-lg font-bold text-fg">{fini ? 'Merci pour votre retour !' : 'Questionnaire déjà complété'}</h1>
          <p className="mt-2 text-sm text-muted">
            {fini
              ? "Vos réponses ont bien été transmises. Elles contribuent directement à l'amélioration de nos formations."
              : 'Votre évaluation nous est déjà parvenue. Si vous pensez qu\'il s\'agit d\'une erreur, signalez-le à votre formateur.'}
          </p>
        </div>
      </Coquille>
    );
  }

  const chaud = ctx.type === 'chaud';
  return (
    <div className="min-h-screen bg-app">
      <div className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 py-3 sm:px-6">
          <span className="shrink-0 text-sm font-semibold text-fg">Évaluation</span>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
            role="progressbar" aria-label="Progression du questionnaire"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
          >
            <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 text-sm tabular-nums text-muted">{pct} %</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8">
          <div className="mb-4"><Logo size="md" tagline /></div>
          <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{ctx.libelle}</h1>
          {ctx.formation && <p className="mt-1 text-sm font-medium text-brand-600 dark:text-brand-400">{ctx.formation}</p>}
          <p className="mt-3 max-w-[64ch] text-sm leading-relaxed text-muted">
            {chaud
              ? 'Votre formation se termine : dites-nous ce que vous en avez pensé. Vos réponses, franches et confidentielles, servent directement à améliorer nos formations.'
              : 'Un mois après votre formation, nous aimerions savoir ce que vous en avez concrètement retiré dans votre travail.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <span>5 minutes</span>
            <span>Réponses enregistrées dans votre navigateur</span>
            <span>Les questions marquées * sont obligatoires</span>
          </div>
        </header>

        {manques.length > 0 && (
          <div className="mb-5 flex items-start gap-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Il manque {manques.join(', ')}.</span>
          </div>
        )}
        {erreur && (
          <div className="mb-5 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{erreur}</div>
        )}

        <EvaluationForm type={ctx.type} valeur={reponses} onChange={setReponses} />

        <section className="card mt-6 p-5 sm:p-6">
          <h2 className="text-xl font-bold tracking-tight text-fg">Traitement de vos réponses</h2>
          <p className="mt-3 max-w-[64ch] text-sm leading-relaxed text-muted">
            Vos réponses sont utilisées par l'organisme de formation pour mesurer la qualité de ses
            actions et les améliorer. Elles sont conservées pendant la durée de l'action de formation et
            les trois années suivantes, au titre des obligations de traçabilité de la certification
            Qualiopi, puis supprimées. Vous disposez d'un droit d'accès, de rectification et
            d'effacement en écrivant à l'organisme.
          </p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-3 transition-colors hover:border-brand-500/50">
            <input type="checkbox" checked={rgpd} onChange={(e) => setRgpd(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-sm text-fg">
              J'ai pris connaissance de ces informations et j'accepte que mes réponses soient utilisées
              pour évaluer et améliorer la formation.
            </span>
          </label>
          <div className="mt-5">
            <button type="button" className="btn-primary" onClick={() => void envoyer()} disabled={envoi}>
              {envoi && <Loader2 className="h-4 w-4 animate-spin" />}
              {envoi ? 'Envoi…' : 'Envoyer mon évaluation'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
