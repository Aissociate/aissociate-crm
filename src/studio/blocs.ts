// Découpage d'un texte Markdown en blocs « texte » et « tableau », pour l'éditeur des
// livrables : les tableaux s'éditent en grille, le reste en texte. Aller-retour fidèle.

export type BlocTexte = { type: 'texte'; texte: string };
export type BlocTableau = { type: 'tableau'; entetes: string[]; lignes: string[][]; alignements: string[] };
export type Bloc = BlocTexte | BlocTableau;

/** Cellules d'une ligne « | a | b | » ; un « \| » reste dans la cellule. */
export function cellules(ligne: string): string[] {
  const t = ligne.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return t.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

const estLigneTableau = (l: string) => /^\s*\|.*\|\s*$/.test(l) || /^[^|]+(?<!\\)\|[^|]/.test(l.trim()) && l.includes('|');
const estSeparateur = (l: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);

export function decouper(md: string): Bloc[] {
  const lignes = md.replace(/\r/g, '').split('\n');
  const blocs: Bloc[] = [];
  let texte: string[] = [];
  const pousserTexte = () => { if (texte.length) { blocs.push({ type: 'texte', texte: texte.join('\n') }); texte = []; } };
  for (let i = 0; i < lignes.length; i++) {
    if (estLigneTableau(lignes[i]) && i + 1 < lignes.length && estSeparateur(lignes[i + 1])) {
      const entetes = cellules(lignes[i]);
      const alignements = cellules(lignes[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'centre' : c.endsWith(':') ? 'droite' : c.startsWith(':') ? 'gauche' : ''));
      const corps: string[][] = [];
      let j = i + 2;
      while (j < lignes.length && lignes[j].trim() && lignes[j].includes('|')) { corps.push(cellules(lignes[j])); j++; }
      // Toutes les lignes ont autant de colonnes que l'en-tête.
      const n = entetes.length;
      const ajuster = (r: string[]) => [...r, ...Array(Math.max(0, n - r.length)).fill('')].slice(0, n);
      // Retire la ligne vide qui sépare le texte du tableau : elle est remise à la sérialisation.
      if (texte.length && !texte[texte.length - 1].trim()) texte.pop();
      pousserTexte();
      blocs.push({ type: 'tableau', entetes, lignes: corps.map(ajuster), alignements: ajuster(alignements) });
      i = j - 1;
      if (j < lignes.length && !lignes[j].trim()) i = j; // ligne vide après le tableau
    } else texte.push(lignes[i]);
  }
  pousserTexte();
  return blocs.length ? blocs : [{ type: 'texte', texte: '' }];
}

const echapper = (c: string) => c.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const separateur = (a: string) => (a === 'centre' ? ':---:' : a === 'droite' ? '---:' : a === 'gauche' ? ':---' : '---');

export function tableauEnMarkdown(t: BlocTableau): string {
  const ligne = (r: string[]) => `| ${r.map(echapper).join(' | ')} |`;
  return [ligne(t.entetes), `| ${t.entetes.map((_, k) => separateur(t.alignements[k] ?? '')).join(' | ')} |`, ...t.lignes.map(ligne)].join('\n');
}

export function serialiser(blocs: Bloc[]): string {
  return blocs.map((b) => (b.type === 'texte' ? b.texte : tableauEnMarkdown(b)))
    .reduce((acc, x, k) => (k === 0 ? x : `${acc}${acc.endsWith('\n\n') || !acc ? '' : acc.endsWith('\n') ? '\n' : '\n\n'}${x}`), '')
    .replace(/\n{4,}/g, '\n\n\n');
}

export const tableauVide = (colonnes = 3, lignes = 2): BlocTableau => ({
  type: 'tableau', entetes: Array.from({ length: colonnes }, (_, k) => `Colonne ${k + 1}`),
  lignes: Array.from({ length: lignes }, () => Array(colonnes).fill('')), alignements: Array(colonnes).fill(''),
});
