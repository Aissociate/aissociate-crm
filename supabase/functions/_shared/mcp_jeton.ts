// Jetons personnels du serveur MCP distant (table `mcp_jetons`).
//
// Le jeton en clair (`crm_mcp_` + 43 caractères base64url) n'est connu que de
// son propriétaire : la base ne garde que son empreinte SHA-256 (hex). On le
// vérifie à CHAQUE requête — une révocation prend donc effet immédiatement.
//
// Contexte RLS (voir `sessionUtilisateur`) : le projet signe ses sessions en
// ES256 et la clé privée n'est pas extractible, on ne peut donc pas fabriquer
// soi-même un JWT utilisateur. La fonction ouvre à la place une VRAIE session
// Supabase Auth pour l'utilisateur du jeton (lien magique généré côté serveur,
// jamais envoyé, vérifié aussitôt), puis ferme cette session : le refresh
// token est détruit, l'access token (≤ 1 h) reste valable pour PostgREST.
// Cet access token ne sort jamais de la fonction ; il est gardé en mémoire de
// l'instance et renouvelé avant expiration.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

export const PREFIXE_JETON = "crm_mcp_";
const FORMAT_JETON = /^crm_mcp_[A-Za-z0-9_-]{43}$/;

export type JetonValide = { id: string; user_id: string; libelle: string; last_used_at: string | null };
export type VerificationJeton =
  | { ok: true; jeton: JetonValide }
  | { ok: false; raison: "absent" | "format" | "inconnu" | "revoque" | "expire" };

/**
 * Jeton porté par la requête : en-tête `Authorization: Bearer …` (n8n, Claude
 * Desktop via mcp-remote), sinon paramètre d'URL `?jeton=` pour les clients
 * qui n'envoient pas d'en-tête personnalisé (connecteur claude.ai).
 */
export function extraireJeton(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  const m = /^Bearer\s+(\S+)\s*$/i.exec(auth);
  if (m) return m[1];
  const q = new URL(req.url).searchParams.get("jeton");
  return q ? q.trim() : null;
}

export async function empreinte(jeton: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jeton));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** `admin` : client service, seul à lire `mcp_jetons` hors contexte utilisateur. */
export async function verifierJeton(
  admin: SupabaseClient, brut: string | null, maintenant: Date = new Date(),
): Promise<VerificationJeton> {
  if (!brut) return { ok: false, raison: "absent" };
  if (!FORMAT_JETON.test(brut)) return { ok: false, raison: "format" };
  const { data, error } = await admin.from("mcp_jetons")
    .select("id, user_id, libelle, revoked_at, expires_at, last_used_at")
    .eq("empreinte", await empreinte(brut))
    .maybeSingle();
  if (error) throw new Error(`Lecture des jetons impossible : ${error.message}`);
  if (!data) return { ok: false, raison: "inconnu" };
  if (data.revoked_at) return { ok: false, raison: "revoque" };
  if (data.expires_at && new Date(String(data.expires_at)) <= maintenant) return { ok: false, raison: "expire" };
  return {
    ok: true,
    jeton: { id: String(data.id), user_id: String(data.user_id), libelle: String(data.libelle), last_used_at: (data.last_used_at as string | null) ?? null },
  };
}

export const MESSAGES_REFUS: Record<Exclude<VerificationJeton, { ok: true }>["raison"], string> = {
  absent: "Jeton MCP manquant (en-tête Authorization: Bearer crm_mcp_…).",
  format: "Jeton MCP mal formé.",
  inconnu: "Jeton MCP inconnu.",
  revoque: "Jeton MCP révoqué.",
  expire: "Jeton MCP expiré.",
};

/** Met à jour `last_used_at`, au plus une fois toutes les 5 minutes. */
export async function marquerUtilisation(admin: SupabaseClient, jeton: JetonValide, maintenant: Date = new Date()): Promise<boolean> {
  if (jeton.last_used_at && maintenant.getTime() - new Date(jeton.last_used_at).getTime() < 5 * 60_000) return false;
  await admin.from("mcp_jetons").update({ last_used_at: maintenant.toISOString() }).eq("id", jeton.id);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session utilisateur (contexte RLS)
// ─────────────────────────────────────────────────────────────────────────────

export type SessionCourte = { access_token: string; expire_a: number /* epoch s */ };

/**
 * Ouvre une session Supabase Auth pour `userId` et la ferme aussitôt.
 * `admin` : client service ; `anon` : client clé publique sans persistance.
 */
export async function sessionUtilisateur(admin: SupabaseClient, anon: SupabaseClient, userId: string): Promise<SessionCourte> {
  const { data: u, error: eUser } = await admin.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (eUser || !email) throw new Error("Utilisateur du jeton introuvable.");
  const { data: lien, error: eLien } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hash = lien?.properties?.hashed_token;
  if (eLien || !hash) throw new Error(`Session impossible : ${eLien?.message ?? "lien non généré"}`);
  const { data: v, error: eOtp } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: hash });
  const session = v?.session;
  if (eOtp || !session) throw new Error(`Session impossible : ${eOtp?.message ?? "vérification refusée"}`);
  if (session.user?.id !== userId) throw new Error("Session ouverte pour un autre utilisateur : refus.");
  // Ferme la session côté Auth (supprime le refresh token). L'access token
  // reste valide jusqu'à son expiration pour la Data API.
  await admin.auth.admin.signOut(session.access_token, "local");
  return { access_token: session.access_token, expire_a: session.expires_at ?? Math.floor(Date.now() / 1000) + 3000 };
}

/**
 * Cache mémoire (par instance) des sessions, par jeton. Renouvelle la session
 * 5 minutes avant son expiration.
 */
export function cacheSessions(
  ouvrir: (userId: string) => Promise<SessionCourte>,
  maintenant: () => number = () => Date.now() / 1000,
) {
  const cache = new Map<string, SessionCourte & { user_id: string }>();
  return {
    async obtenir(jeton: JetonValide): Promise<string> {
      const s = cache.get(jeton.id);
      if (s && s.user_id === jeton.user_id && s.expire_a - maintenant() > 300) return s.access_token;
      const neuve = await ouvrir(jeton.user_id);
      cache.set(jeton.id, { ...neuve, user_id: jeton.user_id });
      return neuve.access_token;
    },
    oublier(jetonId: string) { cache.delete(jetonId); },
    taille: () => cache.size,
  };
}
