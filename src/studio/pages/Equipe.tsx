// « Mon équipe » : une carte compacte par agent. Chacune dit ce que l'agent fait seul,
// ce pour quoi il demande toujours l'accord, et son état quand il est utile (des décisions
// attendent, ou il travaille). Les outils branchés sont ceux de l'espace, communs à toute
// l'équipe : ils figurent une fois, en tête.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { appel } from '../api';
import { Avatar, cx } from '../composants';
import { autonomie, etatAgent, type EtatAgent } from '../missionGuidee';
import { useStudio } from '../StudioApp';

type Reponse = { etats: Record<string, EtatAgent>; connexions: string[] };

export const CL_SURTITRE = 'text-xs uppercase tracking-[0.08em] text-[#B24A0C]';
const CL_LIEN = 'inline-flex min-h-[44px] items-center text-[15px] font-semibold text-[#B24A0C] underline underline-offset-[3px] hover:text-[#141414]';

export default function Equipe() {
  const { me, gerer } = useStudio();
  const [r, setR] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => { appel<Reponse>('equipe').then(setR).catch((e) => setErreur(gerer(e))); }, [gerer]);
  const n = me.agents.length;

  return (
    <div className="flex flex-col gap-7 text-[17px] leading-normal text-[#141414]">
      <header className="flex max-w-[720px] flex-col gap-2.5">
        <p className={CL_SURTITRE}>Mon équipe · {n} collègue{n > 1 ? 's' : ''}</p>
        <h1 className="text-[clamp(30px,3.6vw,44px)] font-extrabold leading-[1.05] tracking-[-0.03em]">
          Chacun sait ce qu'il fait seul, et ce qu'il doit vous demander.
        </h1>
      </header>

      {erreur && <p className="rounded-xl bg-red-50 px-4 py-3 text-[15px] text-red-800" role="alert">{erreur}</p>}

      {r && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-[#5F5B57]">
          {r.connexions.length ? (
            <>
              <span className="mr-1">Votre équipe est branchée sur</span>
              {r.connexions.map((c) => <span key={c} className="rounded-full border border-[#E7E5E2] bg-white px-2.5 py-0.5 text-[13px] text-[#141414]">{c}</span>)}
            </>
          ) : <span>Aucun outil n'est encore branché : vos agents préparent, mais ne peuvent rien déposer dans vos comptes.</span>}
          <Link to="/studio/reglages" className="ml-1 inline-flex min-h-[44px] items-center font-medium text-[#B24A0C] underline underline-offset-[3px] hover:text-[#141414]">
            {r.connexions.length ? 'Gérer les connecteurs' : 'Relier mes outils'}
          </Link>
        </p>
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
        {me.agents.map((a) => {
          const etat = etatAgent(r?.etats[a.id]);
          const { seul, demande } = autonomie(a.id);
          return (
            <article key={a.id} aria-labelledby={`agent-${a.id}`} className="flex flex-col gap-3.5 rounded-[18px] border border-[#E7E5E2] bg-white p-[22px]">
              <div className="flex items-center gap-3.5">
                <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={52} />
                <div className="min-w-0 flex-1">
                  <h2 id={`agent-${a.id}`} className="text-[21px] font-bold leading-tight">{a.prenom}</h2>
                  <p className="text-sm text-[#5F5B57]">{a.metier}</p>
                </div>
              </div>
              {etat && (
                etat.ton === 'attente' ? (
                  <Link to="/studio" className="group -my-2 inline-flex min-h-[44px] items-center self-start">
                    <span className="rounded-full bg-[#FDEEE2] px-3 py-[3px] text-[13px] font-semibold text-[#B24A0C] group-hover:underline">{etat.texte}</span>
                  </Link>
                ) : <span className="self-start rounded-full bg-[#E4F1EA] px-3 py-[3px] text-[13px] font-semibold text-[#2E6B48]">{etat.texte}</span>
              )}
              <div className="flex flex-col gap-2 text-[15px]">
                <p><span className="block text-[11.5px] uppercase tracking-[0.1em] text-[#2E6B48]">Fait seul</span>{seul}</p>
                <p><span className="block text-[11.5px] uppercase tracking-[0.1em] text-[#B24A0C]">Vous demande toujours</span>{demande}</p>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-x-5 border-t border-[#EEEDEA] pt-1.5">
                <Link to={`/studio/equipe/${a.id}`} className={CL_LIEN}>
                  {a.super_pouvoirs.length ? 'Voir ses pouvoirs spéciaux' : `Voir la fiche de ${a.prenom}`}
                </Link>
                <Link to={`/studio/assistants/${a.id}`} className={cx(CL_LIEN, 'font-medium text-[#5F5B57]')}>Discuter</Link>
              </div>
            </article>
          );
        })}
        {me.user.role === 'proprietaire' && (
          <Link to="/studio/reglages/perimetre"
            className="flex min-h-[240px] flex-col items-center justify-center gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-[#CFCBC6] p-[22px] text-center text-[#141414] hover:border-[#141414]">
            <span aria-hidden className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-[1.5px] border-[#CFCBC6] text-[#5F5B57]"><Plus className="h-[22px] w-[22px]" /></span>
            <span className="text-[19px] font-bold">Ajouter un agent</span>
            <span className="max-w-[240px] text-sm text-[#5F5B57]">Un nouveau métier dans l'équipe : le choix et le tarif sont dans « Mon périmètre ».</span>
          </Link>
        )}
      </div>
    </div>
  );
}
