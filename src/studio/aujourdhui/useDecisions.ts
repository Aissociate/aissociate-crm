// File de décisions de l'écran « Aujourd'hui » : les livrables « à valider » et ce que le
// dirigeant en fait pendant la session.
// Valider retient l'envoi quelques secondes : « Annuler » empêche l'appel, donc rien ne
// part. Si l'onglet se ferme pendant ce délai, rien ne part non plus ; si l'on change de
// page dans le Studio, l'envoi part tout de suite (la décision était prise).
import { useCallback, useEffect, useRef, useState } from 'react';
import { appel } from '../api';
import type { ActionLivrable } from '../EditeurLivrable';
import { presenter } from '../decision';

export type Decision = {
  id: string; titre: string; contenu: string; statut: string; agent_id: string | null;
  conversation_id: string | null; created_at: string; type_action?: string | null;
  action?: ActionLivrable | null; format?: string; confie_par?: string | null;
};
export type Fait = { agent_id: string; texte: string; total: number };
export type Echeance = { date: string; titre: string; agent_id: string | null; etat: 'routine' | 'attend' | 'programmee' };
type Reponse = { decisions: Decision[]; faits: Fait[]; minutes_semaine: number; a_venir: Echeance[] };

export const RAISONS_REFUS = { trop_long: 'Trop long', mauvais_ton: 'Pas le bon ton', pas_le_moment: 'Pas le moment', autre: 'Autre raison' } as const;
export type Raison = keyof typeof RAISONS_REFUS;

/** Ce qu'il est advenu d'une décision pendant la session (absente = en attente). */
export type Suite =
  | { etat: 'envoi' }
  | { etat: 'fait'; texte: string; lien?: string | null }
  | { etat: 'echec'; texte: string }
  | { etat: 'raison' }
  | { etat: 'refuse'; raison: Raison };

/** Délai pendant lequel une validation peut encore être annulée. */
export const DELAI_ANNULATION = 8000;

export function useDecisions(gerer: (e: unknown) => string, rafraichir: () => Promise<void>) {
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [suites, setSuites] = useState<Record<string, Suite>>({});
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');
  const minuteries = useRef(new Map<string, { id: ReturnType<typeof setTimeout>; envoyer: () => void }>());

  const charger = useCallback(async () => {
    try { setDonnees(await appel<Reponse>('aujourdhui')); setErreur(''); }
    catch (e) { setErreur(gerer(e)); }
  }, [gerer]);
  useEffect(() => { void charger(); }, [charger]);

  const suite = (id: string, s: Suite | null) => setSuites((x) => {
    const y = { ...x };
    if (s) y[id] = s; else delete y[id];
    return y;
  });

  // Changement de page : les envois retenus partent (la décision était prise).
  useEffect(() => {
    const m = minuteries.current;
    return () => { for (const { id, envoyer } of m.values()) { clearTimeout(id); envoyer(); } m.clear(); };
  }, []);

  const valider = (d: Decision) => {
    const envoyer = async () => {
      minuteries.current.delete(d.id);
      try {
        const r = await appel<{ execute?: boolean; lien?: string | null; erreur_action?: string }>('livrable_decider', { id: d.id, statut: 'valide' });
        suite(d.id, r.erreur_action
          ? { etat: 'echec', texte: `Validé, mais l'action n'a pas abouti : ${r.erreur_action}` }
          : { etat: 'fait', texte: presenter(d).fait, lien: r.lien });
      } catch (e) {
        suite(d.id, null);
        setErreur(gerer(e));
      }
      void rafraichir();
    };
    minuteries.current.set(d.id, { id: setTimeout(envoyer, DELAI_ANNULATION), envoyer });
    suite(d.id, { etat: 'envoi' });
    setErreur('');
  };

  const annulerEnvoi = (id: string) => {
    const m = minuteries.current.get(id);
    if (!m) return; // trop tard : l'envoi est parti
    clearTimeout(m.id);
    minuteries.current.delete(id);
    suite(id, null);
    setOuverte(id);
  };

  const refuser = async (id: string, raison: Raison) => {
    try {
      await appel('livrable_decider', { id, statut: 'refuse', raison });
      suite(id, { etat: 'refuse', raison });
      setErreur('');
    } catch (e) { suite(id, null); setErreur(gerer(e)); }
    void rafraichir();
  };

  /** Revenir sur un refus : le livrable repasse « à valider ». */
  const annulerRefus = async (id: string) => {
    try { await appel('livrable_decider', { id, statut: 'a_valider' }); suite(id, null); setOuverte(id); setErreur(''); }
    catch (e) { setErreur(gerer(e)); }
    void rafraichir();
  };

  const decisions = donnees?.decisions ?? [];
  const enAttente = decisions.filter((d) => !suites[d.id]);
  const courante = enAttente.find((d) => d.id === ouverte) ?? enAttente[0] ?? null;

  return {
    pret: donnees !== null, erreur, decisions, enAttente, courante, suites,
    faits: donnees?.faits ?? [], minutesSemaine: donnees?.minutes_semaine ?? 0, aVenir: donnees?.a_venir ?? [],
    ouvrir: setOuverte, charger, valider, annulerEnvoi, refuser, annulerRefus,
    demanderRaison: (id: string) => suite(id, { etat: 'raison' }),
    renoncerRefus: (id: string) => { suite(id, null); setOuverte(id); },
  };
}
export type Decisions = ReturnType<typeof useDecisions>;
