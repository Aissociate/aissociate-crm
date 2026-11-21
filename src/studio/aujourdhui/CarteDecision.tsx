// Une décision de l'écran « Aujourd'hui », dans ses états : dépliée (une seule à la fois),
// repliée sur une ligne, puis ce qu'il en est advenu (envoi retenu, fait, refusée).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, FileType, Lock } from 'lucide-react';
import type { Agent } from '../api';
import { Avatar, Markdown, cx } from '../composants';
import EditeurLivrable from '../EditeurLivrable';
import MediaVue from '../MediaVue';
import { mediasDuMessage } from '../marqueursMedia';
import { presenter } from '../decision';
import { DELAI_ANNULATION, RAISONS_REFUS, type Decision, type Decisions, type Raison, type Suite } from './useDecisions';

/** Aperçu texte d'un document HTML. */
// eslint-disable-next-line react-refresh/only-export-components
export function texteDuHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('style, script').forEach((n) => n.remove());
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

export const CL_PRINCIPAL = 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#141414] px-[22px] text-base font-semibold text-white hover:bg-[#2B2B2B] disabled:bg-[#B9B5B0]';
export const CL_SECONDAIRE = 'inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[#D6D3CF] bg-white px-[18px] text-base font-medium text-[#141414] hover:bg-[#F6F5F3]';
const CL_LIEN = 'min-h-[44px] rounded-lg px-2.5 text-[15px] text-[#5F5B57] underline underline-offset-[3px] hover:text-[#141414]';

export type Contexte = { agents: Map<string, Agent>; proprietaire: boolean; gerer: (e: unknown) => string; onDocument: (d: Decision) => void };

/** « Théo · Comptabilité · mission confiée par Léa · attend votre accord » : seulement ce qui est vrai. */
// eslint-disable-next-line react-refresh/only-export-components
export function ligneAgent(d: Decision, agents: Map<string, Agent>): { agent?: Agent; suite: string } {
  const agent = d.agent_id ? agents.get(d.agent_id) : undefined;
  const confie = d.confie_par && d.confie_par !== d.agent_id ? agents.get(d.confie_par)?.prenom : undefined;
  return { agent, suite: [agent?.metier, confie && `mission confiée par ${confie}`, 'attend votre accord'].filter(Boolean).join(' · ') };
}

export function Portee({ texte }: { texte: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDEEE2] px-3 py-[5px] text-xs tracking-wide text-[#B24A0C]">
      <Lock className="h-3.5 w-3.5" aria-hidden /> {texte}
    </span>
  );
}

/** Contenu réel de ce qui partira (ou du texte à relire), borné en hauteur. */
export function Apercu({ d, onDocument, compact }: { d: Decision; onDocument: (d: Decision) => void; compact?: boolean }) {
  return (
    <div className={cx('overflow-y-auto rounded-xl border border-[#EEEDEA] bg-[#F6F5F3] px-4 py-3.5 text-[15px]', compact ? 'max-h-56' : 'max-h-72')}>
      {d.format === 'html' ? (
        <>
          <p className="line-clamp-5 text-[#141414]">{texteDuHtml(d.contenu).slice(0, 700)}</p>
          <button type="button" onClick={() => onDocument(d)} className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 font-medium text-[#B24A0C] underline underline-offset-[3px]">
            <FileType className="h-4 w-4" aria-hidden /> Ouvrir le document
          </button>
        </>
      ) : (
        <>
          <Markdown texte={d.contenu} />
          {/* Visuels et vidéos créés par l'équipe (repères [[MEDIA:…]]) : vus avant de valider. */}
          {mediasDuMessage(d.contenu).map((m) => <div key={m.id} className="mt-3"><MediaVue media={m} /></div>)}
        </>
      )}
    </div>
  );
}

export function CarteDecision({ d, decisions, ctx }: { d: Decision; decisions: Decisions; ctx: Contexte }) {
  const [edition, setEdition] = useState(false);
  const { agent, suite } = ligneAgent(d, ctx.agents);
  const p = presenter(d);
  return (
    <article aria-labelledby={`decision-${d.id}`} className="flex flex-col gap-4 rounded-[18px] border border-[#E7E5E2] bg-white p-6">
      <div className="flex flex-wrap items-center gap-3">
        {agent && <Avatar prenom={agent.prenom} couleur={agent.couleur} photo={agent.photo} taille={40} />}
        <p className="min-w-[160px] flex-1 text-sm text-[#5F5B57]"><b className="font-semibold text-[#141414]">{agent?.prenom ?? 'Votre équipe'}</b> · {suite}</p>
        {p.portee && <Portee texte={p.portee} />}
      </div>
      <h2 id={`decision-${d.id}`} className="text-[23px] font-bold leading-tight tracking-tight">{d.titre}</h2>
      {edition ? (
        <EditeurLivrable id={d.id} titre={d.titre} contenu={d.contenu} action={d.action} gerer={ctx.gerer}
          onCancel={() => setEdition(false)} onSaved={() => { setEdition(false); decisions.charger(); }} />
      ) : (
        <>
          <Apercu d={d} onDocument={ctx.onDocument} />
          {ctx.proprietaire ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <button type="button" className={CL_PRINCIPAL} onClick={() => decisions.valider(d)}>
                <Check className="h-[18px] w-[18px]" aria-hidden /> {p.bouton}
              </button>
              <button type="button" className={CL_SECONDAIRE} onClick={() => (d.format === 'html' ? ctx.onDocument(d) : setEdition(true))}>Modifier</button>
              <button type="button" className={CL_LIEN} onClick={() => decisions.demanderRaison(d.id)}>Refuser</button>
            </div>
          ) : (
            <p className="text-[15px] text-[#5F5B57]">Seul le propriétaire de l'espace peut valider ou refuser.</p>
          )}
        </>
      )}
    </article>
  );
}

