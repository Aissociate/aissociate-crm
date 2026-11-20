// « Nouvelle routine » (refonte §3.5) : le dirigeant dit ce qu'il ne veut plus faire (écrit ou
// dicté) et Léa propose la chaîne, ou il part d'un modèle de la galerie. Une seule question avant
// la mise en place ; jamais de consigne à rédiger ni d'agent à choisir. La routine démarre à
// l'essai : pendant 7 jours, elle montre ce qu'elle aurait fait sans rien envoyer.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Mic, MicOff, PlugZap } from 'lucide-react';
import { appel } from '../api';
import { Avatar, Chargement, cx } from '../composants';
import { useStudio } from '../StudioApp';
import { useDictee } from '../aujourdhui/DemanderLea';
import type { EtapeVue, ModeleGalerie, Proposition } from '../routinesVue';
import { CL_BOUTON_NOIR, CL_LIEN, CL_SURTITRE, ListeEtapes } from '../routines/composants';

type Galerie = { capacites: string[]; modeles: ModeleGalerie[] };
type ReponseLea = { proposition: Proposition; etapes: EtapeVue[]; en_clair: string };
type Choix = { sorte: 'modele'; m: ModeleGalerie } | { sorte: 'lea'; r: ReponseLea };

export default function NouvelleRoutine() {
  const { me, gerer } = useStudio();
  const navigate = useNavigate();
  const [galerie, setGalerie] = useState<Galerie | null>(null);
  const [demande, setDemande] = useState('');
  const [choix, setChoix] = useState<Choix | null>(null);
  const [reponse, setReponse] = useState<number | null>(null);
  const [saisie, setSaisie] = useState('');
  const [attente, setAttente] = useState<'' | 'lea' | 'creation'>('');
  const [erreur, setErreur] = useState('');
  const dictee = useDictee((t) => setDemande((d) => (d ? `${d} ${t}` : t)));
  const lea = me.agents.find((a) => a.id === 'lea');

  useEffect(() => {
    appel<Galerie>('routine_modeles').then((g) => {
      setGalerie(g);
      setChoix((c) => c ?? (g.modeles[0] ? { sorte: 'modele', m: g.modeles[0] } : null));
    }).catch((e) => setErreur(gerer(e)));
  }, [gerer]);

  if (me.user.role !== 'proprietaire') return <Navigate to="/studio/routines" replace />;

  const choisir = (c: Choix) => { setChoix(c); setReponse(null); setSaisie(''); setErreur(''); };
  const confier = async (e: FormEvent) => {
    e.preventDefault();
    if (demande.trim().length < 8 || attente) return;
    setAttente('lea'); setErreur('');
    try { choisir({ sorte: 'lea', r: await appel<ReponseLea>('routine_proposer', { demande }) }); }
    catch (x) { setErreur(gerer(x)); }
    finally { setAttente(''); }
  };
  const mettreEnPlace = async () => {
    if (!choix || attente) return;
    setAttente('creation'); setErreur('');
    try {
      const r = await appel<{ id: string }>('routine_creer', {
        ...(choix.sorte === 'modele' ? { modele: choix.m.id } : { proposition: choix.r.proposition }),
        ...(reponse !== null ? { reponse } : {}), ...(saisie.trim() ? { saisie: saisie.trim() } : {}),
      });
      navigate(`/studio/routines/${r.id}`);
    } catch (x) { setErreur(gerer(x)); setAttente(''); }
  };

  const etapes = choix ? (choix.sorte === 'modele' ? choix.m.etapes : choix.r.etapes) : [];
  const question = choix ? (choix.sorte === 'modele' ? choix.m.question : { ...choix.r.proposition.question, saisie: null }) : null;
  const repondu = reponse !== null || Boolean(saisie.trim());
  const prenom = (id: string) => me.agents.find((a) => a.id === id);

  return (
    <div className="flex flex-col gap-8 text-[17px] leading-normal text-[#141414]">
      <section className="flex max-w-[760px] flex-col gap-4">
        <Link to="/studio/routines" className={cx(CL_SURTITRE, 'self-start no-underline hover:underline')}>Nouvelle routine</Link>
        <h1 className="text-[clamp(30px,3.6vw,44px)] font-extrabold leading-[1.05] tracking-[-0.03em]">Quelle tâche ne voulez-vous plus faire vous-même ?</h1>
        <form onSubmit={confier} className="flex flex-wrap items-center gap-2.5 rounded-[18px] border-[1.5px] border-[#141414] bg-white py-2 pl-5 pr-2">
          <label htmlFor="souhait" className="sr-only">Décrivez la tâche</label>
          <input id="souhait" value={demande} maxLength={2000} onChange={(e) => setDemande(e.target.value)}
            placeholder="Ex. : quand un client demande un devis, lui répondre dans la journée"
            className="min-h-[48px] min-w-[200px] flex-1 bg-transparent text-[17px] text-[#141414] outline-none placeholder:text-[#8A857F]" />
          {dictee.disponible && (
            <button type="button" onClick={dictee.basculer} aria-pressed={dictee.ecoute} aria-label={dictee.ecoute ? 'Arrêter la dictée' : 'Dicter'}
              className={cx('flex h-[52px] w-[52px] items-center justify-center rounded-xl border', dictee.ecoute ? 'border-[#B24A0C] bg-[#FDEEE2] text-[#B24A0C]' : 'border-[#D6D3CF] bg-[#F6F5F3]')}>
              {dictee.ecoute ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
          <button type="submit" className={cx(CL_BOUTON_NOIR, 'min-h-[52px]')} disabled={demande.trim().length < 8 || Boolean(attente)}>
            {attente === 'lea' && <Loader2 className="h-4 w-4 animate-spin" />} Confier à Léa
          </button>
        </form>
        {attente === 'lea' && <p className="text-[15px] text-[#5F5B57]" role="status">Léa prépare un déroulé… cela prend jusqu'à une minute.</p>}
      </section>

      {erreur && <p className="max-w-[760px] rounded-xl bg-red-50 px-4 py-3 text-[15px] text-red-800" role="alert">{erreur}</p>}

      <div className="flex flex-wrap items-start gap-7">
        <section aria-label="Routines prêtes à l'emploi" className="flex min-w-0 flex-[999_1_480px] flex-col gap-3.5">
          <h2 className="text-[19px] font-bold">Ou partez d'une routine prête à l'emploi</h2>
          {!galerie ? <Chargement /> : !galerie.modeles.length ? (
            <p className="text-[15px] text-[#5F5B57]">Aucun modèle ne correspond à votre équipe : décrivez la tâche à Léa ci-dessus.</p>
          ) : (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr))]">
              {galerie.modeles.map((m) => {
                const on = choix?.sorte === 'modele' && choix.m.id === m.id;
                const a = prenom(m.agent);
                return (
                  <button key={m.id} type="button" aria-pressed={on} onClick={() => choisir({ sorte: 'modele', m })}
                    className={cx('flex min-h-[132px] flex-col gap-3 rounded-2xl bg-white p-[18px] text-left',
                      on ? 'border-2 border-[#141414] shadow-[0_10px_28px_rgba(23,18,14,0.12)]' : 'border border-[#E7E5E2] hover:border-[#141414]')}>
                    <span className="flex items-center gap-2.5">
                      {a && <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={32} />}
                      <span className="text-[13.5px] text-[#5F5B57]">{a ? `${a.prenom} · ${a.metier}` : m.agent}</span>
                    </span>
                    <span className="text-[18px] font-bold leading-tight">{m.titre}</span>
                    <span className="mt-auto text-sm text-[#5F5B57]">{m.gain}</span>
                    {m.manque.length > 0 && (
                      <span className="flex items-center gap-1.5 text-[13px] text-[#B24A0C]"><PlugZap aria-hidden className="h-3.5 w-3.5" /> À relier : {m.manque.join(', ')}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {choix && question && (
          <aside aria-label="Proposition de Léa" className="flex min-w-0 flex-[1_1_360px] flex-col gap-[18px] rounded-[20px] border border-[#E7E5E2] bg-white p-6">
            <div className="flex items-center gap-3">
              {lea && <Avatar prenom={lea.prenom} couleur={lea.couleur} photo={lea.photo} taille={40} />}
              <p className="text-[15px] text-[#5F5B57]"><b className="font-semibold text-[#141414]">Léa</b> vous propose ce déroulé</p>
            </div>
            <h2 className="text-[22px] font-bold leading-tight">{choix.sorte === 'modele' ? choix.m.titre : choix.r.proposition.titre}</h2>
            <ListeEtapes etapes={etapes} />
            {choix.sorte === 'modele' && choix.m.manque.length > 0 && (
              <p className="rounded-xl bg-[#FDEEE2] px-4 py-3 text-[15px]">
                Pour travailler, cette routine a besoin de {choix.m.manque.join(' et ')}. <Link to="/studio/reglages" className="font-semibold underline">Relier mes outils</Link>
              </p>
            )}
            <div className="flex flex-col gap-2.5 rounded-2xl bg-[#F6F5F3] p-4">
              <p className="text-[15px] font-semibold">Une seule question avant de commencer :</p>
              <p className="text-[15px]" id="question-lea">{question.texte}</p>
              {question.saisie && (
                <label className="flex flex-col gap-1.5 text-sm text-[#5F5B57]">
                  {question.saisie.libelle}
                  <input type="email" value={saisie} onChange={(e) => { setSaisie(e.target.value); if (e.target.value) setReponse(null); }}
                    className="min-h-[48px] rounded-xl border border-[#D6D3CF] bg-white px-3 text-[15px] text-[#141414] outline-none focus:border-[#141414]" />
                </label>
              )}
              <div role="group" aria-labelledby="question-lea" className="flex flex-wrap gap-2">
                {question.reponses.map((libelle, i) => (
                  <button key={libelle} type="button" aria-pressed={reponse === i} onClick={() => { setReponse(i); setSaisie(''); }}
                    className={cx('min-h-[44px] rounded-full border px-4 text-[15px]', reponse === i ? 'border-[#141414] bg-[#141414] text-white' : 'border-[#D6D3CF] bg-white hover:border-[#141414]')}>
                    {libelle}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button type="button" className={CL_BOUTON_NOIR} disabled={!repondu || Boolean(attente)} onClick={mettreEnPlace}>
                {attente === 'creation' && <Loader2 className="h-4 w-4 animate-spin" />} Mettre en place
              </button>
              {!repondu && <span className="text-sm text-[#5F5B57]">Répondez d'abord à la question de Léa.</span>}
            </div>
            <p className="text-[13.5px] text-[#5F5B57]">
              La routine démarre en mode essai : pendant 7 jours, elle vous montre ce qu'elle aurait fait, sans rien envoyer. Vous pourrez ensuite régler chaque étape.
            </p>
            <Link to="/studio/routines" className={cx(CL_LIEN, 'self-start font-medium text-[#5F5B57]')}>Retour aux routines</Link>
          </aside>
        )}
      </div>
    </div>
  );
}
