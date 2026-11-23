// « Choisir mon contrat » : la grille de la maquette « choix de l'abonnement (vocabulaire du
// travail) », juste avant la page de paiement Stripe. Sert aussi à modifier un contrat en cours
// (avenants, passage CDD ↔ CDI). Montants et droits : supabase/functions/studio/contrats.ts,
// le même fichier que le serveur (le bulletin affiché est celui qui sera facturé).
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { appel } from '../api';
import { Chargement } from '../composants';
import Confirmation from '../composants/Confirmation';
import { useStudio } from '../StudioApp';
import {
  bulletin, CHOIX_STAGE, COMPTEURS, contrat as contratDe, CONTRATS, droits, INTEGRATION_HT, INTERRUPTEURS,
  normaliser, ACTIONS_PAR_HEURE, type Choix,
} from '../../../supabase/functions/studio/contrats';

const C = {
  fond: '#FBF7F3', encre: '#17120E', gris: '#615850', trait: '#E6DCD2', trait2: '#D6C8BA', sable: '#F4EDE6',
  accent: '#EA6A1E', brique: '#B24A0C', brun: '#8A3808', peche: '#FDEEE2', nuit: '#23303A', lin: '#E8DDD2',
};
const TITRE = { fontFamily: "Archivo, 'Inter', Arial, sans-serif" };
const MONO = { fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" };
const POLICES = 'https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap';

const euros = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const heures = (h: number) => `${String(Math.round(h * 100) / 100).replace('.', ',')} h`;
const memeChoix = (a: Choix, b: Choix) => JSON.stringify(normaliser(a)) === JSON.stringify(normaliser(b));

type Perimetre = {
  abonnement?: { statut: string | null; contrat: Choix | null; ancienne_grille: boolean; test: boolean; mensuel_ht: number | null } | null;
};
const EN_COURS = ['active', 'trialing', 'past_due', 'unpaid', 'paused'];

function Coche() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={C.brique} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}

function BoutonBascule({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={actif} onClick={onClick}
      className="min-h-[44px] min-w-[132px] rounded-[10px] px-3.5 py-2.5 font-semibold"
      style={actif ? { background: C.nuit, color: '#fff', border: `1px solid ${C.nuit}` } : { background: '#fff', color: C.brun, border: `1px solid ${C.trait2}` }}>
      {children}
    </button>
  );
}

