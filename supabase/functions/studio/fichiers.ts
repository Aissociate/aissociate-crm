// Fichiers transmis tels quels (chat) : tout fichier que le navigateur ne sait pas lire (archive
// autre que ZIP, audio, vidéo, image de travail, format métier…) est gardé intact dans le stockage
// privé et rangé dans « Mes ressources ». Les agents ne le lisent pas : ils le citent, le joignent à
// un e-mail (mail_proposer_envoi) ou le déposent dans Google Drive / OneDrive (fichiers_deposer),
// toujours après validation du propriétaire.
//
// La ressource (studio_documents, type « fichier ») porte une ligne-repère [[STOCKAGE:chemin|mime]]
// dans son contenu : pas de nouvelle colonne. Module pur (testé).

/** Taille maximale d'un fichier transmis tel quel (les e-mails acceptent 25 Mo au total). */
export const TAILLE_MAX = 10 * 1024 * 1024;
/** Pièces jointes à un même e-mail. */
export const PIECES_MAX = 5;
/**
 * Envoi en morceaux : l'API refuse les corps de requête au-delà d'environ 1 Mo. Le navigateur
 * envoie des morceaux de MORCEAU octets (≈ 800 Ko en base64), recollés au dernier.
 */
export const MORCEAU = 600 * 1024;
export const MORCEAUX_MAX = Math.ceil(TAILLE_MAX / MORCEAU);

/** Contrôle d'un morceau reçu : message d'erreur, ou null. */
export function controleMorceau(p: { jeton: unknown; index: unknown; total: unknown; taille: number }): string | null {
  if (typeof p.jeton !== "string" || !/^[0-9a-f-]{36}$/i.test(p.jeton)) return "Envoi invalide.";
  const i = Number(p.index), n = Number(p.total);
  if (!Number.isInteger(n) || n < 1 || n > MORCEAUX_MAX) return `Fichier trop volumineux (${tailleLisible(TAILLE_MAX)} au plus).`;
  if (!Number.isInteger(i) || i < 0 || i >= n) return "Envoi invalide.";
  if (!p.taille || p.taille > MORCEAU) return "Morceau invalide.";
  return null;
}

export const cheminMorceau = (wsId: string, jeton: string, index: number) => `${wsId}/envois/${jeton.toLowerCase()}/${index}`;

export type PieceStockee = { nom: string; chemin: string; mime: string };

const REPERE = /\[\[STOCKAGE:([^|\]]+)\|([^\]]*)\]\]/;

/** Nom sûr pour le stockage (sans accents ni caractères spéciaux). */
export function nomSur(nom: string): string {
  const base = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return (base || "fichier").slice(-120);
}

export const cheminFichier = (wsId: string, id: string, nom: string) => `${wsId}/fichiers/${id}-${nomSur(nom)}`;

/** Type MIME déclaré par le navigateur, sinon déduit de l'extension, sinon binaire. */
export function mimeDe(nom: string, declare?: string | null): string {
  const d = String(declare ?? "").trim().toLowerCase();
  if (/^[a-z]+\/[a-z0-9.+-]+$/.test(d)) return d;
  const ext = nom.toLowerCase().split(".").pop() ?? "";
  const connus: Record<string, string> = {
    pdf: "application/pdf", zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml",
    mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", mp4: "video/mp4", mov: "video/quicktime",
    psd: "image/vnd.adobe.photoshop", ai: "application/postscript", eps: "application/postscript",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return connus[ext] ?? "application/octet-stream";
}

export function tailleLisible(octets: number): string {
  if (octets >= 1024 * 1024) return `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
  return `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

/** Contenu de la ressource : ce que voient les agents, et le repère de stockage. */
export function contenuFichier(p: { nom: string; chemin: string; mime: string; taille: number }): string {
  return `Fichier transmis tel quel : « ${p.nom} » (${tailleLisible(p.taille)}, ${p.mime}). Son contenu n'est pas lu par les agents ; il peut être joint à un e-mail ou déposé dans Google Drive / OneDrive.\n[[STOCKAGE:${p.chemin}|${p.mime}]]`;
}

/** Fichier stocké d'une ressource, ou null si c'est une note ou un document lu. */
export function fichierStocke(contenu: string | null | undefined, nom: string): PieceStockee | null {
  const m = REPERE.exec(String(contenu ?? ""));
  return m ? { nom, chemin: m[1], mime: m[2] || "application/octet-stream" } : null;
}

/** Texte de la pièce jointe du chat, pour l'agent (et pour le spécialiste à qui Léa la transmet). */
export const textePiece = (titre: string, taille: number, mime: string) =>
  `(Fichier transmis tel quel, non lu : ${tailleLisible(taille)}, ${mime}. Rangé dans « Mes ressources » sous le titre « ${titre} ». Pour l'envoyer, cite ce titre dans pieces_jointes de mail_proposer_envoi, ou dépose-le avec fichiers_deposer.)`;

/** Nom de la pièce jointe d'un e-mail : le titre de la ressource, avec l'extension du fichier stocké. */
export function nomPiece(titre: string, chemin: string): string {
  const ext = /\.([A-Za-z0-9]{1,8})$/.exec(chemin)?.[1];
  const t = titre.replace(/[\\/:*?"<>|\r\n]+/g, " ").trim().slice(0, 150) || "fichier";
  return ext && !t.toLowerCase().endsWith(`.${ext.toLowerCase()}`) ? `${t}.${ext}` : t;
}
