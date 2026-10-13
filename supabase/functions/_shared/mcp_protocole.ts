// Protocole MCP (JSON-RPC 2.0) pour le transport Streamable HTTP, en mode
// SANS ÉTAT : chaque POST porte un message (ou un lot) et reçoit une réponse
// `application/json` — la spécification l'autorise, pas besoin de SSE ni
// d'identifiant de session. Le transport (HTTP, auth) vit dans `mcp/index.ts`.
export const VERSIONS_PROTOCOLE = ["2025-06-18", "2025-03-26", "2024-11-05"];

export type OutilMcp = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
};

export type Serveur = {
  nom: string;
  version: string;
  instructions: string;
  lister: () => Promise<OutilMcp[]>;
  appeler: (nom: string, args: Record<string, unknown>) => Promise<unknown>;
};

type Message = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
type Reponse = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

const erreur = (id: Message["id"], code: number, message: string): Reponse => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const TAILLE_MAX = 60_000;

/** Convertit le catalogue de l'agent (format OpenAI tools) en outils MCP. */
export function versOutilsMcp(tools: Record<string, unknown>[]): OutilMcp[] {
  return tools.map((t) => {
    const f = (t as { function: { name: string; description: string; parameters: Record<string, unknown> } }).function;
    const ecriture = f.name.startsWith("proposer_");
    return {
      name: f.name,
      description: ecriture ? `${f.description} Crée une PROPOSITION à valider dans le CRM : rien n'est écrit avant.` : f.description,
      inputSchema: f.parameters,
      annotations: ecriture
        ? { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
        : { readOnlyHint: true, openWorldHint: false },
    };
  });
}

/** Traite UN message. `null` = notification (pas de réponse). */
export async function traiterMessage(serveur: Serveur, m: Message): Promise<Reponse | null> {
  if (!m || typeof m !== "object" || m.jsonrpc !== "2.0" || typeof m.method !== "string") {
    return erreur(m?.id, -32600, "Requête JSON-RPC invalide");
  }
  const notification = m.id === undefined || m.id === null;
  if (notification) return null;
  const id = m.id as string | number;
  try {
    switch (m.method) {
      case "initialize": {
        const demandee = String(m.params?.protocolVersion ?? "");
        return {
          jsonrpc: "2.0", id,
          result: {
            protocolVersion: VERSIONS_PROTOCOLE.includes(demandee) ? demandee : VERSIONS_PROTOCOLE[0],
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: serveur.nom, version: serveur.version },
            instructions: serveur.instructions,
          },
        };
      }
      case "ping":
        return { jsonrpc: "2.0", id, result: {} };
      case "tools/list":
        return { jsonrpc: "2.0", id, result: { tools: await serveur.lister() } };
      case "tools/call": {
        const nom = String(m.params?.name ?? "");
        const args = (m.params?.arguments ?? {}) as Record<string, unknown>;
        const outils = await serveur.lister();
        if (!outils.some((o) => o.name === nom)) return erreur(id, -32602, `Outil inconnu ou non autorisé : ${nom}`);
        const res = await serveur.appeler(nom, args);
        const texte = JSON.stringify(res ?? {});
        const enErreur = !!res && typeof res === "object" && "erreur" in (res as Record<string, unknown>);
        return {
          jsonrpc: "2.0", id,
          result: {
            content: [{ type: "text", text: texte.length > TAILLE_MAX ? `${texte.slice(0, TAILLE_MAX)}… (tronqué)` : texte }],
            isError: enErreur,
          },
        };
      }
      default:
        return erreur(id, -32601, `Méthode non prise en charge : ${m.method}`);
    }
  } catch (e) {
    // Erreur d'exécution d'outil : renvoyée au modèle, pas une erreur de protocole.
    if (m.method === "tools/call") {
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true } };
    }
    return erreur(id, -32603, e instanceof Error ? e.message : String(e));
  }
}

/** Corps HTTP → réponse JSON (ou `null` si uniquement des notifications → 202). */
export async function traiterCorps(serveur: Serveur, corps: unknown): Promise<Reponse | Reponse[] | null> {
  if (Array.isArray(corps)) {
    if (!corps.length) return erreur(null, -32600, "Lot vide");
    const reps = (await Promise.all(corps.map((m) => traiterMessage(serveur, m as Message)))).filter((r): r is Reponse => r !== null);
    return reps.length ? reps : null;
  }
  return traiterMessage(serveur, corps as Message);
}
