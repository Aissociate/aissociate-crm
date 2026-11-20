// « Aujourd'hui » sur téléphone : une décision par écran, un grand bouton, « Plus tard »
// pour passer à la suivante sans rien décider, et « Parler à Léa » en bas.
import { useEffect, useState } from 'react';
import { Check, Lock, Mic } from 'lucide-react';
import { Avatar, cx } from '../composants';
import EditeurLivrable from '../EditeurLivrable';
import { presenter } from '../decision';
import { Apercu, LigneSuite, Portee, ligneAgent, type Contexte } from './CarteDecision';
import { useDictee, useInterlocuteur } from './DemanderLea';
import type { Decisions } from './useDecisions';

/** Vrai sous 640 px de large (la bascule « sm » de Tailwind). */
// eslint-disable-next-line react-refresh/only-export-components
export function useEstMobile(): boolean {
  const requete = '(max-width: 639px)';
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(requete).matches);
  useEffect(() => {
    const m = window.matchMedia(requete);
    const maj = () => setMobile(m.matches);
    maj();
    // « change » ne part pas toujours (émulation d'écran, onglet en arrière-plan) : on écoute aussi le redimensionnement.
    m.addEventListener('change', maj);
    window.addEventListener('resize', maj);
    return () => { m.removeEventListener('change', maj); window.removeEventListener('resize', maj); };
  }, []);
  return mobile;
}

