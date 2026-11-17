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

/** « AAAA-MM-JJTHH:MM » (heure de La Réunion) dans le futur, ou null. */
export function dateProgrammee(brut: unknown, maintenant = Date.now()): string | null | "invalide" {
  const s = String(brut ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (!m) return "invalide";
  const iso = `${m[1]}T${m[2]}`;
  const t = Date.parse(`${iso}:00+04:00`);
  if (Number.isNaN(t) || t < maintenant + 5 * 60_000) return "invalide";
  return iso;
}

/** Corps de la requête de publication (immédiate, ou programmée en heure de La Réunion). TikTok : boîte du créateur. */
export function corpsPublication(comptes: { id: string; reseau: Reseau }[], texte: string, medias: string[], programme: string | null = null) {
  return {
    content: texte,
    ...(programme ? { scheduledFor: programme, timezone: "Indian/Reunion" } : { publishNow: true }),
    platforms: comptes.map((c) => ({
      platform: c.reseau, accountId: c.id,
      ...(c.reseau === "tiktok" ? { platformSpecificData: { draft: true } } : {}),
    })),
    ...(medias.length ? { mediaItems: medias.map((url) => ({ url })) } : {}),
  };
}

type CiblePubliee = { platform?: string; status?: string; platformPostUrl?: string | null; errorMessage?: string | null };

/** Publie maintenant sur les comptes de l'espace. Échec total → exception ; partiel → erreurs détaillées. */
export async function publier(wsId: string, p: { comptes: string[]; texte: string; medias: string[]; programme?: string | null }) {
  const connus = await comptesEspace(wsId);
  const cibles = p.comptes.map((id) => connus.find((c) => c.id === id));
  if (cibles.some((c) => !c)) throw new Error("Un des comptes n'est plus connecté à cet espace : reconnectez-le dans Connecteurs.");
  const comptes = cibles as CompteReseau[];
  const erreur = controlePublication(comptes.map((c) => c.reseau), p.texte, p.medias);
  if (erreur) throw new Error(erreur);
  // Date passée entre la proposition et la validation : publication immédiate.
  const programme = p.programme && dateProgrammee(p.programme) !== "invalide" ? p.programme : null;
  const { data } = await appel<{ post: { _id: string; status: string; platforms?: CiblePubliee[] } }>("/posts", {
    method: "POST", body: JSON.stringify(corpsPublication(comptes, p.texte, p.medias, programme)),
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

// ── Lecture (exécutée pendant la conversation) ──
const court = (t: unknown, max: number) => {
  const s = String(t ?? "").replace(/\s+\n/g, "\n").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
};
const enc = encodeURIComponent;

/** Les 25 dernières publications du compte, lues en direct sur le réseau. */
export async function publicationsCompte(compteId: string) {
  const { data } = await appel<{ posts: Record<string, unknown>[] }>(`/accounts/${enc(compteId)}/posts`);
  return (data.posts ?? []).slice(0, 25).map((p) => ({
    id: String(p.id), date: String(p.createdTime ?? "").slice(0, 16), texte: court(p.message, 500),
    lien: p.permalink ?? null, commentaires: p.commentCount ?? 0, jaime: p.likeCount ?? 0,
    reactions: p.reactionCount ?? undefined, partages: p.shareCount ?? undefined,
  }));
}

/** Commentaires d'une publication (ou réponses à un commentaire). */
export async function commentairesPublication(compteId: string, publicationId: string, commentaireId?: string | null) {
  const q = new URLSearchParams({ accountId: compteId, limit: "50", view: "summary" });
  if (commentaireId) q.set("commentId", commentaireId);
  const { data } = await appel<{ comments: Record<string, unknown>[] }>(`/inbox/comments/${enc(publicationId)}?${q}`);
  return (data.comments ?? []).map((c) => {
    const de = (c.from ?? {}) as Record<string, unknown>;
    return {
      id: String(c.id), date: String(c.createdTime ?? "").slice(0, 16), auteur: String(de.name ?? de.username ?? "?"),
      de_nous: Boolean(de.isOwner), texte: court(c.message, 800), jaime: c.likeCount ?? 0, reponses: c.replyCount ?? 0,
    };
  });
}

/** Conversations privées (messagerie de la page). */
export async function conversationsCompte(compteId: string) {
  const { data } = await appel<{ data: Record<string, unknown>[] }>(`/inbox/conversations?accountId=${enc(compteId)}&limit=20`);
  return (data.data ?? []).map((c) => ({
    id: String(c.id), avec: String(c.participantName ?? c.participantId ?? "?"), dernier_message: court(c.lastMessage, 300),
    date: String(c.updatedTime ?? "").slice(0, 16), non_lus: c.unreadCount ?? 0,
  }));
}

/** Les 30 derniers messages d'une conversation, du plus ancien au plus récent. */
export async function messagesConversation(compteId: string, conversationId: string) {
  const { data } = await appel<{ messages: Record<string, unknown>[] }>(
    `/inbox/conversations/${enc(conversationId)}/messages?accountId=${enc(compteId)}&limit=30&sortOrder=desc`,
  );
  return (data.messages ?? []).filter((m) => !m.isDeleted).reverse().map((m) => ({
    date: String(m.createdAt ?? "").slice(0, 16), de: m.direction === "outgoing" ? "nous" : String(m.senderName ?? "contact"),
    texte: court(m.message, 1500), pieces_jointes: Array.isArray(m.attachments) ? m.attachments.length : 0,
  }));
}

/** Le dernier message (non supprimé) vient du contact : la conversation attend une réponse de notre part. */
export function attendReponse(messagesRecentsDAbord: Record<string, unknown>[]): boolean {
  const dernier = messagesRecentsDAbord.find((m) => !m.isDeleted);
  return Boolean(dernier) && dernier!.direction !== "outgoing";
}

/** Conversations dont le dernier message vient du contact, avec ses derniers messages. */
export async function conversationsSansReponse(compteId: string) {
  const liste = await conversationsCompte(compteId);
  const resultats = await Promise.all(liste.map(async (c) => {
    try {
      const { data } = await appel<{ messages: Record<string, unknown>[] }>(
        `/inbox/conversations/${enc(c.id)}/messages?accountId=${enc(compteId)}&limit=10&sortOrder=desc`,
      );
      const msgs = data.messages ?? [];
      if (!attendReponse(msgs)) return null;
      const attente = [];
      for (const m of msgs) {
        if (m.isDeleted) continue;
        if (m.direction === "outgoing") break;
        attente.unshift({ date: String(m.createdAt ?? "").slice(0, 16), texte: court(m.message, 800) });
      }
      return { ...c, messages_en_attente: attente.slice(-5) };
    } catch { return null; }
  }));
  return resultats.filter((x) => x !== null);
}

/** Abonnés et engagement récent de chaque compte. */
export async function statistiques(comptes: CompteReseau[]) {
  const ids = comptes.map((c) => c.id).slice(0, 25);
  const [abonnes, pubs] = await Promise.all([
    appel<{ accounts: Record<string, unknown>[] }>(`/accounts/follower-stats?accountIds=${ids.join(",")}&granularity=monthly`)
      .then((r) => r.data.accounts ?? []).catch(() => [] as Record<string, unknown>[]),
    Promise.all(comptes.map((c) => publicationsCompte(c.id).catch(() => []))),
  ]);
  return comptes.map((c, i) => {
    const a = abonnes.find((x) => String(x._id) === c.id) ?? {};
    const p = pubs[i];
    const somme = (k: "jaime" | "commentaires") => p.reduce((s, x) => s + Number(x[k] ?? 0), 0);
    return {
      compte: `${NOMS_RESEAUX[c.reseau]} — ${c.nom}`, abonnes: a.currentFollowers ?? null,
      croissance: a.growth ?? null, croissance_pct: a.growthPercentage ?? null,
      publications_analysees: p.length, derniere_publication: p[0]?.date ?? null,
      jaime_total: somme("jaime"), commentaires_total: somme("commentaires"),
      meilleure_publication: p.length ? [...p].sort((x, y) => (Number(y.jaime) + Number(y.commentaires)) - (Number(x.jaime) + Number(x.commentaires)))[0] : null,
    };
  });
}

// ── Écriture (exécutée au VALIDÉ, après contrôle d'appartenance du compte) ──
async function compteDeLEspace(wsId: string, compteId: string): Promise<CompteReseau> {
  const c = (await comptesEspace(wsId)).find((x) => x.id === compteId);
  if (!c) throw new Error("Ce compte n'est plus connecté à cet espace : reconnectez-le dans Connecteurs.");
  return c;
}

export async function repondreCommentaire(wsId: string, p: { compteId: string; publicationId: string; commentaireId?: string | null; texte: string }) {
  await compteDeLEspace(wsId, p.compteId);
  const { data } = await appel<{ data?: { commentId?: string } }>(`/inbox/comments/${enc(p.publicationId)}`, {
    method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ accountId: p.compteId, message: p.texte, ...(p.commentaireId ? { commentId: p.commentaireId } : {}) }),
  });
  return { id: String(data.data?.commentId ?? "") };
}

export async function envoyerMessage(wsId: string, p: { compteId: string; conversationId: string; texte: string }) {
  await compteDeLEspace(wsId, p.compteId);
  const { data } = await appel<{ data?: { messageId?: string } }>(`/inbox/conversations/${enc(p.conversationId)}/messages`, {
    method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ accountId: p.compteId, message: p.texte }),
  });
  return { id: String(data.data?.messageId ?? "") };
}