export default function PageContrat() {
  const { me, gerer, rafraichir } = useStudio();
  const navigate = useNavigate();
  const proprietaire = me.user.role === 'proprietaire';
  const [p, setP] = useState<Perimetre | null>(null);
  const [choix, setChoix] = useState<Choix>({ ...CHOIX_STAGE, contrat: 'plein' });
  const [integ, setInteg] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [confirmer, setConfirmer] = useState(false);
  const [annule, setAnnule] = useState(false);

  useEffect(() => {
    if (!document.querySelector(`link[href="${POLICES}"]`)) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = POLICES; document.head.appendChild(l);
    }
    const u = new URL(window.location.href);
    if (u.searchParams.get('paiement') === 'annule') {
      setAnnule(true);
      u.searchParams.delete('paiement');
      window.history.replaceState(null, '', u.pathname + u.search);
    }
    appel<Perimetre>('perimetre').then((r) => {
      setP(r);
      // Contrat en vigueur pré-rempli ; Stage → on propose le Temps plein (recommandé).
      const c = r.abonnement?.contrat;
      if (c && c.contrat !== 'stage') setChoix(normaliser(c));
    }).catch((e) => setErreur(gerer(e)));
  }, [gerer]);

  const actuel = p?.abonnement?.contrat ?? null;
  const abonne = Boolean(p?.abonnement?.statut && EN_COURS.includes(p.abonnement.statut));
  const ancienne = Boolean(p?.abonnement?.ancienne_grille);
  const b = useMemo(() => bulletin(choix), [choix]);
  const d = useMemo(() => droits(choix), [choix]);
  const cur = contratDe(choix.contrat);
  const inchange = Boolean(actuel && !ancienne && memeChoix(actuel, choix) && (abonne || !b.payant));
  const versStage = !b.payant && abonne;

  const maj = (o: Partial<Choix>) => setChoix((c) => normaliser({ ...c, ...o }));

  const signer = async () => {
    setEnvoi(true); setErreur(''); setConfirmer(false);
    try {
      if (versStage) {
        const r = await appel<{ url?: string }>('abonnement_gerer');
        if (r.url) { window.location.href = r.url; return; }
      }
      if (integ) await appel('integration_demander', { contrat: choix.contrat }).catch(() => undefined);
      const r = await appel<{ url?: string; ok?: boolean }>('contrat_souscrire', { choix });
      if (r.url) { window.location.href = r.url; return; }
      await rafraichir();
      navigate(`/studio/reglages/perimetre?paiement=${b.payant ? 'contrat' : 'stage'}`);
    } catch (e) { setErreur(gerer(e)); setEnvoi(false); }
  };
  const resilier = async () => {
    setEnvoi(true); setErreur('');
    try {
      const r = await appel<{ url?: string }>('abonnement_resilier');
      if (r.url) { window.location.href = r.url; return; }
    } catch (e) { setErreur(gerer(e)); }
    setEnvoi(false);
  };
  const clicSigner =() => (abonne && b.payant ? setConfirmer(true) : void signer());

  if (!p) return erreur ? <p className="text-sm text-red-700">{erreur}</p> : <Chargement />;

  const libelleSigner = inchange ? 'Contrat en vigueur'
    : versStage ? 'Revenir au Stage (résilier)'
    : !b.payant ? 'Rester en Stage gratuit'
    : abonne ? 'Signer l\'avenant au contrat' : 'Signer le contrat';

  return (
    <div className="-mx-4 -my-6 px-4 py-6 sm:-mx-8 sm:-my-10 sm:px-8 sm:py-10" style={{ background: C.fond, color: C.encre }}>
      <div className="mx-auto flex max-w-[1180px] flex-col gap-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/studio/reglages/perimetre" className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: C.brique }}>
            <ArrowLeft className="h-4 w-4" /> Mon abonnement
          </Link>
          <span className="text-[13px]" style={{ ...MONO, color: C.gris }}>{abonne ? 'Avenant au contrat' : 'Étape 2 sur 3 · Le contrat'}</span>
        </div>

        <div className="flex max-w-[46rem] flex-col gap-2.5">
          <span className="text-xs uppercase tracking-[0.16em]" style={{ ...MONO, color: C.brique }}>Renforcez votre équipe</span>
          <h1 className="m-0 text-[clamp(32px,5vw,48px)] font-extrabold leading-[1.05] tracking-[-0.03em]" style={TITRE}>Choisissez le contrat, ajoutez les avenants.</h1>
          <p className="m-0 text-lg" style={{ color: C.gris }}>Des agents qui épaulent vos salariés sur les tâches répétitives. Ils commencent en stage, gratuitement : vous ne payez ensuite que les heures de travail et les accès à vos outils dont ils ont vraiment besoin.</p>
        </div>

        {annule && <p className="rounded-xl px-3 py-2 text-sm" style={{ background: C.peche, color: C.brun }}>Paiement annulé : rien n'a été débité. Votre choix est toujours là.</p>}
        {ancienne && (
          <p className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: C.trait, background: '#fff', color: C.gris }}>
            Vous êtes abonné à l'ancienne formule (facturée par agent, {euros(Number(p.abonnement?.mensuel_ht ?? 0))} HT par mois). Elle reste valable tant que vous ne signez pas de nouveau contrat ; si vous en signez un, la différence est calculée au prorata.
          </p>
        )}

        <div role="group" aria-label="Type d'engagement" className="flex flex-wrap gap-1.5 self-start rounded-xl p-1.5" style={{ background: C.sable }}>
          {[false, true].map((cdi) => (
            <button key={String(cdi)} type="button" aria-pressed={choix.cdi === cdi} onClick={() => maj({ cdi })}
              className="min-h-[44px] rounded-lg px-4 py-2.5 font-semibold"
              style={choix.cdi === cdi ? { background: '#fff', color: C.encre, boxShadow: '0 1px 3px rgba(23,18,14,0.15)' } : { background: 'transparent', color: C.gris }}>
              {cdi ? 'CDI · annuel, 2 mois offerts' : 'CDD · sans engagement'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-start gap-7">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-8">
            <section className="flex flex-col gap-3.5">
              <h2 className="m-0 text-[22px] font-bold" style={TITRE}>1. Le contrat de travail</h2>
              <div className="flex flex-wrap gap-3.5">
                {CONTRATS.map((f) => {
                  const on = f.id === choix.contrat;
                  return (
                    <button key={f.id} type="button" aria-pressed={on} onClick={() => maj({ contrat: f.id })}
                      className="flex min-w-0 flex-[1_1_230px] flex-col gap-2.5 rounded-2xl bg-white p-[18px] text-left"
                      style={{ color: C.encre, border: on ? `2px solid ${C.accent}` : `1px solid ${C.trait}`, boxShadow: on ? `0 0 0 4px ${C.peche}` : 'none', margin: on ? 0 : 1 }}>
                      <span className="flex min-h-6 items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-[0.12em]" style={{ ...MONO, color: C.gris }}>{f.rythme}</span>
                        {f.reco && <span className="rounded-full px-2 py-0.5 text-[11px] uppercase tracking-[0.08em]" style={{ ...MONO, background: C.peche, color: C.brun }}>Recommandé</span>}
                      </span>
                      <span className="block text-[22px] font-bold leading-[1.15]" style={TITRE}>{f.nom}</span>
                      <span className="flex items-baseline gap-1.5">
                        <span className="text-[32px] font-extrabold tracking-[-0.02em] tabular-nums" style={TITRE}>{f.prix} €</span>
                        <span className="text-sm" style={{ color: C.gris }}>{f.prix === 0 ? 'pour toujours' : 'HT par mois'}</span>
                      </span>
                      <span className="block min-h-[21px] text-sm" style={{ color: C.gris }}>{f.accroche}</span>
                      <span className="flex flex-col gap-1.5 border-t pt-3" style={{ borderColor: C.trait }}>
                        {f.points.map((pt) => <span key={pt} className="flex items-start gap-2 text-sm leading-[1.4]"><Coche /><span>{pt}</span></span>)}
                      </span>
                      {actuel?.contrat === f.id && !ancienne && <span className="text-xs font-semibold" style={{ color: C.brun }}>Votre contrat actuel</span>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <h2 className="m-0 text-[22px] font-bold" style={TITRE}>2. Les avenants au contrat</h2>
                <p className="m-0 text-[15px]" style={{ color: C.gris }}>Modifiables à tout moment, sans changer de contrat.</p>
              </div>
              <div className="flex flex-col rounded-2xl border bg-white" style={{ borderColor: C.trait }}>
                {COMPTEURS.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b px-5 py-[18px]" style={{ borderColor: C.trait }}>
                    <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
                      <span className="font-semibold">{o.nom}</span>
                      <span className="text-sm" style={{ color: C.gris }}>{o.description}</span>
                    </div>
                    <span className="whitespace-nowrap text-[13px]" style={{ ...MONO, color: C.gris }}>{euros(o.prix)} {o.unite}</span>
                    <div className="flex items-center gap-1 rounded-[10px] p-1" style={{ background: C.sable }}>
                      <button type="button" aria-label={`Retirer un ${o.libelle}`} onClick={() => maj({ [o.id]: choix[o.id] - 1 })} className="h-11 w-11 rounded-lg bg-white text-xl leading-none" style={{ color: C.encre }}>−</button>
                      <span aria-live="polite" className="min-w-10 text-center font-semibold tabular-nums">{choix[o.id]}</span>
                      <button type="button" aria-label={`Ajouter un ${o.libelle}`} onClick={() => maj({ [o.id]: choix[o.id] + 1 })} className="h-11 w-11 rounded-lg bg-white text-xl leading-none" style={{ color: C.encre }}>+</button>
                    </div>
                  </div>
                ))}
                {INTERRUPTEURS.map((t) => {
                  const inclus = cur[t.id];
                  return (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b px-5 py-[18px]" style={{ borderColor: C.trait }}>
                      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
                        <span className="font-semibold">{t.nom}</span>
                        <span className="text-sm" style={{ color: C.gris }}>{t.description}</span>
                      </div>
                      <span className="whitespace-nowrap text-[13px]" style={{ ...MONO, color: C.gris }}>{euros(t.prix)} {t.unite}</span>
                      {inclus
                        ? <span className="min-w-[132px] rounded-[10px] px-3.5 py-3 text-center text-sm font-semibold" style={{ background: C.peche, color: C.brun }}>Inclus au contrat</span>
                        : <BoutonBascule actif={choix[t.id]} onClick={() => maj({ [t.id]: !choix[t.id] })}>{choix[t.id] ? 'Retirer' : 'Ajouter'}</BoutonBascule>}
                    </div>
                  );
                })}
                <div className="flex items-start gap-2.5 px-5 py-4 text-sm" style={{ color: C.gris }}>
                  <svg aria-hidden width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={C.brique} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M2 7l7-4 7 4-7 4-7-4z" /><path d="M5 9v3.5c1.2 1 2.6 1.5 4 1.5s2.8-.5 4-1.5V9" /></svg>
                  <span><strong style={{ color: C.encre }}>Formation continue incluse :</strong> vos agents reçoivent toutes les mises à jour sans supplément, quel que soit le contrat.</span>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3.5">
              <h2 className="m-0 text-[22px] font-bold" style={TITRE}>3. Le parcours d'intégration</h2>
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-2xl border bg-white p-5" style={{ borderColor: C.trait }}>
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
                  <span className="font-semibold">Un formateur installe vos agents et forme votre équipe</span>
                  <span className="text-sm" style={{ color: C.gris }}>Une demi-journée sur place ou à distance : vos outils branchés, vos premières tâches déléguées. Aissociate est un organisme certifié Qualiopi : ce parcours peut être pris en charge par votre OPCO.</span>
                </div>
                <span className="whitespace-nowrap text-[13px]" style={{ ...MONO, color: C.gris }}>{euros(INTEGRATION_HT)} HT, une fois</span>
                <BoutonBascule actif={integ} onClick={() => setInteg(!integ)}>{integ ? 'Retirer' : 'Ajouter'}</BoutonBascule>
              </div>
            </section>
          </div>

          <aside aria-label="Bulletin mensuel" className="sticky top-6 min-w-0 flex-[1_1_340px] overflow-hidden rounded-2xl border bg-white" style={{ borderColor: C.trait }}>
            <div className="flex flex-col gap-1 px-[22px] py-[18px] text-white" style={{ background: C.nuit }}>
              <span className="text-xs uppercase tracking-[0.16em]" style={{ ...MONO, color: C.lin }}>Bulletin mensuel</span>
              <span className="text-xl font-bold" style={TITRE}>{cur.nom} · {choix.cdi ? 'CDI annuel' : 'CDD mensuel'}</span>
              <span className="text-sm" style={{ color: C.lin }}>
                {heures(d.heures)} de travail · {d.connecteurs_max} badge{d.connecteurs_max > 1 ? 's' : ''} d'accès · {d.max_utilisateurs} responsable{d.max_utilisateurs > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-col gap-2.5 px-[22px] py-[18px]">
              <div className="flex justify-between border-b pb-2 text-[11px] uppercase tracking-[0.1em]" style={{ ...MONO, color: C.gris, borderColor: C.trait }}>
                <span>Rubrique</span><span>Montant HT</span>
              </div>
              {b.lignes.map((l) => (
                <div key={l.cle} className="flex justify-between gap-3 text-[15px]">
                  <span className="flex flex-col"><span>{l.libelle}</span><span className="text-[13px]" style={{ color: C.gris }}>{l.detail}</span></span>
                  <span className="whitespace-nowrap tabular-nums">{euros(l.montant_ht)}</span>
                </div>
              ))}
              {b.remise_cdi_ht > 0 && (
                <div className="flex justify-between gap-3 text-[15px]">
                  <span className="flex flex-col"><span>Remise CDI</span><span className="text-[13px]" style={{ color: C.gris }}>2 mois offerts, lissés sur l'année</span></span>
                  <span className="whitespace-nowrap tabular-nums">−{euros(b.remise_cdi_ht)}</span>
                </div>
              )}
              <div className="mt-1 flex flex-col gap-1.5 border-t border-dashed pt-3" style={{ borderColor: C.trait2 }}>
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">Net à payer HT</span>
                  <span className="text-[28px] font-extrabold tabular-nums" style={TITRE}>{euros(b.mensuel_ht)}</span>
                </div>
                <div className="flex justify-between text-sm" style={{ color: C.gris }}><span>TVA à 8,5 % (La Réunion)</span><span className="tabular-nums">{euros(Math.round(b.mensuel_ht * 8.5) / 100)}</span></div>
                <div className="flex justify-between text-sm" style={{ color: C.gris }}><span>Total TTC par mois</span><span className="tabular-nums">{euros(Math.round(b.mensuel_ht * 108.5) / 100)}</span></div>
                {b.annuel_ht != null && <div className="flex justify-between text-sm" style={{ color: C.gris }}><span>Réglé en une fois par an</span><span className="tabular-nums">{euros(b.annuel_ht)} HT</span></div>}
              </div>
              {integ && (
                <div className="flex flex-col gap-0.5 rounded-[10px] px-3.5 py-3 text-sm" style={{ background: C.fond }}>
                  <span className="flex justify-between"><span className="font-semibold">Parcours d'intégration, une fois</span><span className="tabular-nums">{euros(INTEGRATION_HT)} HT</span></span>
                  <span style={{ color: C.gris }}>Prise en charge par votre OPCO selon ses règles : nous vous rappelons pour fixer la date et monter le dossier. Il n'est pas ajouté au paiement en ligne.</span>
                </div>
              )}
              {proprietaire ? (
                <button type="button" onClick={clicSigner} disabled={envoi || inchange}
                  className="mt-1.5 block rounded-[10px] px-4 py-3.5 text-center font-semibold text-white disabled:opacity-60"
                  style={{ background: C.brique }}>
                  {envoi ? 'Un instant…' : libelleSigner}
                </button>
              ) : <p className="mt-1.5 rounded-[10px] px-3.5 py-3 text-sm" style={{ background: C.fond, color: C.gris }}>Seul le propriétaire de l'espace peut signer le contrat.</p>}
              {erreur && <p className="rounded-[10px] bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
              <p className="mt-1 text-xs" style={{ color: C.gris }}>
                1 heure de travail = {ACTIONS_PAR_HEURE} actions d'agent. Prix hors taxes.
                {b.payant && !abonne && ' Paiement par carte sur la page sécurisée de Stripe ; factures et résiliation depuis « Gérer mon abonnement ».'}
                {p.abonnement?.test && ' (Stripe en mode test.)'}
              </p>
            </div>
          </aside>
        </div>
        {proprietaire && abonne && (
          <p className="pt-4 text-center text-xs" style={{ color: C.gris, opacity: 0.7 }}>
            <button type="button" disabled={envoi} onClick={() => void resilier()} className="underline">Résilier mon abonnement</button>
          </p>
        )}
      </div>
      <Confirmation
        ouvert={confirmer}
        titre="Signer cet avenant ?"
        message={`Nouveau montant : ${euros(b.mensuel_ht)} HT par mois${choix.cdi ? ` (${euros(b.annuel_ht ?? 0)} HT réglés pour l'année)` : ''}. La différence pour la période en cours est calculée au prorata sur votre prochaine facture.`}
        confirmer={{ label: 'Signer', onClick: () => void signer() }}
        annuler={{ onClick: () => setConfirmer(false) }}
        enCours={envoi}
      />
    </div>
  );
}
