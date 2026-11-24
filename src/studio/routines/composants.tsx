// Pièces communes aux écrans des routines (refonte §3.4, §3.5) : bascule, chaîne d'étapes
// verticale (écran Routine) et liste numérotée compacte (proposition dans « Nouvelle routine »).
import type { ReactNode } from 'react';
import { ChevronDown, Lock, Send } from 'lucide-react';
import type { Agent } from '../api';
import { Avatar, cx } from '../composants';
import { surtitre, type EtapeVue } from '../routinesVue';

export const CL_SURTITRE = 'text-xs uppercase tracking-[0.08em] text-[#B24A0C]';
export const CL_BOUTON_NOIR = 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#17120E] px-5 text-[15px] font-semibold text-white hover:bg-black disabled:opacity-40';
export const CL_BOUTON_CLAIR = 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#D9CEC3] bg-white px-4 text-[15px] font-semibold text-[#17120E] hover:border-[#17120E] disabled:opacity-40';
export const CL_LIEN = 'inline-flex min-h-[44px] items-center text-[15px] font-semibold text-[#B24A0C] underline underline-offset-[3px] hover:text-[#17120E]';

/** Interrupteur à libellé, tout le bouton est cliquable (48 px de haut). */
export function Bascule({ actif, onChange, children, disabled, className }: {
  actif: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean; className?: string;
}) {
  return (
    <button type="button" aria-pressed={actif} disabled={disabled} onClick={() => onChange(!actif)}
      className={cx('flex min-h-[48px] items-center gap-3 rounded-xl border border-[#E6DCD2] bg-[#F2ECE4] px-3.5 py-2.5 text-left text-[15px] disabled:opacity-50', className)}>
      <span aria-hidden className={cx('relative block h-6 w-10 flex-none rounded-full transition-colors', actif ? 'bg-[#2E6B48]' : 'bg-[#D9CEC3]')}>
        <span className={cx('absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all', actif ? 'left-[19px]' : 'left-[3px]')} />
      </span>
      <span className="min-w-0">{children}</span>
    </button>
  );
}

/** Médaillon d'une étape : l'agent, « Vous » (validation) ou l'heure de départ. */
function Medaillon({ e, agents, depart }: { e: EtapeVue; agents: Agent[]; depart: string }) {
  const a = e.agent ? agents.find((x) => x.id === e.agent) : null;
  if (a) return <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={40} />;
  const carre = 'flex h-10 w-10 flex-none items-center justify-center rounded-xl text-[15px] font-bold text-white';
  if (e.type === 'validation') return <span aria-hidden className={cx(carre, 'bg-[#B24A0C]')}>{e.verrouillee ? <Lock className="h-[18px] w-[18px]" /> : 'Vous'}</span>;
  if (e.type === 'envoi') return <span aria-hidden className={cx(carre, 'bg-[#2E6B48]')}><Send className="h-[18px] w-[18px]" /></span>;
  return <span aria-hidden className={cx(carre, 'bg-[#23303A] text-[13px]')}>{depart}</span>;
}

const Fleche = () => (
  <span aria-hidden className="flex flex-col items-center">
    <span className="block h-3.5 w-0.5 bg-[#D9CEC3]" />
    <ChevronDown className="-my-1 h-4 w-4 text-[#A89C90]" />
    <span className="block h-3.5 w-0.5 bg-[#D9CEC3]" />
  </span>
);

