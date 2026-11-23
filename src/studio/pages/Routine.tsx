// Écran Routine (refonte §3.4) : la chaîne d'étapes, « En clair » recalculé à chaque réglage,
// le panneau de l'étape choisie (1 à 3 réglages en langage courant), l'historique en phrases.
// Chaque réglage est enregistré aussitôt ; le serveur recalcule la phrase et la consigne.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Lock, Minus, Play, Plus, Trash2 } from 'lucide-react';
import { appel } from '../api';
import { Chargement, cx } from '../composants';
import { useStudio } from '../StudioApp';
import {
  COULEURS_HISTORIQUE, compteActives, dateCourte, etatRoutine, sousTitre, surtitre, titrePanneau, valeurCompteur,
  type DefReglage, type EtapeVue, type ReponseRoutines, type Routine as RoutineT, type Valeur,
} from '../routinesVue';
import { Bascule, ChaineEtapes, CL_BOUTON_CLAIR, CL_BOUTON_NOIR, CL_LIEN, CL_SURTITRE } from '../routines/composants';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HEURES = Array.from({ length: 17 }, (_, i) => i + 6); // 6 h → 22 h
const puce = (on: boolean) => cx('min-h-[44px] min-w-[48px] rounded-none border px-2.5 text-sm',
  on ? 'border-[#17120E] bg-[#17120E] font-semibold text-white' : 'border-[#D9CEC3] bg-white text-[#17120E] hover:border-[#17120E]');
const bascule = (liste: number[], v: number) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]).sort((a, b) => a - b);

