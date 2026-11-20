// Routines (refonte §3.4, §3.5) : ce que l'écran affiche d'une routine. Les phrases des
// étapes, « En clair » et l'historique sont calculés par le serveur (functions/studio/routines.ts) ;
// ce module, pur et testé, ne fait que les présenter : dates, état, intitulés.
import { heureLisible, jourLisible } from './decision';

export type DefReglage =
  | { id: string; type: 'compteur'; etape: number; libelle: string; min: number; max: number; pas: number; unite: string; defaut: number }
  | { id: string; type: 'choix'; etape: number; libelle: string; options: { valeur: string; libelle: string }[]; defaut: string }
  | { id: string; type: 'bascule'; etape: number; libelle: string; aide?: string; defaut: boolean }
  | { id: string; type: 'texte'; etape: number; libelle: string; format?: 'email'; defaut: string };

export type EtapeVue = {
  id: string; type: 'depart' | 'agent' | 'validation' | 'envoi'; agent: string | null;
  texte: string; puces: string[]; verrouillee: boolean; reglages: DefReglage[];
};
export type LigneHistorique = { date: string; ton: 'ok' | 'incident' | 'erreur' | 'essai' | 'en_cours'; texte: string };
export type Valeur = string | number | boolean;

export type Routine = {
  id: string; titre: string; agent_id: string; actif: boolean; modele: string | null; reglages: Record<string, Valeur>;
  heures: number[]; jours: number[]; planning: string; prochaine_execution: string | null; derniere_execution: string | null;
  cree_le: string | null; essai_jusqu_au: string | null; essai_termine: boolean; en_cours: boolean;
  etapes: EtapeVue[]; en_clair: string; historique: LigneHistorique[]; bilan: string;
  consigne_origine: string | null; conversation_id: string | null;
};
export type ReponseRoutines = { routines: Routine[]; installees: boolean };

export type ModeleGalerie = {
  id: string; agent: string; titre: string; gain: string; etapes: EtapeVue[]; en_clair: string;
  question: { texte: string; reponses: string[]; saisie: { libelle: string } | null };
  /** Outils à relier pour que la routine ait de quoi travailler. */
  manque: string[];
};
export type Proposition = {
  titre: string; agent: string; etapes: { type: string; agent?: string; texte?: string }[]; consigne: string;
  planning: { heures: number[]; jours: number[] }; question: { texte: string; reponses: string[] };
};

const REUNION = 'Indian/Reunion';

/** « Lun. 23 nov. » (historique). */
export function dateCourte(iso: string): string {
  const t = new Date(iso).toLocaleDateString('fr-FR', { timeZone: REUNION, weekday: 'short', day: 'numeric', month: 'short' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** « Mise en place le 3 novembre · a tourné 3 fois, sans erreur bloquante ». */
export function sousTitre(r: Pick<Routine, 'cree_le' | 'bilan'>): string {
  const quand = r.cree_le ? `Mise en place le ${new Date(r.cree_le).toLocaleDateString('fr-FR', { timeZone: REUNION, day: 'numeric', month: 'long' })}` : '';
  return [quand, r.bilan].filter(Boolean).join(' · ');
}

export type Etat = { texte: string; ton: 'essai' | 'attente' | 'pause' | 'actif' | 'travail' };

/** État d'une routine, en une ligne (carte de la liste, en-tête de l'écran Routine). */
export function etatRoutine(r: Routine, maintenant = new Date()): Etat {
  if (r.en_cours) return { texte: 'En cours…', ton: 'travail' };
  if (r.essai_termine) return { texte: 'Essai terminé : à mettre en route', ton: 'attente' };
  if (!r.actif) return { texte: 'En pause', ton: 'pause' };
  if (r.essai_jusqu_au) {
    return { texte: `À l'essai jusqu'à ${jourLisible(new Date(r.essai_jusqu_au), maintenant)} : rien n'est envoyé`, ton: 'essai' };
  }
  if (r.prochaine_execution) {
    const d = new Date(r.prochaine_execution);
    return { texte: `Prochain passage ${jourLisible(d, maintenant)} à ${heureLisible(d)}`, ton: 'actif' };
  }
  return { texte: 'Active', ton: 'actif' };
}

/** Surtitre d'une étape : « Départ », « Étape 2 · Théo », « Étape 3 · Vous · obligatoire ». */
export function surtitre(e: EtapeVue, index: number, prenom: (id: string) => string): string {
  if (e.type === 'depart') return 'Départ';
  if (e.type === 'validation') return `Étape ${index} · Vous${e.verrouillee ? ' · obligatoire' : ''}`;
  return `Étape ${index} · ${e.agent ? prenom(e.agent) : 'Équipe'}`;
}

/** Titre du panneau de réglages de l'étape choisie. */
export function titrePanneau(e: EtapeVue, prenom: (id: string) => string): string {
  if (e.type === 'depart') return 'Quand la routine démarre-t-elle ?';
  if (e.type === 'validation') return e.verrouillee ? 'Votre feu vert avant tout envoi' : 'Votre relecture';
  if (e.type === 'envoi') return 'Envoi, après votre feu vert';
  return `Ce que fait ${e.agent ? prenom(e.agent) : "l'équipe"}`;
}

/** Couleur de la pastille d'une ligne d'historique. */
export const COULEURS_HISTORIQUE: Record<LigneHistorique['ton'], string> = {
  ok: '#2E6B48', incident: '#B88A1E', erreur: '#B42318', essai: '#1F5B85', en_cours: '#A9A49E',
};

/** « Routines · 3 actives » (une routine à l'essai ou en pause n'est pas active). */
export function compteActives(routines: Routine[]): string {
  const n = routines.filter((r) => r.actif && !r.essai_jusqu_au).length;
  return `Routines · ${n} active${n > 1 ? 's' : ''}`;
}

/** Valeur affichée d'un compteur : « 15 jours », « 1 publication ». */
export function valeurCompteur(d: Extract<DefReglage, { type: 'compteur' }>, v: Valeur | undefined): string {
  const n = Number(v ?? d.defaut);
  const unite = n > 1 ? d.unite : d.unite.replace(/s$/, '');
  return `${n} ${unite}`;
}
