// Ressources sensibles : RIB / IBAN, pièce d'identité, bulletin de paie, numéro de
// sécurité sociale. Détectées à l'ajout (import du client ou note d'un agent), elles
// sont rangées désactivées : les agents ne les lisent pas tant que le client ne les a
// pas activées lui-même, en connaissance de cause.
// Module pur (testé) : le texte vient du navigateur, un PDF scanné n'en a pas, d'où
// la lecture du titre en plus du contenu. Mieux vaut un faux positif (un clic pour
// activer) qu'un RIB servi à tous les agents.

export type TypeSensible = "rib" | "identite" | "paie" | "securite_sociale";
export type Sensible = { type: TypeSensible; libelle: string };

export const LIBELLES_SENSIBLES: Record<TypeSensible, string> = {
  rib: "des coordonnées bancaires (RIB / IBAN)",
  identite: "une pièce d'identité",
  paie: "un bulletin de paie",
  securite_sociale: "un numéro de sécurité sociale",
};

/** Dossier où sont rangées les ressources sensibles ajoutées sans dossier choisi. */
export const DOSSIER_SENSIBLE = "Confidentiel";

export function messageSensible(s: Sensible): string {
  return `Ce document semble contenir ${s.libelle}. Par précaution, il est rangé désactivé : vos agents ne le lisent pas. Vous pouvez l'activer vous-même si c'est voulu.`;
}

/** Colonne studio_documents.sensible absente (migration studio_ressources_sensibles non appliquée). */
export function colonneSensibleAbsente(e: { message: string } | null | undefined): boolean {
  return Boolean(e && /\bsensible\b/.test(e.message));
}

const TAILLE_LUE = 300_000;
const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Longueur d'un IBAN par pays (zone SEPA courante, océan Indien). */
const LONGUEURS_IBAN: Record<string, number> = {
  FR: 27, MC: 27, BE: 16, DE: 22, ES: 24, IT: 27, LU: 20, CH: 21, GB: 22, NL: 18, PT: 25, IE: 22, AT: 20, MU: 30, MG: 27,
};

/** Contrôle complet d'un IBAN : pays connu, longueur, clé modulo 97. */
export function ibanValide(brut: string): boolean {
  const s = brut.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s) || LONGUEURS_IBAN[s.slice(0, 2)] !== s.length) return false;
  let reste = 0;
  for (const c of s.slice(4) + s.slice(0, 4)) {
    const v = c >= "A" ? String(c.charCodeAt(0) - 55) : c;
    for (const chiffre of v) reste = (reste * 10 + Number(chiffre)) % 97;
  }
  return reste === 1;
}

function contientIban(texteMaj: string): boolean {
  const re = /\b([A-Z]{2})(\d{2})((?:[  .-]?[A-Z0-9]){10,30})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texteMaj))) {
    const n = LONGUEURS_IBAN[m[1]];
    if (n && ibanValide((m[1] + m[2] + m[3].replace(/[^A-Z0-9]/g, "")).slice(0, n))) return true;
    re.lastIndex = m.index + 2; // un candidat raté peut en cacher un autre juste après
  }
  return false;
}

/** Numéro de sécurité sociale français (13 chiffres + clé), Corse comprise. */
export function nirValide(brut: string): boolean {
  const s = brut.replace(/[\s.]/g, "").toUpperCase();
  if (!/^[12]\d{2}(0[1-9]|1[0-2]|[2-9]\d)(\d{2}|2[AB])\d{6}\d{2}$/.test(s)) return false;
  const corps = s.slice(0, 13).replace("2A", "19").replace("2B", "18");
  let reste = 0;
  for (const chiffre of corps) reste = (reste * 10 + Number(chiffre)) % 97;
  return 97 - reste === Number(s.slice(13));
}

function contientNir(texteMaj: string): boolean {
  const re = /\b[12][ .]?\d{2}[ .]?\d{2}[ .]?(?:\d{2}|2[AB])[ .]?\d{3}[ .]?\d{3}[ .]?\d{2}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texteMaj))) if (nirValide(m[0])) return true;
  return false;
}

const trouve = (type: TypeSensible): Sensible => ({ type, libelle: LIBELLES_SENSIBLES[type] });

/** Nature sensible d'une ressource, d'après son titre et son texte ; null si rien n'est reconnu. */
export function detecterSensible(titre: string, contenu: string): Sensible | null {
  const t = sansAccents(String(titre ?? "")).toLowerCase();
  const brut = String(contenu ?? "").slice(0, TAILLE_LUE);
  const c = sansAccents(brut).toLowerCase();
  const maj = brut.toUpperCase();

  if (/(^|[^a-z])(rib|iban)([^a-z]|$)/.test(t) || /releve d['’ ]identite bancaire/.test(c) || contientIban(maj)) return trouve("rib");

  if (/(bulletin|fiche)s?.{0,12}(paie|paye|salaire)/.test(t)
    || (/(bulletin|fiche) de (paie|paye|salaire)/.test(c) && /(net a payer|net imposable|salaire de base|cotisations? salariale)/.test(c))) return trouve("paie");

  const mrz = /\bIDFRA[A-Z0-9<]{20,}/.test(maj) || /\bP<[A-Z]{3}[A-Z<]{20,}/.test(maj);
  const titrePiece = /(^|[^a-z])(cni|passeport|passport)([^a-z]|$)|(piece|carte).{0,6}identite|titre.{0,6}sejour/.test(t);
  const textePiece = /(carte nationale d['’ ]identite|passeport|titre de sejour|permis de conduire)/.test(c)
    && /(nee? le|date de naissance|nationalite)/.test(c);
  if (mrz || titrePiece || textePiece) return trouve("identite");

  if (contientNir(maj)) return trouve("securite_sociale");
  return null;
}