export default function Routine() {
  const { id } = useParams();
  const { me, gerer } = useStudio();
  const navigate = useNavigate();
  const proprio = me.user.role === 'proprietaire';
  const [rep, setRep] = useState<ReponseRoutines | null>(null);
  const [erreur, setErreur] = useState('');
  const [choisie, setChoisie] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [info, setInfo] = useState('');
  // Valeurs affichées tout de suite, enregistrées un instant après (compteurs, texte).
  const [local, setLocal] = useState<Record<string, Valeur>>({});
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const charger = useCallback(() => appel<ReponseRoutines>('routines').then(setRep).catch((e) => setErreur(gerer(e))), [gerer]);
  useEffect(() => { charger(); }, [charger]);
  const r = rep?.routines.find((x) => x.id === id) ?? null;
  // Un passage tourne : on rafraîchit jusqu'à la fin.
  useEffect(() => {
    if (!r?.en_cours) return;
    const t = setInterval(charger, 5000);
    return () => clearInterval(t);
  }, [r?.en_cours, charger]);
  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current); }, []);

  const agir = async (action: string, donnees: Record<string, unknown>, apres?: string) => {
    setOccupe(true); setErreur(''); setInfo('');
    try {
      const nouv = await appel<ReponseRoutines>(action, { id, ...donnees });
      setRep(nouv); setLocal({});
      if (apres) setInfo(apres);
      return true;
    } catch (e) { setErreur(gerer(e)); setLocal({}); return false; }
    finally { setOccupe(false); }
  };

  if (!rep) return erreur ? <p className="text-sm text-red-700" role="alert">{erreur}</p> : <Chargement />;
  if (!r) return <Navigate to="/studio/routines" replace />;

  const etapes = r.etapes;
  const sel = etapes.find((e) => e.id === choisie) ?? etapes.find((e) => e.reglages.length) ?? etapes[0];
  const index = etapes.indexOf(sel);
  const prenom = (a: string) => me.agents.find((x) => x.id === a)?.prenom ?? a;
  const valeurs = { ...r.reglages, ...local };
  const etat = etatRoutine(r);
  const derniere = r.historique.find((l) => l.ton !== 'en_cours');

  const regler = (d: DefReglage, v: Valeur, differe = false) => {
    setLocal((x) => ({ ...x, [d.id]: v }));
    if (minuteur.current) clearTimeout(minuteur.current);
    const envoyer = () => agir('routine_regler', { reglages: { [d.id]: v } });
    if (differe) minuteur.current = setTimeout(envoyer, 600); else envoyer();
  };
  const essayer = () => agir('routine_essayer', {}, "Essai lancé : la routine tourne à blanc, rien n'est envoyé. Le résultat s'affiche dans « Ce qui s'est passé ».");

  return (
    <div className="flex flex-col gap-6 text-[17px] leading-normal text-[#17120E]">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-col gap-2">
          <Link to="/studio/routines" className={cx(CL_SURTITRE, 'self-start no-underline hover:underline')}>{compteActives(rep.routines)}</Link>
          <h1 className="text-[clamp(26px,3vw,36px)] font-extrabold leading-[1.1] tracking-[-0.025em]">{r.titre}</h1>
          <p className="text-[15px] text-[#615850]">{sousTitre(r)}</p>
        </div>
        {proprio && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Bascule actif={r.actif} disabled={occupe} onChange={(v) => agir('routine_regler', { actif: v })}
              className="border-[#D9CEC3] bg-white font-semibold">
              {r.actif ? 'Routine active' : 'Routine en pause'}
            </Bascule>
            <button type="button" className={CL_BOUTON_NOIR} disabled={occupe || r.en_cours} onClick={essayer}>
              {r.en_cours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              {r.en_cours ? 'Passage en cours…' : 'Essayer sur un vrai cas'}
            </button>
          </div>
        )}
      </header>

      {(r.essai_jusqu_au || etat.ton === 'travail') && (
        <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3 text-[15px]',
          etat.ton === 'attente' ? 'bg-[#FDEEE2]' : 'bg-[#E3EEF6]')} role="status">
          <p className="min-w-0 flex-1">
            {etat.ton === 'attente'
              ? <>L'essai de 7 jours est terminé : la routine continue à blanc tant que vous ne l'avez pas mise en route. Rien n'est envoyé.</>
              : r.essai_jusqu_au
                ? <>{etat.ton === 'travail' ? 'Passage en cours. ' : ''}Mode essai jusqu'au {new Date(r.essai_jusqu_au).toLocaleDateString('fr-FR', { timeZone: 'Indian/Reunion', weekday: 'long', day: 'numeric', month: 'long' })} : la routine vous montre ce qu'elle aurait fait, <b className="font-semibold">sans rien envoyer</b>.</>
                : <>Passage en cours…</>}
          </p>
          {proprio && r.essai_jusqu_au && (
            <button type="button" className={CL_BOUTON_CLAIR} disabled={occupe}
              onClick={() => { if (confirm(`Mettre en route « ${r.titre} » ? Elle agira pour de vrai ; vous validerez toujours avant que quoi que ce soit parte.`)) agir('routine_activer', {}, 'Routine en route.'); }}>
              Mettre en route maintenant
            </button>
          )}
        </div>
      )}
      {erreur && <p className="rounded-xl bg-red-50 px-4 py-3 text-[15px] text-red-800" role="alert">{erreur}</p>}
      {info && <p className="rounded-xl bg-[#E4F1EA] px-4 py-3 text-[15px] text-[#2E6B48]" role="status">{info}</p>}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_440px] flex-col gap-6">
          <ChaineEtapes etapes={etapes} enClair={r.en_clair} choisie={sel.id} onChoisir={setChoisie} agents={me.agents} heures={r.heures}
            pied={proprio && <Link to="/studio/routines/nouvelle" className={cx(CL_LIEN, 'mt-3.5 font-medium')}>Une autre façon de faire ? Décrivez-la à Léa</Link>} />

          <section aria-label="Ce qui s'est passé" className="flex flex-col rounded-none border border-[#E6DCD2] bg-white px-6 py-[22px]">
            <h2 className="mb-2 text-[19px] font-bold">Ce qui s'est passé</h2>
            {r.historique.length ? r.historique.map((l, i) => (
              <div key={`${l.date}-${i}`} className="flex flex-wrap items-start gap-x-3.5 gap-y-1 border-t border-[#E6DCD2] py-3">
                <span className="w-28 flex-none pt-0.5 text-[13px] text-[#615850]">{dateCourte(l.date)}</span>
                <span className="flex min-w-0 flex-1 items-start gap-3">
                  <span aria-hidden className="mt-2 h-2.5 w-2.5 flex-none rounded-full" style={{ background: COULEURS_HISTORIQUE[l.ton] }} />
                  <span className="min-w-0 flex-1 text-[15px]">{l.texte}</span>
                </span>
              </div>
            )) : (
              <p className="border-t border-[#E6DCD2] pt-3 text-[15px] text-[#615850]">
                Pas encore de passage. {proprio && '« Essayer sur un vrai cas » en lance un tout de suite, à blanc.'}
              </p>
            )}
          </section>

          {r.consigne_origine && (
            <details className="rounded-2xl border border-[#E6DCD2] bg-white px-5 py-3 text-[15px]">
              <summary className="min-h-[44px] cursor-pointer py-2.5 font-semibold">Consigne d'origine de cette tâche</summary>
              <p className="whitespace-pre-line pb-2 text-[#615850]">{r.consigne_origine}</p>
            </details>
          )}
          {proprio && (
            <button type="button" disabled={occupe}
              onClick={async () => { if (confirm(`Supprimer la routine « ${r.titre} » ? Son historique sera effacé.`) && await agir('routine_supprimer', {})) navigate('/studio/routines'); }}
              className="inline-flex min-h-[44px] items-center gap-2 self-start text-[15px] text-[#615850] hover:text-red-700">
              <Trash2 className="h-4 w-4" /> Supprimer la routine
            </button>
          )}
        </div>

        <aside aria-label="Réglages de l'étape sélectionnée"
          className="flex min-w-0 max-w-full flex-[1_1_340px] flex-col gap-[22px] rounded-none border border-[#E6DCD2] bg-white p-6 lg:sticky lg:top-6">
          <div className="flex flex-col gap-1">
            <p className={cx('text-[11.5px] uppercase tracking-[0.06em]', sel.type === 'validation' || sel.type === 'depart' ? 'font-semibold text-[#B24A0C]' : 'text-[#1F5B85]')}>
              {surtitre(sel, index, prenom)}
            </p>
            <h2 className="text-[22px] font-bold leading-tight">{titrePanneau(sel, prenom)}</h2>
          </div>

          {sel.type === 'depart' && (
            <Depart r={r} desactive={!proprio || occupe} onChange={(p) => agir('routine_regler', p)} />
          )}
          {sel.type === 'validation' && <Validation e={sel} />}
          {(sel.type === 'agent' || sel.type === 'envoi') && (
            <>
              {sel.reglages.length ? sel.reglages.map((d) => (
                <Reglage key={d.id} d={d} v={valeurs[d.id]} desactive={!proprio || occupe} onChange={regler} />
              )) : <p className="text-[15px] text-[#615850]">Rien à régler à cette étape{sel.type === 'envoi' ? " : l'envoi suit toujours votre feu vert" : ''}.</p>}
              <div className="flex flex-col gap-2.5 border-t border-[#E6DCD2] pt-[18px]">
                <p className="text-[11.5px] uppercase tracking-[0.06em] text-[#615850]">{derniere ? `La dernière fois · ${dateCourte(derniere.date)}` : 'La dernière fois'}</p>
                <p className="text-[15px]">{derniere ? derniere.texte : "La routine n'a pas encore tourné."}</p>
                {proprio && (
                  <button type="button" className={cx(CL_BOUTON_CLAIR, 'self-start')} disabled={occupe || r.en_cours} onClick={essayer}>
                    <Play className="h-4 w-4" /> Essayer avec ce réglage
                  </button>
                )}
                <p className="text-[13.5px] text-[#615850]">Un essai tourne sur vos vraies données, sans rien envoyer.</p>
              </div>
            </>
          )}

          {proprio && (
            <div className="mt-auto flex flex-col gap-1.5 border-t border-[#E6DCD2] pt-4">
              <p className="text-sm text-[#615850]">Une modification plus complexe ?</p>
              <Link to="/studio/routines/nouvelle" className={CL_LIEN}>Dites-le à Léa en une phrase</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Départ : le sélecteur jours / heures des tâches planifiées, repris tel quel. */
function Depart({ r, desactive, onChange }: { r: RoutineT; desactive: boolean; onChange: (p: { jours?: number[]; heures?: number[] }) => void }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Jours</p>
        <div role="group" aria-label="Jours" className="flex flex-wrap gap-1.5">
          {JOURS.map((j, i) => (
            <button key={j} type="button" aria-pressed={r.jours.includes(i + 1)} disabled={desactive} className={puce(r.jours.includes(i + 1))}
              onClick={() => onChange({ jours: bascule(r.jours, i + 1) })}>{j}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Heures (La Réunion)</p>
        <div role="group" aria-label="Heures" className="flex flex-wrap gap-1.5">
          {HEURES.map((h) => (
            <button key={h} type="button" aria-pressed={r.heures.includes(h)} disabled={desactive} className={puce(r.heures.includes(h))}
              onClick={() => onChange({ heures: bascule(r.heures, h) })}>{h} h</button>
          ))}
        </div>
      </div>
      <p className="text-sm text-[#615850]">
        La routine part à heures fixes. Pour réagir vite à un message, choisissez plusieurs heures dans la journée : à chacune, l'agent regarde s'il y a du nouveau.
      </p>
    </div>
  );
}

/** « Vous validez » : rien à régler, et la règle dite clairement. */
function Validation({ e }: { e: EtapeVue }) {
  return (
    <div className="flex flex-col gap-4">
      {e.verrouillee && (
        <div className="flex items-start gap-3 rounded-xl bg-[#FDEEE2] px-4 py-3.5">
          <Lock aria-hidden className="mt-0.5 h-5 w-5 flex-none text-[#B24A0C]" />
          <p className="text-[15px]">Cette étape ne peut pas être retirée : la routine écrit ou publie en votre nom. Rien ne part sans votre feu vert.</p>
        </div>
      )}
      <p className="text-[15px]">Les propositions arrivent dans « Aujourd'hui », sur ordinateur comme sur téléphone. Vous validez, modifiez ou refusez d'un geste.</p>
      <p className="text-[15px]"><b className="font-semibold">Sans réponse de votre part, rien ne part.</b></p>
    </div>
  );
}

/** Un réglage en langage courant : compteur, choix, bascule ou adresse. */
function Reglage({ d, v, desactive, onChange }: { d: DefReglage; v: Valeur | undefined; desactive: boolean; onChange: (d: DefReglage, v: Valeur, differe?: boolean) => void }) {
  const idLibelle = `reglage-${d.id}`;
  if (d.type === 'compteur') {
    const n = Number(v ?? d.defaut);
    const bouton = 'flex h-12 w-12 items-center justify-center rounded-xl border border-[#D9CEC3] bg-white text-[22px] hover:border-[#17120E] disabled:opacity-40';
    return (
      <div className="flex flex-col gap-2">
        <p id={idLibelle} className="text-[15px] font-medium">{d.libelle}</p>
        <div role="group" aria-labelledby={idLibelle} className="flex items-center gap-3">
          <button type="button" aria-label="Moins" className={bouton} disabled={desactive || n <= d.min} onClick={() => onChange(d, Math.max(d.min, n - d.pas), true)}><Minus className="h-5 w-5" /></button>
          <span className="min-w-[120px] text-center text-[26px] font-bold tabular-nums" aria-live="polite">{valeurCompteur(d, n)}</span>
          <button type="button" aria-label="Plus" className={bouton} disabled={desactive || n >= d.max} onClick={() => onChange(d, Math.min(d.max, n + d.pas), true)}><Plus className="h-5 w-5" /></button>
        </div>
      </div>
    );
  }
  if (d.type === 'choix') {
    const actuel = String(v ?? d.defaut);
    return (
      <div className="flex flex-col gap-2">
        <p id={idLibelle} className="text-[15px] font-medium">{d.libelle}</p>
        <div role="group" aria-labelledby={idLibelle} className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
          {d.options.map((o) => (
            <button key={o.valeur} type="button" aria-pressed={actuel === o.valeur} disabled={desactive} onClick={() => onChange(d, o.valeur)}
              className={cx('min-h-[48px] rounded-xl px-3 text-[15px]', actuel === o.valeur ? 'border-2 border-[#17120E] bg-[#F2ECE4] font-semibold' : 'border border-[#D9CEC3] bg-white hover:border-[#17120E]')}>
              {o.libelle}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (d.type === 'bascule') {
    return (
      <div className="flex flex-col gap-1.5">
        <Bascule actif={Boolean(v ?? d.defaut)} disabled={desactive} onChange={(x) => onChange(d, x)}>{d.libelle}</Bascule>
        {d.aide && <p className="text-sm text-[#615850]">{d.aide}</p>}
      </div>
    );
  }
  return <ChampTexte d={d} v={String(v ?? d.defaut)} desactive={desactive} onChange={(x) => onChange(d, x)} />;
}

function ChampTexte({ d, v, desactive, onChange }: { d: Extract<DefReglage, { type: 'texte' }>; v: string; desactive: boolean; onChange: (v: string) => void }) {
  const [t, setT] = useState(v);
  useEffect(() => setT(v), [v]);
  return (
    <label className="flex flex-col gap-2 text-[15px] font-medium">
      {d.libelle}
      <span className="flex gap-2">
        <input type={d.format === 'email' ? 'email' : 'text'} value={t} disabled={desactive} onChange={(e) => setT(e.target.value)}
          className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-[#D9CEC3] bg-white px-3 font-normal text-[#17120E] outline-none focus:border-[#17120E]" />
        <button type="button" className={CL_BOUTON_CLAIR} disabled={desactive || t.trim() === v} onClick={() => onChange(t.trim())}>Enregistrer</button>
      </span>
    </label>
  );
}
