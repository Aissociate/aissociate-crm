// « Aujourd'hui » : le dirigeant ouvre le Studio pour décider, pas pour construire.
// À gauche, la file des décisions (les livrables « à valider »), une seule dépliée à la
// fois ; à droite, ce que l'équipe a fait cette semaine et ce qui arrive.
// Sur téléphone, une décision par écran (aujourdhui/DecisionsMobile.tsx).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { majuscule, minutesEnTexte } from '../api';
import { Avatar, Chargement } from '../composants';
import EditeurDocument from '../EditeurDocument';
import { heureLisible, jourLisible, phraseEtat } from '../decision';
import { useStudio } from '../StudioApp';
import { CarteDecision, LigneRepliee, LigneSuite, type Contexte } from '../aujourdhui/CarteDecision';
import DemanderLea from '../aujourdhui/DemanderLea';
import DecisionsMobile, { useEstMobile } from '../aujourdhui/DecisionsMobile';
import { useDecisions, type Decision, type Echeance } from '../aujourdhui/useDecisions';

const ETATS_ECHEANCE: Record<Echeance['etat'], (prenom: string) => string> = {
  routine: (p) => `${p} s'en occupe.`,
  attend: () => 'en attente de votre accord.',
  programmee: () => 'validé, partira à cette date.',
};