export default function DecisionsMobile({ decisions, ctx }: { decisions: Decisions; ctx: Contexte }) {
  /** Décisions remises à plus tard pendant cette visite (rien n'est enregistré : elles restent « à valider »). */
  const [plusTard, setPlusTard] = useState<string[]>([]);
  const [edition, setEdition] = useState<string | null>(null);
  const { agent: lea, envoyer } = useInterlocuteur();
  const dictee = useDictee(envoyer);

  const toutes = decisions.decisions;
  const file = decisions.enAttente.filter((d) => !plusTard.includes(d.id));
  const d = file.find((x) => x.id === decisions.courante?.id) ?? file[0] ?? null;
  // Ce qui demande encore un geste ou une attention : raison d'un refus à donner, envoi annulable, échec.
  const enCours = toutes.filter((x) => ['raison', 'envoi', 'echec'].includes(decisions.suites[x.id]?.etat ?? ''));
  const raison = enCours.find((x) => decisions.suites[x.id]?.etat === 'raison');
  const position = d ? toutes.findIndex((x) => x.id === d.id) + 1 : toutes.length;

  const point = (id: string) => {
    const etat = decisions.suites[id]?.etat;
    if (etat === 'fait' || etat === 'envoi') return 'bg-[#2E6B48]';
    if (etat === 'refuse' || plusTard.includes(id)) return 'bg-[#CFCBC6]';
    return id === d?.id ? 'bg-[#B24A0C]' : 'bg-[#E7E5E2]';
  };

  const p = d ? presenter(d) : null;
  const { agent, suite } = d ? ligneAgent(d, ctx.agents) : { agent: undefined, suite: '' };

  return (
    <div className="flex flex-col gap-[18px] text-base">
      {toutes.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[#B24A0C]">{d ? `Décision ${position} sur ${toutes.length}` : `${toutes.length} décision${toutes.length > 1 ? 's' : ''} vue${toutes.length > 1 ? 's' : ''}`}</p>
          {toutes.length <= 12 && (
            <div className="flex items-center gap-1.5" role="img" aria-label={d ? `Décision ${position} sur ${toutes.length}` : 'Toutes les décisions sont vues'}>
              {toutes.map((x) => <span key={x.id} className={cx('block h-1.5 w-[26px] rounded-full', point(x.id))} />)}
            </div>
          )}
        </div>
      )}

      {enCours.filter((x) => x !== raison).map((x) => <LigneSuite key={x.id} d={x} suite={decisions.suites[x.id]} decisions={decisions} ctx={ctx} />)}

      {raison ? (
        <LigneSuite d={raison} suite={decisions.suites[raison.id]} decisions={decisions} ctx={ctx} />
      ) : d && p ? (
        <>
          <article aria-labelledby={`decision-m-${d.id}`} className="flex flex-col gap-4 rounded-[22px] border border-[#E7E5E2] bg-white p-[22px]">
            <div className="flex items-center gap-3">
              {agent && <Avatar prenom={agent.prenom} couleur={agent.couleur} photo={agent.photo} taille={44} />}
              <p className="text-[15px] leading-snug text-[#5F5B57]"><b className="font-semibold text-[#141414]">{agent?.prenom ?? 'Votre équipe'}</b><br />{suite}</p>
            </div>
            <h2 id={`decision-m-${d.id}`} className="text-[26px] font-extrabold leading-[1.12] tracking-tight">{d.titre}</h2>
            {p.portee && <div><Portee texte={p.portee} /></div>}
            {edition === d.id ? (
              <EditeurLivrable id={d.id} titre={d.titre} contenu={d.contenu} action={d.action} gerer={ctx.gerer}
                onCancel={() => setEdition(null)} onSaved={() => { setEdition(null); decisions.charger(); }} />
            ) : <Apercu d={d} onDocument={ctx.onDocument} compact />}
            <p className="flex items-center gap-2 text-sm text-[#B24A0C]"><Lock className="h-4 w-4 shrink-0" aria-hidden /> Rien ne part sans votre accord.</p>
          </article>
          {edition !== d.id && (ctx.proprietaire ? (
            <div className="flex flex-col gap-2.5">
              <button type="button" onClick={() => decisions.valider(d)}
                className="flex min-h-[60px] items-center justify-center gap-2 rounded-2xl bg-[#141414] px-4 text-lg font-semibold text-white">
                <Check className="h-5 w-5" aria-hidden /> {p.bouton}
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => (d.format === 'html' ? ctx.onDocument(d) : setEdition(d.id))}
                  className="min-h-[52px] rounded-[14px] border border-[#D6D3CF] bg-white text-base font-medium">Modifier</button>
                <button type="button" onClick={() => setPlusTard((x) => [...x, d.id])}
                  className="min-h-[52px] rounded-[14px] border border-[#D6D3CF] bg-white text-base font-medium">Plus tard</button>
              </div>
              <button type="button" onClick={() => decisions.demanderRaison(d.id)}
                className="min-h-[44px] self-center px-3 text-[15px] text-[#5F5B57] underline underline-offset-[3px]">Refuser</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <p className="text-[15px] text-[#5F5B57]">Seul le propriétaire de l'espace peut valider ou refuser.</p>
              <button type="button" onClick={() => setPlusTard((x) => [...x, d.id])}
                className="min-h-[52px] rounded-[14px] border border-[#D6D3CF] bg-white text-base font-medium">Voir la suivante</button>
            </div>
          ))}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 px-3 py-8 text-center">
          <span aria-hidden className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#2E6B48] text-white"><Check className="h-9 w-9" /></span>
          <p className="text-[28px] font-extrabold leading-tight tracking-tight">{toutes.length ? "C'est tout pour aujourd'hui." : "Rien n'attend votre accord."}</p>
          <p className="text-[#5F5B57]">
            {toutes.length ? "L'équipe s'occupe du reste." : 'Dès qu\'un agent prépare un e-mail, une publication ou un document, il apparaît ici.'}
          </p>
          {plusTard.some((id) => decisions.enAttente.some((x) => x.id === id)) && (
            <button type="button" onClick={() => setPlusTard([])}
              className="min-h-[48px] rounded-[14px] border border-[#D6D3CF] bg-white px-[18px] text-[15px]">
              Revoir ce que j'ai remis à plus tard
            </button>
          )}
        </div>
      )}

      {lea && (
        <button type="button" aria-pressed={dictee.disponible ? dictee.ecoute : undefined}
          onClick={() => (dictee.disponible ? dictee.basculer() : envoyer(''))}
          className={cx('flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl border-[1.5px] bg-white text-base font-semibold',
            dictee.ecoute ? 'border-[#B24A0C] text-[#B24A0C]' : 'border-[#141414] text-[#141414]')}>
          <Mic className={cx('h-5 w-5', dictee.ecoute && 'animate-pulse')} aria-hidden />
          {dictee.ecoute ? 'Je vous écoute…' : dictee.disponible ? `Parler à ${lea.prenom}` : `Écrire à ${lea.prenom}`}
        </button>
      )}
    </div>
  );
}
