/**
 * Bascule d'un marqueur de mise en forme (**gras**, _italique_) sur la
 * sélection d'une zone de texte — barre d'outils de la messagerie.
 *
 * Deux comportements demandés par le ticket Benjamin « Messagerie : bug à la
 * relecture » :
 *  - c'est une BASCULE : recliquer sur un texte déjà encadré retire les
 *    marqueurs au lieu d'en ajouter une seconde paire à effacer à la main ;
 *  - les espaces de la sélection restent HORS des marqueurs : sélectionner
 *    « ␣France Travail » posait le marqueur ouvrant contre le mot précédent
 *    (« conseiller** France Travail** »), loin de l'endroit visé.
 */
export type Bascule = { texte: string; debut: number; fin: number };

export function basculerMarque(
  texte: string, selectionStart: number, selectionEnd: number, marque: string,
): Bascule | null {
  const brut = texte.slice(selectionStart, selectionEnd);
  const avant = selectionStart + (brut.length - brut.trimStart().length);
  const apres = selectionEnd - (brut.length - brut.trimEnd().length);
  const sel = texte.slice(avant, apres);
  if (!sel) return null;  // rien de sélectionné : pas de marqueur orphelin

  const n = marque.length;
  // Marqueurs compris dans la sélection, ou juste à l'extérieur de celle-ci.
  const dedans = sel.startsWith(marque) && sel.endsWith(marque) && sel.length > 2 * n;
  const autour = avant >= n && texte.slice(avant - n, avant) === marque && texte.slice(apres, apres + n) === marque;

  const [debut, contenu, fin] = dedans
    ? [avant, sel.slice(n, -n), apres]
    : autour
      ? [avant - n, sel, apres + n]
      : [avant, `${marque}${sel}${marque}`, apres];

  const retire = dedans || autour;
  const offset = retire ? 0 : n;
  return {
    texte: `${texte.slice(0, debut)}${contenu}${texte.slice(fin)}`,
    // Le texte reste sélectionné, marqueurs exclus : recliquer bascule à nouveau.
    debut: debut + offset,
    fin: debut + offset + (retire ? contenu.length : sel.length),
  };
}
