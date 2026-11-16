// Appels à l'API AgentMail (boîtes de liaison des espaces). Clé : secret
// AGENTMAIL_API_KEY de la fonction. Auth : « Authorization: Bearer » (pas x-api-key).
const BASE = "https://api.agentmail.to/v0";

export const agentmailConfigure = () => Boolean(Deno.env.get("AGENTMAIL_API_KEY")?.trim());

async function api<T>(chemin: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const cle = Deno.env.get("AGENTMAIL_API_KEY")?.trim();
  if (!cle) throw new Error("AgentMail non configuré (secret AGENTMAIL_API_KEY manquant).");
  const r = await fetch(`${BASE}${chemin}`, {
    method: init.method ?? "GET",
    headers: { "Authorization": `Bearer ${cle}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const texte = await r.text();
  if (!r.ok) throw new Error(`AgentMail ${r.status} : ${texte.slice(0, 300)}`);
  return (texte ? JSON.parse(texte) : {}) as T;
}

/** Nom d'utilisateur d'adresse à partir du nom de l'espace : « Les Délices » → « les-delices ». */
export function identifiantBoite(nom: string): string {
  const s = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return s || "studio";
}

export type Boite = { inbox_id: string; email: string };

/**
 * Crée la boîte de liaison d'un espace. `client_id` = id de l'espace : rejouer la
 * création renvoie la même boîte au lieu d'en créer une seconde.
 */
export async function creerBoite(p: { wsId: string; nom: string; username?: string; domaine?: string | null }): Promise<Boite> {
  const corps: Record<string, unknown> = {
    username: p.username || identifiantBoite(p.nom),
    display_name: `${p.nom} — Studio IA`.slice(0, 80),
    client_id: `studio-${p.wsId}`,
  };
  if (p.domaine) corps.domain = p.domaine;
  const b = await api<Boite>("/inboxes", { method: "POST", body: corps });
  return { inbox_id: b.inbox_id, email: b.email };
}

/** Répond dans le fil du message reçu (marqué comme réponse automatique : pas de boucle). */
export async function repondre(inboxId: string, messageId: string, texte: string): Promise<void> {
  await api(`/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(messageId)}/reply`, {
    method: "POST",
    body: { text: texte, headers: { "Auto-Submitted": "auto-replied" } },
  });
}

export function secretsWebhook(): string[] {
  return [Deno.env.get("AGENTMAIL_WEBHOOK_SECRET"), Deno.env.get("AGENTMAIL_WEBHOOK_SECRET_PRECEDENT")]
    .map((s) => s?.trim() ?? "").filter(Boolean);
}
