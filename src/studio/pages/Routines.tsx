// « Routines » (refonte §3.4) : une carte par routine — ce qu'elle fait en une phrase, son état,
// ce qui s'est passé la dernière fois. La dernière carte mène à « Nouvelle routine ».
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Workflow } from 'lucide-react';
import { appel } from '../api';
import { Avatar, Chargement, cx } from '../composants';
import { useStudio } from '../StudioApp';
import { COULEURS_HISTORIQUE, compteActives, dateCourte, etatRoutine, type Etat, type ReponseRoutines } from '../routinesVue';
import { CL_BOUTON_NOIR, CL_LIEN, CL_SURTITRE } from '../routines/composants';

const TONS_ETAT: Record<Etat['ton'], string> = {
  essai: 'bg-[#E3EEF6] text-[#1F5B85]', attente: 'bg-[#FDEEE2] text-[#B24A0C]', pause: 'bg-[#E6DCD2] text-[#615850]',
  actif: 'bg-[#E4F1EA] text-[#2E6B48]', travail: 'bg-[#E4F1EA] text-[#2E6B48]',
};

export default function Routines() {
  const { me, gerer } = useStudio();
  const proprio = me.user.role === 'proprietaire';
  const [rep, setRep] = useState<ReponseRoutines | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => { appel<ReponseRoutines>('routines').then(setRep).catch((e) => setErreur(gerer(e))); }, [gerer]);

  if (!rep) return erreur ? <p className="text-sm text-red-700" role="alert">{erreur}</p> : <Chargement />;
  const agent = (id: string) => me.agents.find((a) => a.id === id);

  return (
    <div className="flex flex-col gap-7 text-[17px] leading-normal text-[#17120E]">
      <header className="flex max-w-[720px] flex-col gap-2.5">
        <p className={CL_SURTITRE}>{compteActives(rep.routines)}</p>
        <h1 className="text-[clamp(30px,3.6vw,44px)] font-extrabold leading-[1.05] tracking-[-0.03em]">Ce que votre équipe fait sans qu'on le lui demande.</h1>
        <p className="text-[#615850]">Chaque routine tourne seule, aux heures choisies. Tout ce qui part attend votre feu vert dans « Aujourd'hui ».</p>
      </header>

      {!rep.routines.length ? (
        <section className="flex max-w-[720px] flex-col items-start gap-4 rounded-none border border-[#E6DCD2] bg-white p-7">
          <Workflow aria-hidden className="h-9 w-9 text-[#B24A0C]" />
          <h2 className="text-[22px] font-bold leading-tight">Quelle tâche ne voulez-vous plus faire vous-même ?</h2>
          <p className="text-[#615850]">
            Relancer les impayés, répondre aux demandes de devis, publier chaque semaine… Décrivez-la à Léa, ou partez d'une routine prête à l'emploi.
            Elle démarre à l'essai : pendant 7 jours, elle vous montre ce qu'elle aurait fait, sans rien envoyer.
          </p>
          {proprio ? <Link to="/studio/routines/nouvelle" className={CL_BOUTON_NOIR}>Créer ma première routine</Link>
            : <p className="text-[15px] text-[#615850]">Le propriétaire de l'espace peut en créer.</p>}
        </section>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
          {rep.routines.map((r) => {
            const etat = etatRoutine(r);
            const derniere = r.historique.find((l) => l.ton !== 'en_cours');
            const a = agent(r.agent_id);
            return (
              <article key={r.id} aria-labelledby={`routine-${r.id}`} className={cx('flex flex-col gap-3.5 rounded-none border border-[#E6DCD2] bg-white p-[22px]', !r.actif && 'opacity-80')}>
                <div className="flex items-center gap-3">
                  {a && <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={40} />}
                  <h2 id={`routine-${r.id}`} className="min-w-0 flex-1 text-[19px] font-bold leading-tight">{r.titre}</h2>
                </div>
                <span className={cx('self-start rounded-full px-3 py-[3px] text-[13px] font-semibold', TONS_ETAT[etat.ton])}>{etat.texte}</span>
                <p className="text-[15px] text-[#483C32]">{r.en_clair}</p>
                {derniere && (
                  <p className="flex items-start gap-2 text-sm text-[#615850]">
                    <span aria-hidden className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: COULEURS_HISTORIQUE[derniere.ton] }} />
                    <span><span className="font-medium">{dateCourte(derniere.date)} :</span> {derniere.texte}</span>
                  </p>
                )}
                <div className="mt-auto border-t border-[#E6DCD2] pt-1.5">
                  <Link to={`/studio/routines/${r.id}`} className={CL_LIEN}>{proprio ? 'Voir et régler' : 'Voir le détail'}</Link>
                </div>
              </article>
            );
          })}
          {proprio && (
            <Link to="/studio/routines/nouvelle"
              className="flex min-h-[220px] flex-col items-center justify-center gap-2.5 rounded-none border-[1.5px] border-dashed border-[#D9CEC3] p-[22px] text-center text-[#17120E] hover:border-[#17120E]">
              <span aria-hidden className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-[1.5px] border-[#D9CEC3] text-[#615850]"><Plus className="h-[22px] w-[22px]" /></span>
              <span className="text-[19px] font-bold">Nouvelle routine</span>
              <span className="max-w-[240px] text-sm text-[#615850]">Dites à Léa ce que vous ne voulez plus faire vous-même.</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
