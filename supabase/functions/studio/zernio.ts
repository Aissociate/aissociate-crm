// Réseaux sociaux via Zernio (https://docs.zernio.com) : Facebook, Instagram, LinkedIn, TikTok.
//
// Zernio détient des applications Meta / LinkedIn / TikTok déjà validées : le client
// connecte ses comptes en un clic, sans revue d'application de notre côté.
// Cloisonnement : un « profil » Zernio par espace Studio, retrouvé par son externalId
// (= id de l'espace). Toute opération vérifie que le compte visé appartient à CE profil.
// La clé (ZERNIO_API_KEY) reste dans les secrets Supabase, jamais côté navigateur.

const BASE = "https://zernio.com/api/v1";

export const RESEAUX = ["facebook", "instagram", "linkedin", "tiktok"] as const;
export type Reseau = typeof RESEAUX[number];
export const NOMS_RESEAUX: Record<Reseau, string> = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", tiktok: "TikTok" };
/** Réseaux qui refusent une publication sans image ni vidéo. */
const MEDIA_OBLIGATOIRE: Reseau[] = ["instagram", "tiktok"];

export type CompteReseau = {
  id: string; reseau: Reseau; nom: string; identifiant: string; photo: string | null;
  lien: string | null; a_reconnecter: boolean;
};

export const zernioConfigure = () => Boolean(Deno.env.get("ZERNIO_API_KEY"));
export const estReseau = (x: unknown): x is Reseau => RESEAUX.includes(x as Reseau);

async function appel<T>(chemin: string, init: RequestInit = {}): Promise<{ statut: number; data: T }> {
  const cle = Deno.env.get("ZERNIO_API_KEY");
  if (!cle) throw new Error("Réseaux sociaux non configurés (clé Zernio absente).");
  const r = await fetch(`${BASE}${chemin}`, {
    ...init,
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: init.signal ?? AbortSignal.timeout(60_000),
  });
  const texte = await r.text();
  let data: unknown = null;
  try { data = texte ? JSON.parse(texte) : null; } catch { data = { error: texte.slice(0, 300) }; }
  if (!r.ok) {
    const d = (data ?? {}) as Record<string, unknown>;
    const msg = String(d.message ?? d.error ?? d.code ?? r.statusText);
    throw Object.assign(new Error(`Zernio (${r.status}) : ${msg}`), { statut: r.status, data });
  }
  return { statut: r.status, data: data as T };
}

const idDe = (x: unknown): string => (typeof x === "string" ? x : String((x as { _id?: string } | null)?._id ?? ""));

/** Profil Zernio de l'espace (créé à la demande). */
export async function profilEspace(wsId: string, nom: string, creer: boolean): Promise<string | null> {
  const { data } = await appel<{ profiles: { _id: string; externalId: string | null }[] }>(`/profiles?externalId=${encodeURIComponent(wsId)}`);
  const trouve = (data.profiles ?? []).find((p) => p.externalId === wsId);
  if (trouve) return trouve._id;
  if (!creer) return null;
  try {
    const r = await appel<{ profile: { _id: string } }>("/profiles", {
      method: "POST",
      headers: { "Idempotency-Key": `studio-${wsId}` },
      body: JSON.stringify({ name: `${(nom || "Espace").slice(0, 60)} · ${wsId.slice(0, 8)}`, externalId: wsId, timezone: "Indian/Reunion" }),
    });
    return r.data.profile._id;
  } catch (e) {
    const existant = (e as { data?: { details?: { existingProfileId?: string } } }).data?.details?.existingProfileId;
    if (existant) return existant;
    throw e;
  }
}

/** Comptes de réseaux sociaux connectés à l'espace (et à lui seul). */
export async function comptesEspace(wsId: string): Promise<CompteReseau[]> {
  const profil = await profilEspace(wsId, "", false);
  if (!profil) return [];
  const { data } = await appel<{ accounts: Record<string, unknown>[] }>(`/accounts?profileId=${profil}`);
  return (data.accounts ?? [])
    .filter((a) => estReseau(a.platform) && idDe(a.profileId) === profil)
    .map((a) => ({
      id: String(a._id), reseau: a.platform as Reseau,
      nom: String(a.displayName || a.username || NOMS_RESEAUX[a.platform as Reseau]),
      identifiant: String(a.username ?? ""), photo: (a.profilePicture as string) || null,
      lien: (a.profileUrl as string) || null,
      a_reconnecter: Boolean(a.needsReconnection) || a.isActive === false,
    }));
}

