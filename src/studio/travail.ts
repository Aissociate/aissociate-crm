// Qui travaille pendant qu'une réponse se prépare : l'agent de la conversation, et le collègue
// qu'il a sollicité s'il y en a un. Déduit des libellés d'étape envoyés par le serveur
// (functions/studio/index.ts : consulter / confier). Module pur (testé).

/** Prénom du collègue encore au travail d'après la dernière étape annoncée, sinon null. */
export function collegueAuTravail(etapes: string[] | undefined, prenoms: string[]): string | null {
  const derniere = etapes?.[etapes.length - 1]?.trim();
  if (!derniere) return null;
  for (const p of prenoms) {
    if (!derniere.startsWith(`${p} `)) continue;
    const suite = derniere.slice(p.length + 1);
    // « Hugo est consulté… », « Hugo (Marketing) travaille… », « Hugo reprend son travail… », « Hugo : Recherche web ».
    if (/^est consulté…$|^\([^)]*\) travaille…$|^reprend son travail…$|^: /.test(suite)) return p;
  }
  return null;
}
