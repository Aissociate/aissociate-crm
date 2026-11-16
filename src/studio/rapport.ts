// Rapport mensuel de valeur (miroir du type de supabase/functions/studio/rapport.ts)
// et sa mise en document (Markdown → Word / PDF via exportDoc).
import { minutesEnTexte } from './api';

export type Rapport = {
  mois: string; libelle: string;
  missions: number; reponses_utiles: number; minutes: number;
  contenus_gardes: number; images: number; videos: number;
  par_agent: { agent_id: string; prenom: string; metier: string; missions: number; minutes: number }[];
  exemples: { titre: string; agent: string }[];
  precedent: { missions: number; minutes: number };
};

/** Six derniers mois, du plus récent au plus ancien : [{valeur: 'AAAA-MM', libelle}]. */
export function derniersMois(n = 6, depuis = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(depuis.getUTCFullYear(), depuis.getUTCMonth() - i, 1));
    return {
      valeur: d.toISOString().slice(0, 7),
      libelle: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    };
  });
}

/** Évolution lisible par rapport au mois précédent (« +40 % », « nouveau », « stable »). */
export function evolution(actuel: number, avant: number): string {
  if (!avant) return actuel ? 'nouveau' : '—';
  const p = Math.round(((actuel - avant) / avant) * 100);
  return p === 0 ? 'stable' : `${p > 0 ? '+' : ''}${p} %`;
}

export function rapportEnMarkdown(r: Rapport, entreprise: string): string {
  const lignes = [
    `## L'essentiel de ${r.libelle}`,
    `- **${r.missions} mission${r.missions > 1 ? 's' : ''}** confiée${r.missions > 1 ? 's' : ''} à votre équipe d'agents (${evolution(r.missions, r.precedent.missions)} par rapport au mois précédent)`,
    `- **${minutesEnTexte(r.minutes)}** de travail gagné, estimation (${evolution(r.minutes, r.precedent.minutes)})`,
    `- **${r.reponses_utiles} réponse${r.reponses_utiles > 1 ? 's' : ''} utile${r.reponses_utiles > 1 ? 's' : ''}**, dont ${r.contenus_gardes} gardée${r.contenus_gardes > 1 ? 's' : ''} dans vos contenus`,
  ];
  if (r.images || r.videos) lignes.push(`- **${r.images} visuel${r.images > 1 ? 's' : ''}** et **${r.videos} vidéo${r.videos > 1 ? 's' : ''}** générés`);
  if (r.par_agent.length) {
    lignes.push('', '## Votre équipe ce mois-ci', '| Agent | Métier | Missions | Temps gagné |', '|---|---|---|---|',
      ...r.par_agent.map((a) => `| ${a.prenom} | ${a.metier} | ${a.missions} | ${minutesEnTexte(a.minutes)} |`));
  }
  if (r.exemples.length) {
    lignes.push('', '## Quelques missions du mois', ...r.exemples.map((e) => `- ${e.titre}${e.agent ? ` (${e.agent})` : ''}`));
  }
  lignes.push('', `_Rapport établi pour ${entreprise}. Le temps gagné est une estimation : chaque réponse utile (non notée « à revoir ») compte pour la durée moyenne de la tâche correspondante._`);
  return lignes.join('\n');
}
