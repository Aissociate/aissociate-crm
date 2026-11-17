// Lecture d'un fichier CSV de contacts (Excel, Google Sheets, export CRM…),
// dans le navigateur : séparateur détecté, colonnes reconnues par leur intitulé.
export type LigneContact = { email: string; prenom?: string; nom?: string };

const sansAccent = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Découpe une ligne CSV (guillemets doublés gérés). */
function cellules(ligne: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '', guill = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (guill) {
      if (c === '"' && ligne[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') guill = false;
      else cur += c;
    } else if (c === '"') guill = true;
    else if (c === sep) { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

export function lireCsvContacts(texte: string): LigneContact[] {
  const lignes = texte.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lignes.length) return [];
  const premiere = lignes[0];
  const sep = [';', ',', '\t'].sort((a, b) => premiere.split(b).length - premiere.split(a).length)[0];
  const entete = cellules(premiere, sep).map(sansAccent);
  // Intitulé exact d'abord, puis intitulé qui contient le mot (en évitant les colonnes déjà prises).
  const col = (pris: number[], ...noms: string[]) => {
    const exact = entete.findIndex((h, i) => !pris.includes(i) && noms.includes(h));
    return exact >= 0 ? exact : entete.findIndex((h, i) => !pris.includes(i) && noms.some((n) => h.includes(n)));
  };
  let iEmail = col([], 'email', 'e-mail', 'courriel', 'mail', 'adresse e-mail', 'adresse mail');
  const iPrenom = col([iEmail], 'prenom', 'first name', 'firstname', 'given name');
  const iNom = col([iEmail, iPrenom], 'nom', 'nom de famille', 'last name', 'lastname', 'family name', 'surname');
  let debut = 1;
  if (iEmail < 0) {
    // Pas d'en-tête : la colonne qui contient un @ dans la première ligne.
    iEmail = cellules(premiere, sep).findIndex((c) => c.includes('@'));
    debut = 0;
    if (iEmail < 0) return [];
  }
  return lignes.slice(debut).map((l) => {
    const c = cellules(l, sep);
    return {
      email: c[iEmail] ?? '',
      ...(iPrenom >= 0 && debut === 1 ? { prenom: c[iPrenom] } : {}),
      ...(iNom >= 0 && iNom !== iPrenom && debut === 1 ? { nom: c[iNom] } : {}),
    };
  }).filter((x) => x.email);
}