export function LigneRepliee({ d, decisions, ctx }: { d: Decision; decisions: Decisions; ctx: Contexte }) {
  const { agent } = ligneAgent(d, ctx.agents);
  const p = presenter(d);
  return (
    <button type="button" onClick={() => decisions.ouvrir(d.id)}
      className="flex min-h-[68px] w-full items-center gap-3.5 rounded-2xl border border-[#E7E5E2] bg-white px-[18px] py-3 text-left text-[#141414] hover:border-[#D6D3CF]">
      {agent && <Avatar prenom={agent.prenom} couleur={agent.couleur} photo={agent.photo} taille={36} />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[17px] font-semibold leading-snug">{d.titre}</span>
        <span className="truncate text-sm text-[#5F5B57]">{[agent?.prenom, p.portee].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="shrink-0 text-[15px] font-semibold underline underline-offset-[3px]">Ouvrir</span>
    </button>
  );
}

/** Ce qu'il est advenu d'une décision pendant la session. */
export function LigneSuite({ d, suite, decisions, ctx }: { d: Decision; suite: Suite; decisions: Decisions; ctx: Contexte }) {
  const { agent } = ligneAgent(d, ctx.agents);
  const prenom = agent?.prenom ?? "L'agent";
  const annuler = 'min-h-[44px] shrink-0 rounded-lg px-2.5 text-sm text-[#B24A0C] underline underline-offset-[3px]';

  if (suite.etat === 'envoi') {
    return (
      <div role="status" className="relative overflow-hidden rounded-[14px] border border-[#E7E5E2] bg-white px-[18px] py-3.5">
        <div className="flex items-center gap-3">
          <p className="flex-1 text-[15px]"><b className="font-semibold">{d.titre}</b> : c'est noté, ça part dans quelques secondes.</p>
          <button type="button" className={annuler} onClick={() => decisions.annulerEnvoi(d.id)}>Annuler</button>
        </div>
        {/* Temps restant pour annuler (purement visuel : la minuterie est dans useDecisions). */}
        <span aria-hidden className="absolute bottom-0 left-0 h-[3px] bg-[#EA6A1E]" style={{ animation: `studio-delai ${DELAI_ANNULATION}ms linear forwards` }} />
        <style>{'@keyframes studio-delai{from{width:100%}to{width:0}}@media (prefers-reduced-motion: reduce){[style*="studio-delai"]{animation:none!important;width:100%}}'}</style>
      </div>
    );
  }
  if (suite.etat === 'fait') {
    return (
      <div role="status" className="flex items-center gap-3 rounded-[14px] border border-[#E7E5E2] bg-white px-[18px] py-3.5">
        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2E6B48] text-white"><Check className="h-4 w-4" /></span>
        <p className="flex-1 text-[15px]"><b className="font-semibold">{d.titre}</b> : {suite.texte}</p>
        {suite.lien && <a href={suite.lien} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-medium text-[#B24A0C] underline underline-offset-[3px]">Voir</a>}
      </div>
    );
  }
  if (suite.etat === 'echec') {
    return (
      <div role="alert" className="rounded-[14px] border border-red-200 bg-red-50 px-[18px] py-3.5 text-[15px] text-red-800">
        <b className="font-semibold">{d.titre}</b> : {suite.texte}{' '}
        <Link to="/studio/aujourdhui/livrables" className="font-medium underline">Réessayer depuis « Tous les livrables »</Link>
      </div>
    );
  }
  if (suite.etat === 'raison') {
    return (
      <div className="flex flex-col gap-3 rounded-[14px] border border-[#E7E5E2] bg-white px-[18px] py-4">
        <p className="text-[15px]"><b className="font-semibold">{d.titre}</b> : dites à {prenom} pourquoi vous refusez, pour qu'il en tienne compte la prochaine fois.</p>
        <div role="group" aria-label="Raison du refus" className="flex flex-wrap gap-2">
          {(Object.keys(RAISONS_REFUS) as Raison[]).map((k) => (
            <button key={k} type="button" onClick={() => decisions.refuser(d.id, k)}
              className="min-h-[44px] rounded-full border border-[#D6D3CF] bg-white px-4 text-[15px] text-[#141414] hover:bg-[#F6F5F3]">{RAISONS_REFUS[k]}</button>
          ))}
          <button type="button" className={annuler} onClick={() => decisions.renoncerRefus(d.id)}>Finalement non</button>
        </div>
      </div>
    );
  }
  return (
    <div role="status" className="flex items-center gap-3 rounded-[14px] border border-dashed border-[#D6D3CF] px-[18px] py-3.5 text-[#5F5B57]">
      <p className="flex-1 text-[15px]">{d.titre} : refusé ({RAISONS_REFUS[suite.raison].toLowerCase()}). {prenom} en tiendra compte la prochaine fois.</p>
      {ctx.proprietaire && <button type="button" className={annuler} onClick={() => decisions.annulerRefus(d.id)}>Annuler</button>}
    </div>
  );
}
