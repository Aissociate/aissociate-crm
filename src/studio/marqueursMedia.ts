// Visuels et vidéos lancés par un agent pendant une réponse : la réponse enregistrée porte un
// repère [[MEDIA:id:type]] par média (functions/studio/pouvoirs.ts), affiché avec MediaVue.
import type { Media } from './api';

const MARQUEUR = /\[\[MEDIA:([0-9a-f-]{36}):(image|video)\]\]/gi;

/** Médias d'une réponse : ceux reçus en direct, puis ceux cités par repère, sans doublon. */
export function mediasDuMessage(contenu: string, enDirect: Media[] = []): Media[] {
  const out: Media[] = [...enDirect];
  const vus = new Set(out.map((m) => m.id.toLowerCase()));
  for (const m of contenu.matchAll(MARQUEUR)) {
    const id = m[1].toLowerCase();
    if (vus.has(id)) continue;
    vus.add(id);
    // MediaVue interroge le serveur tant que le média est « en cours ».
    out.push({ id, type: m[2].toLowerCase() as Media['type'], statut: 'en_cours' });
  }
  return out;
}

/** Texte affiché, copié ou exporté : sans les repères. */
export const sansMarqueursMedia = (contenu: string) => contenu.replace(MARQUEUR, '').replace(/\n{3,}/g, '\n\n').trimEnd();
