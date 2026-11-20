// Fiche d'un spécialiste et ses pouvoirs spéciaux. Un pouvoir ouvre une mission guidée
// (missionGuidee.ts) : une question en un clic, une précision écrite ou dictée, puis
// « Confier à … ». La mission tourne côté serveur même si l'on quitte la page ; son
// résultat arrive dans « Aujourd'hui », à valider.
import { useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, Mic, Zap } from 'lucide-react';
import { appel, discuter, ORCHESTRATEUR, type Agent, type Champ, type SuperPouvoir } from '../api';
import { Avatar, cx } from '../composants';
import { useDictee } from '../aujourdhui/DemanderLea';
import { autonomie, champManquant, guider, recoit, valeursInitiales } from '../missionGuidee';
import { useStudio } from '../StudioApp';

const CL_CHAMP = 'min-h-[50px] w-full rounded-xl border border-[#D6D3CF] bg-white px-3.5 text-base text-[#141414] outline-none focus:border-[#141414]';
const CL_PASTILLE = 'min-h-[46px] rounded-full border px-4 text-base';
const actif = (on: boolean) => (on ? 'border-[#141414] bg-[#141414] text-white' : 'border-[#D6D3CF] bg-white text-[#141414] hover:bg-[#F6F5F3]');

export default function Specialiste() {
  const { me } = useStudio();
  const { agentId } = useParams();
  const [params, setParams] = useSearchParams();
  const agent = me.agents.find((a) => a.id === agentId);
  if (!agent) return <Navigate to="/studio/equipe" replace />;
  const pouvoir = agent.super_pouvoirs.find((p) => p.id === params.get('p')) ?? agent.super_pouvoirs[0] ?? null;
  const { seul, demande } = autonomie(agent.id);

  return (
    <div className="flex flex-col gap-[26px] text-[17px] leading-normal text-[#141414]">
      <nav aria-label="Choisir un spécialiste" className="flex flex-wrap gap-2">
        {me.agents.map((a) => (
          <Link key={a.id} to={`/studio/equipe/${a.id}`} aria-current={a.id === agent.id ? 'page' : undefined}
            className={cx('flex min-h-[48px] items-center gap-2 rounded-full border py-1 pl-1.5 pr-4 text-base', a.id === agent.id ? 'font-semibold' : 'font-medium', actif(a.id === agent.id))}>
            <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={36} /> {a.prenom}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-start gap-7">
        <section className="flex min-w-0 flex-[999_1_460px] flex-col gap-[22px]">
          <header className="flex items-center gap-[18px]">
            <Avatar prenom={agent.prenom} couleur={agent.couleur} photo={agent.photo} taille={72} />
            <div className="min-w-0">
              <h1 className="text-[clamp(28px,3.2vw,38px)] font-extrabold leading-[1.1] tracking-[-0.025em]">{agent.prenom}</h1>
              <p className="mt-0.5 text-[#5F5B57]">{agent.metier}</p>
            </div>
          </header>
          {(agent.description || agent.accroche) && <p className="max-w-[60ch] text-lg">{agent.description || agent.accroche}</p>}

          {agent.super_pouvoirs.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-[19px] font-bold">Ses pouvoirs spéciaux</h2>
              <div role="group" aria-label={`Pouvoirs spéciaux de ${agent.prenom}`} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))]">
                {agent.super_pouvoirs.map((p) => {
                  const choisi = p.id === pouvoir?.id;
                  return (
                    <button key={p.id} type="button" aria-pressed={choisi} onClick={() => setParams({ p: p.id }, { replace: true })}
                      className={cx('flex min-h-[124px] flex-col gap-2 rounded-2xl bg-white px-[18px] py-4 text-left',
                        choisi ? 'border-2 border-[#141414] shadow-[0_10px_26px_rgba(20,20,20,0.10)]' : 'border border-[#E7E5E2] hover:border-[#D6D3CF]')}>
                      <span className="flex items-center gap-2.5">
                        <span aria-hidden className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#FDEEE2] text-[#B24A0C]"><Zap className="h-[18px] w-[18px]" /></span>
                        <span className="text-[17px] font-bold leading-tight">{p.titre}</span>
                      </span>
                      <span className="text-[15px] leading-snug text-[#5F5B57]">{recoit(p)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <p className="rounded-[14px] border border-[#E7E5E2] bg-white px-4 py-3.5 text-[15px]"><span className="block text-xs font-semibold uppercase tracking-[0.06em] text-[#2E6B48]">Fait seul</span>{seul}</p>
            <p className="rounded-[14px] border border-[#E7E5E2] bg-white px-4 py-3.5 text-[15px]"><span className="block text-xs font-semibold uppercase tracking-[0.06em] text-[#B24A0C]">Vous demande toujours</span>{demande}</p>
          </div>
        </section>

        <aside aria-label="Lancer la mission" className="flex min-w-0 flex-[1_1_380px] flex-col gap-[18px] rounded-[20px] border border-[#E7E5E2] bg-white p-6">
          {pouvoir
            ? <Mission key={`${agent.id}:${pouvoir.id}`} agent={agent} pouvoir={pouvoir} />
            : <p className="text-base">{agent.prenom} n'a pas de pouvoir spécial : écrivez-lui directement.</p>}
          <div className="mt-auto flex flex-col gap-1 border-t border-[#E7E5E2] pt-4">
            <p className="text-[14.5px] text-[#5F5B57]">Votre besoin n'est pas dans la liste ?</p>
            <Link to={`/studio/assistants/${me.agents.some((a) => a.id === ORCHESTRATEUR) ? ORCHESTRATEUR : agent.id}`}
              className="inline-flex min-h-[44px] items-center self-start text-base font-semibold text-[#B24A0C] underline underline-offset-[3px] hover:text-[#141414]">
              {me.agents.some((a) => a.id === ORCHESTRATEUR) && agent.id !== ORCHESTRATEUR ? 'Décrivez-le à Léa avec vos mots' : `Décrivez-le à ${agent.prenom} avec vos mots`}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Champ d'une mission, hors question en un clic : texte court, texte long ou liste. */
function ChampMission({ c, valeur, onChange, facultatif }: { c: Champ; valeur: string; onChange: (v: string) => void; facultatif?: boolean }) {
  const id = `champ-${c.nom}`;
  const dictee = useDictee((t) => onChange(valeur.trim() ? `${valeur.trim()} ${t}` : t));
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-semibold">
        {c.label} {(facultatif || !c.requis) && <span className="font-normal text-[#5F5B57]">(facultatif)</span>}
      </label>
      {c.type === 'choix' ? (
        <select id={id} value={valeur} onChange={(e) => onChange(e.target.value)} className={CL_CHAMP}>
          <option value="">Choisir…</option>
          {c.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <div className="flex items-stretch gap-2">
          {c.type === 'long'
            ? <textarea id={id} rows={3} value={valeur} onChange={(e) => onChange(e.target.value)} placeholder={c.aide} className={cx(CL_CHAMP, 'min-w-0 flex-1 py-3')} />
            : <input id={id} type="text" value={valeur} onChange={(e) => onChange(e.target.value)} placeholder={c.aide} autoComplete="off" className={cx(CL_CHAMP, 'min-w-0 flex-1')} />}
          {dictee.disponible && (
            <button type="button" onClick={dictee.basculer} aria-pressed={dictee.ecoute} aria-label={dictee.ecoute ? 'Arrêter la dictée' : `Dicter : ${c.label}`}
              className={cx('flex w-[50px] shrink-0 items-center justify-center self-start rounded-xl border min-h-[50px]',
                dictee.ecoute ? 'border-[#B24A0C] bg-[#FDEEE2] text-[#B24A0C]' : 'border-[#D6D3CF] bg-[#F6F5F3] text-[#141414]')}>
              <Mic className={cx('h-5 w-5', dictee.ecoute && 'animate-pulse')} aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Mission({ agent, pouvoir }: { agent: Agent; pouvoir: SuperPouvoir }) {
  const { gerer, rafraichir } = useStudio();
  const guide = guider(pouvoir);
  const [valeurs, setValeurs] = useState(() => valeursInitiales(pouvoir));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  /** Mission partie : la conversation où la suivre (null pour un visuel ou une vidéo). */
  const [partie, setPartie] = useState<{ conversation: string | null } | null>(null);
  const acceptee = useRef(false);
  const fixer = (nom: string, v: string) => setValeurs((x) => ({ ...x, [nom]: v }));
  const manquant = champManquant(pouvoir, valeurs);

  const lancer = async () => {
    setErreur(''); setEnvoi(true); acceptee.current = false;
    const demande = { agent_id: agent.id, pouvoir: { id: pouvoir.id, valeurs } };
    try {
      if (pouvoir.media) {
        // Visuel ou vidéo : réponse immédiate, la génération se suit dans la conversation et dans « Contenus ».
        const r = await appel<{ conversation_id?: string }>('chat', demande);
        acceptee.current = true;
        setPartie({ conversation: r.conversation_id ?? null });
      } else {
        // La mission continue côté serveur même si l'on quitte la page : dès qu'elle est acceptée, on rend la main.
        await discuter({ ...demande, mission: true }, {
          onMeta: (m) => { acceptee.current = true; setPartie({ conversation: m.conversation_id }); setEnvoi(false); },
          onDelta: () => { /* le texte se lit dans la conversation ou dans « Aujourd'hui » */ },
        });
        rafraichir();
      }
    } catch (e) {
      // Refus avant le départ (quota, champ manquant, suspension) : on le dit ; après, l'erreur est dans la conversation.
      if (!acceptee.current) setErreur(gerer(e));
    } finally { setEnvoi(false); }
  };

  if (partie) {
    return (
      <div className="flex flex-col items-start gap-4" role="status">
        <span aria-hidden className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#2E6B48] text-white"><Check className="h-[26px] w-[26px]" /></span>
        <h2 className="text-[23px] font-bold leading-tight">{agent.prenom} s'en occupe.</h2>
        <p className="text-base">
          {pouvoir.media
            ? `Vous n'avez rien à surveiller : ${pouvoir.media === 'video' ? 'la vidéo' : 'le visuel'} apparaîtra dans « Mes documents », onglet Contenus, d'ici quelques minutes.`
            : "Vous n'avez rien à surveiller : le résultat arrivera dans « Aujourd'hui », prêt à valider. Rien ne part sans votre accord."}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Link to={pouvoir.media ? '/studio/documents/contenus' : '/studio'} className="inline-flex min-h-[48px] items-center rounded-xl bg-[#141414] px-5 text-base font-semibold text-white hover:bg-[#2B2B2B]">
            {pouvoir.media ? 'Voir mes contenus' : "Voir Aujourd'hui"}
          </Link>
          <button type="button" onClick={() => { setPartie(null); setValeurs(valeursInitiales(pouvoir)); }}
            className="min-h-[48px] rounded-xl border border-[#D6D3CF] bg-white px-[18px] text-base hover:bg-[#F6F5F3]">Autre mission</button>
        </div>
        {partie.conversation && (
          <Link to={`/studio/assistants/${agent.id}?c=${partie.conversation}`} className="inline-flex min-h-[44px] items-center text-[15px] text-[#5F5B57] underline underline-offset-[3px]">
            Suivre le travail de {agent.prenom}
          </Link>
        )}
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-[18px]" onSubmit={(e) => { e.preventDefault(); if (!manquant && !envoi) lancer(); }}>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#B24A0C]">Pouvoir spécial</p>
        <h2 className="text-[23px] font-bold leading-tight">{pouvoir.titre}</h2>
      </div>
      {guide.choix && (
        <div className="flex flex-col gap-2.5">
          <p id="question-mission" className="text-base font-semibold">
            {guide.question} {!guide.choix.requis && <span className="font-normal text-[#5F5B57]">(facultatif)</span>}
          </p>
          <div role="group" aria-labelledby="question-mission" className="flex flex-wrap gap-2">
            {guide.choix.options?.map((o) => {
              const on = valeurs[guide.choix!.nom] === o;
              return (
                <button key={o} type="button" aria-pressed={on} className={cx(CL_PASTILLE, actif(on))}
                  onClick={() => fixer(guide.choix!.nom, on && !guide.choix!.requis ? '' : o)}>{o}</button>
              );
            })}
          </div>
        </div>
      )}
      {guide.precision && (
        <ChampMission c={guide.precision.requis ? guide.precision : { ...guide.precision, label: `Une précision ? ${guide.precision.label}` }}
          valeur={valeurs[guide.precision.nom] ?? ''} onChange={(v) => fixer(guide.precision!.nom, v)} />
      )}
      {guide.autres.map((c) => <ChampMission key={c.nom} c={c} valeur={valeurs[c.nom] ?? ''} onChange={(v) => fixer(c.nom, v)} />)}
      {erreur && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[15px] text-red-800" role="alert">{erreur}</p>}
      <button type="submit" disabled={Boolean(manquant) || envoi}
        className="min-h-[54px] rounded-[14px] bg-[#141414] text-[17px] font-semibold text-white hover:bg-[#2B2B2B] disabled:bg-[#B9B5B0]">
        {envoi ? 'Transmission…' : `Confier à ${agent.prenom}`}
      </button>
      <p className="text-[14.5px] text-[#5F5B57]" aria-live="polite">
        {manquant ? `Il manque : ${manquant === guide.choix ? guide.question.replace(/\s*\?$/, '') : manquant.label}.`
          : pouvoir.media ? `${agent.prenom} prépare, puis vous retrouvez le résultat dans « Mes documents ».`
            : `${agent.prenom} prépare, puis vous validez dans « Aujourd'hui ».`}
      </p>
    </form>
  );
}
