// Documents HTML des agents (devis, proposition, compte rendu, fiche…), modifiables en
// WYSIWYG dans le Studio puis exportés en PDF ou Word.
// Nettoyage côté serveur (première barrière) : pas de script, de cadre, de formulaire,
// d'attribut on…, ni d'URL javascript:. Le Studio affiche en plus le document dans un
// cadre isolé sans script et le renettoie avant impression ou export.

const BALISES_INTERDITES = ["script", "iframe", "frame", "frameset", "object", "embed", "applet", "form", "input",
  "button", "select", "textarea", "link", "meta", "base", "noscript", "template", "svg", "math"];
export const HTML_MAX = 300_000;

export function nettoyerHtml(brut: string): string {
  let h = String(brut ?? "").slice(0, HTML_MAX);
  // Document complet fourni : on garde les <style> de l'en-tête et le contenu du <body>.
  const styles = [...h.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0]);
  const corps = /<body[^>]*>([\s\S]*)<\/body>/i.exec(h);
  if (corps) h = styles.filter((s) => !corps[1].includes(s)).join("\n") + corps[1];
  h = h.replace(/<!doctype[^>]*>|<\/?(html|head|body)[^>]*>|<title[^>]*>[\s\S]*?<\/title>/gi, "");
  h = h.replace(/<!--[\s\S]*?-->/g, "");
  for (const b of BALISES_INTERDITES) {
    h = h.replace(new RegExp(`<${b}\\b[\\s\\S]*?<\\/${b}\\s*>`, "gi"), "");
    h = h.replace(new RegExp(`<\\/?${b}\\b[^>]*>`, "gi"), "");
  }
  // Attributs d'événement (onclick, onerror…) et URL actives.
  h = h.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  h = h.replace(/\s+(href|src|action|formaction|xlink:href)\s*=\s*("\s*(javascript|vbscript|data(?!:image\/(png|jpe?g|gif|webp);))[^"]*"|'\s*(javascript|vbscript|data(?!:image\/(png|jpe?g|gif|webp);))[^']*'|(javascript|vbscript):[^\s>]*)/gi, "");
  // CSS actif (anciens navigateurs) et import de feuilles externes.
  h = h.replace(/expression\s*\(|@import[^;]*;?|url\(\s*['"]?\s*javascript:[^)]*\)/gi, "");
  return h.trim();
}

/** Titre lisible extrait du document si l'agent n'en donne pas. */
export function titreDuHtml(html: string): string {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) ?? /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html);
  return m ? m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 200) : "";
}

export const CONSIGNE_DOCUMENT = `## Documents mis en forme
- Pour tout document destiné à être relu, imprimé ou envoyé (devis, proposition commerciale, compte rendu, fiche produit, procédure, courrier, newsletter ou article mis en page, rapport), utilise document_rediger avec un HTML complet et soigné : titres, paragraphes, listes, tableaux, mise en valeur. Un bloc <style> en tête est autorisé (sobre, lisible à l'impression A4) ; aucun script ; images seulement par URL https.
- Le client voit le document à droite de la conversation, le modifie directement et l'exporte en PDF ou Word. Dans ta réponse, résume en 2 ou 3 lignes ce que contient le document et donne sa référence ; ne recopie pas le document dans le chat.
- Pour une correction demandée ensuite sur ce document, utilise document_modifier avec sa référence et le HTML complet mis à jour (repars de la version actuelle, qui a pu être modifiée par le client : lis-la d'abord avec document_lire).`;
