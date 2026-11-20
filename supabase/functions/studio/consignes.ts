// Consignes ajoutées par le client pendant qu'un agent réfléchit (action chat_consigne).
// Enregistrées comme messages du client, marqués d'un préfixe, puis lues entre deux tours :
// l'agent principal les reçoit, et le spécialiste en mission aussi. Module pur (testé).

/** Préfixe des messages-consignes (aussi affiché dans l'historique du chat). */
export const PREFIXE = "↪ ";
export const LONGUEUR_MAX = 2000;

export const estConsigne = (contenu: string) => contenu.startsWith(PREFIXE);
export const texteConsigne = (contenu: string) => (estConsigne(contenu) ? contenu.slice(PREFIXE.length).trim() : "");

/** Ce que reçoit l'agent principal. */
export const pourAgent = (texte: string) =>
  `(Consigne ajoutée par le client pendant ta réflexion, à appliquer à la suite de ton travail et dans ta réponse : ${texte})`;

/** Ce que reçoit le spécialiste en mission. */
export const pourSpecialiste = (texte: string, prenomAgent: string) =>
  `(Consigne ajoutée par le client pendant ta mission, transmise par ${prenomAgent} — applique-la à ton travail : ${texte})`;

/** Libellé d'étape affiché dans le chat. */
export const libellePrise = (n: number, prenom?: string) =>
  `${prenom ? `${prenom} : ` : ""}${n > 1 ? `${n} consignes prises` : "Consigne prise"} en compte`;