/** Lien d'autorisation (fenêtre du réseau), retour sur `retour`. */
export async function lienConnexionReseau(p: { wsId: string; wsNom: string; reseau: Reseau; retour: string; reconnecter?: string | null }): Promise<string> {
  const profil = await profilEspace(p.wsId, p.wsNom, true);
  const q = new URLSearchParams({ profileId: profil!, redirect_url: p.retour });
  if (p.reconnecter) {
    if (!(await comptesEspace(p.wsId)).some((c) => c.id === p.reconnecter)) throw new Error("Compte inconnu dans cet espace.");
    q.set("reconnectAccountId", p.reconnecter);
  }
  const { data } = await appel<{ authUrl: string }>(`/connect/${p.reseau}?${q}`);
  return data.authUrl;
}

export async function deconnecterCompte(wsId: string, compteId: string): Promise<CompteReseau> {
  const compte = (await comptesEspace(wsId)).find((c) => c.id === compteId);
  if (!compte) throw new Error("Compte inconnu dans cet espace.");
  await appel(`/accounts/${encodeURIComponent(compteId)}`, { method: "DELETE" });
  return compte;
}

/** Contrôle d'une publication avant envoi (renvoie le message d'erreur, ou null). */
export function controlePublication(reseaux: Reseau[], texte: string, medias: string[]): string | null {
  if (!reseaux.length) return "Choisis au moins un compte.";
  const sansMedia = reseaux.filter((r) => MEDIA_OBLIGATOIRE.includes(r));
  if (!medias.length && sansMedia.length) {
    return `${sansMedia.map((r) => NOMS_RESEAUX[r]).join(" et ")} exige${sansMedia.length > 1 ? "nt" : ""} une image ou une vidéo (adresse https publique).`;
  }
  if (!texte.trim() && !medias.length) return "Texte de la publication requis.";
  if (reseaux.includes("linkedin") && texte.length > 3000) return "LinkedIn limite une publication à 3 000 caractères.";
  if (reseaux.includes("instagram") && texte.length > 2200) return "Instagram limite une légende à 2 200 caractères.";
  return null;
}

/** Adresses https des médias (une par ligne ou séparées par des virgules ; 10 au plus). */
export function mediasValides(brut: unknown): string[] | null {
  const liste = (Array.isArray(brut) ? brut.map(String) : String(brut ?? "").split(/[\s,]+/)).map((x) => x.trim()).filter(Boolean);
  if (liste.some((u) => !/^https:\/\/[^\s]+$/i.test(u))) return null;
  return [...new Set(liste)].slice(0, 10);
}

/** Corps de la requête de publication immédiate. TikTok : envoi dans la boîte du créateur (à finaliser dans l'appli). */
export function corpsPublication(comptes: { id: string; reseau: Reseau }[], texte: string, medias: string[]) {
  return {
    content: texte,
    publishNow: true,
    platforms: comptes.map((c) => ({
      platform: c.reseau, accountId: c.id,
      ...(c.reseau === "tiktok" ? { platformSpecificData: { draft: true } } : {}),
    })),
    ...(medias.length ? { mediaItems: medias.map((url) => ({ url })) } : {}),
  };
}

type CiblePubliee = { platform?: string; status?: string; platformPostUrl?: string | null; errorMessage?: string | null };

/** Publie maintenant sur les comptes de l'espace. Échec total → exception ; partiel → erreurs détaillées. */
export async function publier(wsId: string, p: { comptes: string[]; texte: string; medias: string[] }) {
  const connus = await comptesEspace(wsId);
  const cibles = p.comptes.map((id) => connus.find((c) => c.id === id));
  if (cibles.some((c) => !c)) throw new Error("Un des comptes n'est plus connecté à cet espace : reconnectez-le dans Connecteurs.");
  const comptes = cibles as CompteReseau[];
  const erreur = controlePublication(comptes.map((c) => c.reseau), p.texte, p.medias);
  if (erreur) throw new Error(erreur);
  const { data } = await appel<{ post: { _id: string; status: string; platforms?: CiblePubliee[] } }>("/posts", {
    method: "POST", body: JSON.stringify(corpsPublication(comptes, p.texte, p.medias)),
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  const post = data.post;
  const plateformes = post.platforms ?? [];
  const echecs = plateformes.filter((x) => x.status === "failed").map((x) => `${NOMS_RESEAUX[x.platform as Reseau] ?? x.platform} : ${x.errorMessage ?? "échec"}`);
  if (post.status === "failed" || (plateformes.length && echecs.length === plateformes.length)) {
    throw new Error(`Publication refusée — ${echecs.join(" ; ") || post.status}`);
  }
  return {
    id: post._id,
    lien: plateformes.find((x) => x.platformPostUrl)?.platformPostUrl ?? null,
    echecs,
  };
}
