// « Demander à Léa » : une phrase, écrite ou dictée, confiée à l'orchestratrice.
// La dictée utilise la reconnaissance vocale du navigateur (aucune bibliothèque) ;
// là où elle n'existe pas (Firefox), le bouton n'est pas affiché.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mic } from 'lucide-react';
import { ORCHESTRATEUR } from '../api';
import { cx } from '../composants';
import { useStudio } from '../StudioApp';

type Reconnaissance = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start: () => void; stop: () => void;
};
type Fenetre = { SpeechRecognition?: new () => Reconnaissance; webkitSpeechRecognition?: new () => Reconnaissance };

/** Dictée vocale en français ; `disponible` est faux si le navigateur ne la propose pas. */
// eslint-disable-next-line react-refresh/only-export-components
export function useDictee(onTexte: (texte: string) => void) {
  const Ctor = typeof window === 'undefined' ? undefined : ((window as Fenetre).SpeechRecognition ?? (window as Fenetre).webkitSpeechRecognition);
  const [ecoute, setEcoute] = useState(false);
  const reco = useRef<Reconnaissance | null>(null);
  const rappel = useRef(onTexte);
  rappel.current = onTexte;
  useEffect(() => () => reco.current?.stop(), []);

  const basculer = () => {
    if (!Ctor) return;
    if (ecoute) { reco.current?.stop(); return; }
    const r = new Ctor();
    r.lang = 'fr-FR'; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => {
      const texte = Array.from(e.results).map((x) => x[0]?.transcript ?? '').join(' ').replace(/\s+/g, ' ').trim();
      if (texte) rappel.current(texte);
    };
    r.onend = () => setEcoute(false);
    r.onerror = () => setEcoute(false);
    reco.current = r;
    setEcoute(true);
    try { r.start(); } catch { setEcoute(false); }
  };
  return { disponible: Boolean(Ctor), ecoute, basculer };
}

/** Agent à qui s'adresse la demande : Léa si elle est dans l'équipe, sinon le premier agent. */
// eslint-disable-next-line react-refresh/only-export-components
export function useInterlocuteur() {
  const { me } = useStudio();
  const navigate = useNavigate();
  const agent = me.agents.find((a) => a.id === ORCHESTRATEUR) ?? me.agents[0] ?? null;
  const envoyer = (message: string) => {
    if (agent) navigate(`/studio/assistants/${agent.id}`, message.trim() ? { state: { message: message.trim() } } : undefined);
  };
  return { agent, envoyer };
}

export default function DemanderLea() {
  const { me } = useStudio();
  const { agent, envoyer } = useInterlocuteur();
  const [demande, setDemande] = useState('');
  const dictee = useDictee((t) => setDemande((d) => (d.trim() ? `${d.trim()} ${t}` : t)));
  if (!agent) return null;
  const soumettre = (e: FormEvent) => { e.preventDefault(); if (demande.trim()) envoyer(demande); };
  const seule = me.agents.length < 2;

  return (
    <div>
      <form onSubmit={soumettre} data-tuto="mission"
        className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-none border-[1.5px] border-[#17120E] bg-white py-2 pl-5 pr-2">
        <label htmlFor="demande-lea" className="whitespace-nowrap text-[15px] font-bold">Demander à {agent.prenom}</label>
        <input id="demande-lea" type="text" value={demande} onChange={(e) => setDemande(e.target.value)} autoComplete="off"
          placeholder={agent.demandes[0]?.prompt ?? 'Ex. : prépare la relance des factures en retard'}
          className="min-h-[44px] min-w-[10rem] flex-1 border-0 bg-transparent text-base text-[#17120E] outline-none placeholder:text-[#7A6F64]" />
        {dictee.disponible && (
          <button type="button" onClick={dictee.basculer} aria-pressed={dictee.ecoute}
            aria-label={dictee.ecoute ? 'Arrêter la dictée' : 'Dicter la demande'}
            className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border',
              dictee.ecoute ? 'border-[#B24A0C] bg-[#FDEEE2] text-[#B24A0C]' : 'border-[#D9CEC3] bg-[#F2ECE4] text-[#17120E]')}>
            <Mic className={cx('h-5 w-5', dictee.ecoute && 'animate-pulse')} aria-hidden />
          </button>
        )}
        <button type="submit" disabled={!demande.trim()} aria-label={`Envoyer à ${agent.prenom}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#17120E] text-white disabled:bg-[#A89C90]">
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      </form>
      <p className="mt-2 text-[13.5px] text-[#615850]" aria-live="polite">
        {dictee.ecoute ? 'Je vous écoute… Parlez, puis vérifiez le texte avant d\'envoyer.'
          : seule ? `${agent.prenom} prépare, vous validez.` : `${agent.prenom} répartit la demande dans l'équipe, relit, puis vous répond.`}
      </p>
    </div>
  );
}