/** Chaîne verticale de l'écran Routine : « En clair », puis une carte par étape, sélectionnable. */
export function ChaineEtapes({ etapes, enClair, choisie, onChoisir, agents, heures, pied }: {
  etapes: EtapeVue[]; enClair: string; choisie: string; onChoisir: (id: string) => void; agents: Agent[]; heures: number[]; pied?: ReactNode;
}) {
  const prenom = (id: string) => agents.find((a) => a.id === id)?.prenom ?? id;
  const depart = heures.length === 1 ? `${heures[0]}h` : `${heures.length}×`;
  return (
    <section aria-label="Étapes de la routine"
      className="flex flex-col items-center rounded-none border border-[#E6DCD2] bg-[#F2ECE4] bg-[radial-gradient(#D9CEC3_1.2px,transparent_1.2px)] bg-[length:22px_22px] px-4 py-[clamp(20px,3vw,40px)]">
      <div className="mb-6 flex w-full max-w-[480px] flex-col gap-1.5 rounded-2xl border border-[#E6DCD2] bg-white px-[18px] py-4" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#B24A0C]">En clair</p>
        <p className="text-[17px] leading-[1.45]">{enClair}</p>
      </div>
      {etapes.map((e, i) => {
        const sel = e.id === choisie;
        const porte = e.type === 'validation';
        return (
          <div key={e.id} className="flex w-full max-w-[480px] flex-col items-center">
            {i > 0 && <Fleche />}
            <button type="button" aria-pressed={sel} onClick={() => onChoisir(e.id)}
              className={cx('flex w-full items-start gap-3.5 rounded-2xl border-2 px-[18px] py-4 text-left transition-shadow',
                porte ? 'bg-[#FDEEE2]' : 'bg-white',
                sel ? 'border-[#17120E] shadow-[0_10px_28px_rgba(23,18,14,0.14)]' : porte ? 'border-[#EA6A1E]' : 'border-[#E6DCD2] shadow-[0_1px_2px_rgba(23,18,14,0.05)]')}>
              <Medaillon e={e} agents={agents} depart={depart} />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className={cx('text-[11.5px] uppercase tracking-[0.06em]', porte ? 'text-[#B24A0C]' : 'text-[#615850]')}>{surtitre(e, i, prenom)}</span>
                <span className="text-[17px] font-semibold leading-[1.35]">{e.texte}</span>
                {e.puces.length > 0 && (
                  <span className="flex flex-wrap gap-1.5">
                    {e.puces.map((p) => <span key={p} className="rounded-full border border-[#E6DCD2] bg-white px-2.5 py-0.5 text-[13px] text-[#615850]">{p}</span>)}
                  </span>
                )}
              </span>
            </button>
          </div>
        );
      })}
      <span aria-hidden className="block h-[18px] w-0.5 bg-[#D9CEC3]" />
      <span className="rounded-full border border-[#E6DCD2] bg-white px-3.5 py-1 text-xs uppercase tracking-[0.06em] text-[#615850]">Fin de la routine</span>
      {pied}
    </section>
  );
}

/** Liste numérotée compacte : « GO », étapes, étape verrouillée signalée. */
export function ListeEtapes({ etapes }: { etapes: EtapeVue[] }) {
  return (
    <ol className="flex flex-col">
      {etapes.map((e, i) => {
        const porte = e.type === 'validation';
        const depart = e.type === 'depart';
        return (
          <li key={e.id} className="flex items-stretch gap-3">
            <span className="flex w-7 flex-none flex-col items-center">
              <span aria-hidden className={cx('flex h-7 w-7 flex-none items-center justify-center text-xs font-medium',
                porte || depart ? 'rounded-lg text-white' : 'rounded-full bg-[#E6DCD2] text-[#17120E]',
                porte ? 'bg-[#B24A0C]' : depart ? 'bg-[#23303A]' : '')}>
                {depart ? 'GO' : porte ? <Lock className="h-3.5 w-3.5" /> : i}
              </span>
              {i < etapes.length - 1 && <span aria-hidden className="block min-h-[10px] w-0.5 flex-1 bg-[#E6DCD2]" />}
            </span>
            <span className={cx('pb-3.5 pt-[3px] text-[15px]', porte && 'font-semibold text-[#B24A0C]')}>
              {e.texte}{porte && e.verrouillee && <span className="sr-only"> (étape obligatoire, non supprimable)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