export default function Aujourdhui() {
  const { me, gerer, rafraichir } = useStudio();
  const decisions = useDecisions(gerer, rafraichir);
  const [document, setDocument] = useState<Decision | null>(null);
  const mobile = useEstMobile();
  const agents = new Map(me.agents.map((a) => [a.id, a]));
  const ctx: Contexte = { agents, proprietaire: me.user.role === 'proprietaire', gerer, onDocument: setDocument };
  const prenom = majuscule(me.user.prenom);
  const s = me.stats;

  const etapes = [
    { fait: me.workspace.contexte_entreprise.trim().length > 50, label: 'Présenter votre entreprise à vos agents', to: '/studio/reglages/entreprise' },
    { fait: s.ressources_actives > 0, label: 'Ajouter une ressource (plaquette, offre, charte…)', to: '/studio/documents' },
    { fait: s.minutes_gagnees_total > 0, label: 'Confier une première demande', to: '/studio/equipe' },
  ];
  const reste = etapes.filter((e) => !e.fait).length;
  const maintenant = new Date();

  return (
    <div className="flex flex-col gap-8 text-[17px] leading-normal text-[#141414]">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-[640px] flex-col gap-2.5">
          <p className="text-xs uppercase tracking-[0.08em] text-[#B24A0C]">
            {maintenant.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-[clamp(30px,3.6vw,44px)] font-extrabold leading-[1.05] tracking-[-0.03em]">
            Bonjour{prenom ? ` ${prenom}` : ''}.<br />
            <span className="font-bold text-[#5F5B57]">{decisions.pret ? phraseEtat(decisions.enAttente.length) : ' '}</span>
          </h1>
          <p className="flex items-center gap-2 text-base">
            <Lock className="h-[18px] w-[18px] shrink-0 text-[#B24A0C]" aria-hidden /> Rien n'est envoyé ni publié sans votre accord.
          </p>
        </div>
        {me.agents.length > 0 && (
          <Link to="/studio/equipe" aria-label={`Voir mon équipe : ${me.agents.length} agent${me.agents.length > 1 ? 's' : ''}`}
            className="hidden min-h-[44px] items-center gap-3 rounded-full border sm:flex border-[#E7E5E2] bg-white py-1.5 pl-3.5 pr-4 text-[#141414] hover:border-[#D6D3CF]">
            <span className="flex">
              {me.agents.slice(0, 7).map((a) => (
                <span key={a.id} className="-ml-2 rounded-full border-2 border-white first:ml-0"><Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={32} /></span>
              ))}
            </span>
            <span className="text-sm"><b className="font-semibold">{me.agents.length}</b> dans votre équipe</span>
          </Link>
        )}
      </header>

      {decisions.erreur && <p className="rounded-xl bg-red-50 px-4 py-3 text-[15px] text-red-800" role="alert">{decisions.erreur}</p>}

      <div className="flex flex-wrap items-start gap-7">
        <section aria-label="Décisions en attente" className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          {!decisions.pret ? (decisions.erreur ? null : <Chargement />) : mobile ? (
            <DecisionsMobile decisions={decisions} ctx={ctx} />
          ) : decisions.decisions.length === 0 ? (
            <div className="rounded-[18px] border border-[#E7E5E2] bg-white p-6">
              <p className="text-[19px] font-bold">Rien n'attend votre accord.</p>
              <p className="mt-1 text-[15px] text-[#5F5B57]">
                Dès qu'un agent prépare un e-mail, une publication ou un document, il apparaît ici pour que vous décidiez.
              </p>
            </div>
          ) : decisions.decisions.map((d) => {
            const suite = decisions.suites[d.id];
            if (suite) return <LigneSuite key={d.id} d={d} suite={suite} decisions={decisions} ctx={ctx} />;
            return d.id === decisions.courante?.id
              ? <CarteDecision key={d.id} d={d} decisions={decisions} ctx={ctx} />
              : <LigneRepliee key={d.id} d={d} decisions={decisions} ctx={ctx} />;
          })}
          {/* Sur téléphone, « Parler à Léa » est dans DecisionsMobile. */}
          {!mobile && <div className="mt-2"><DemanderLea /></div>}
        </section>

        <aside aria-label="Fait sans vous" className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <div className="flex flex-col gap-4 rounded-[18px] border border-[#E7E5E2] bg-white p-[22px]">
            <h2 className="text-[19px] font-bold">Fait sans vous cette semaine</h2>
            {decisions.faits.length ? (
              <ul className="flex flex-col gap-3.5">
                {decisions.faits.map((f) => {
                  const a = agents.get(f.agent_id);
                  return (
                    <li key={f.agent_id} className="flex items-start gap-3">
                      {a && <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={28} />}
                      <span className="text-[15px] leading-[1.45]"><b className="font-semibold">{a?.prenom ?? 'Un agent'}</b> {f.texte}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-[15px] text-[#5F5B57]">{decisions.pret ? 'Rien encore cette semaine : confiez une première demande.' : ' '}</p>}
            <div className="flex items-baseline gap-2.5 border-t border-[#E7E5E2] pt-3.5">
              <span className="text-[34px] font-bold tracking-tight text-[#B24A0C] tabular-nums">{minutesEnTexte(decisions.minutesSemaine)}</span>
              <span className="text-sm text-[#5F5B57]">gagnées cette semaine (estimation par mission utile)</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-[18px] border border-[#E7E5E2] p-[22px]">
            <h2 className="text-[19px] font-bold">À venir</h2>
            {decisions.aVenir.length ? decisions.aVenir.map((e) => {
              const quand = new Date(e.date);
              const jour = jourLisible(quand, maintenant);
              return (
                <p key={`${e.date}-${e.titre}`} className="text-[15px]">
                  <b className="font-semibold">{jour.charAt(0).toUpperCase() + jour.slice(1)}, {heureLisible(quand)}</b> · {e.titre} — {ETATS_ECHEANCE[e.etat]((e.agent_id && agents.get(e.agent_id)?.prenom) || "L'équipe")}
                </p>
              );
            }) : <p className="text-[15px] text-[#5F5B57]">{decisions.pret ? 'Aucune routine planifiée pour l\'instant.' : ' '}</p>}
            <Link to="/studio/routines" className="text-[15px] font-medium text-[#B24A0C] underline underline-offset-[3px] hover:text-[#141414]">Voir les routines</Link>
          </div>

          {reste > 0 && (
            <div className="flex flex-col gap-3 rounded-[18px] border border-[#E7E5E2] bg-white p-[22px]">
              <h2 className="text-[19px] font-bold">Bien démarrer — {etapes.length - reste}/{etapes.length}</h2>
              <ul className="flex flex-col gap-1">
                {etapes.map((e) => (
                  <li key={e.label}>
                    <Link to={e.to} className="flex min-h-[44px] items-center gap-2.5 text-[15px] hover:underline">
                      {e.fait ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2E6B48]" aria-hidden /> : <Circle className="h-5 w-5 shrink-0 text-[#D6D3CF]" aria-hidden />}
                      <span className={e.fait ? 'text-[#5F5B57] line-through' : ''}>{e.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {document && (
        <EditeurDocument doc={document} agent={(document.agent_id && agents.get(document.agent_id)?.prenom) || 'Agent'} nomEspace={me.workspace.nom} gerer={gerer}
          onClose={() => setDocument(null)} onSaved={() => { decisions.charger(); rafraichir(); }} />
      )}
    </div>
  );
}
