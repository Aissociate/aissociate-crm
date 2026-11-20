// Références de documents dans le chat : les agents citent un livrable par « L-xxxxxxxx »
// (8 premiers caractères hexadécimaux de son identifiant, voir functions/studio/liaison.ts).
// Module pur (testé) : découpe d'un texte en morceaux et correspondance référence → livrable.

const MOTIF = /\bL-[0-9a-f]{8}\b/gi;

/** Référence d'un livrable, identique à `refLivrable` côté serveur. */
export const refDe = (id: string) => `L-${id.replace(/-/g, '').slice(0, 8).toLowerCase()}`;

/** Découpe un texte : chaînes telles quelles, et `{ ref }` pour chaque référence trouvée. */
export function decouperReferences(texte: string): (string | { ref: string })[] {
  const out: (string | { ref: string })[] = [];
  let dernier = 0;
  for (const m of texte.matchAll(MOTIF)) {
    const i = m.index ?? 0;
    if (i > dernier) out.push(texte.slice(dernier, i));
    out.push({ ref: `L-${m[0].slice(2).toLowerCase()}` });
    dernier = i + m[0].length;
  }
  if (dernier < texte.length) out.push(texte.slice(dernier));
  return out;
}

/** Livrable désigné par une référence, s'il est dans la liste. */
export const trouverParRef = <T extends { id: string }>(liste: T[], ref: string): T | undefined =>
  liste.find((l) => refDe(l.id) === `L-${ref.slice(2).toLowerCase()}`);
