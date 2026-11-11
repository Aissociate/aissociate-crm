// Client HTTP du Studio IA. Volontairement indépendant du client Supabase du
// CRM : les clients n'ont pas de session Supabase, seulement un jeton Studio.
const URL_FN = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/studio`;
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
const CLE_JETON = 'studio.jeton';

export type Champ = { nom: string; label: string; type: 'texte' | 'long' | 'choix'; options?: string[]; requis?: boolean; aide?: string };
export type SuperPouvoir = { id: string; titre: string; description?: string; champs: Champ[] };
export type Agent = {
  super_pouvoirs: SuperPouvoir[];
  id: string; prenom: string; metier: string; accroche: string; description: string;
  demandes: { titre: string; prompt: string }[]; minutes_par_tache: number; couleur: string; ordre: number;
};
export type Conversation = { id: string; agent_id: string; titre: string; updated_at: string };
export type Message = {
  id?: string; role: 'user' | 'assistant'; content: string; retour?: number | null; epingle?: boolean; created_at?: string;
};
export type Ressource = {
  id: string; titre: string; type: 'fichier' | 'note'; format: string | null; taille: number | null;
  actif: boolean; created_at: string; studio_users: { prenom: string | null; nom: string | null } | null;
};
export type Me = {
  user: { id: string; email: string; prenom: string | null; nom: string | null; role: 'proprietaire' | 'membre'; doit_changer: boolean };
  workspace: { id: string; nom: string; offre: string; quota_messages_mois: number | null; contexte_entreprise: string; expire_le: string | null };
  agents: Agent[];
  stats: {
    demandes_mois: number; quota_mois: number | null; reponses_mois: number;
    minutes_gagnees_mois: number; minutes_gagnees_total: number; ressources_actives: number;
  };
  conversations: Conversation[];
};

export class SessionExpiree extends Error {}

export const jeton = {
  lire(): string | null { try { return localStorage.getItem(CLE_JETON); } catch { return null; } },
  ecrire(t: string | null) {
    try { if (t) localStorage.setItem(CLE_JETON, t); else localStorage.removeItem(CLE_JETON); } catch { /* stockage bloqué */ }
  },
};

function entetes(): HeadersInit {
  return { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` };
}

/** Appel d'une action JSON. Lève SessionExpiree sur 401 (jeton invalide). */
export async function appel<T = Record<string, unknown>>(action: string, donnees: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(URL_FN, {
    method: 'POST', headers: entetes(),
    body: JSON.stringify({ action, token: jeton.lire(), ...donnees }),
  });
  const corps = await r.json().catch(() => ({}));
  if (r.status === 401 && action !== 'login') { jeton.ecrire(null); throw new SessionExpiree(corps.error ?? 'Session expirée'); }
  if (!r.ok) throw new Error(corps.error ?? `Erreur ${r.status}`);
  return corps as T;
}

/** Chat en flux SSE : `onDelta` reçoit le texte au fil de l'eau. */
export async function discuter(
  params: { agent_id: string; message?: string; conversation_id?: string | null; pouvoir?: { id: string; valeurs: Record<string, string> } },
  cb: { onMeta?: (m: { conversation_id: string; ressources: string[] }) => void; onDelta: (t: string) => void },
  signal?: AbortSignal,
): Promise<{ message_id: string | null; conversation_id: string }> {
  const r = await fetch(URL_FN, {
    method: 'POST', headers: entetes(), signal,
    body: JSON.stringify({ action: 'chat', token: jeton.lire(), ...params }),
  });
  if (!r.ok || !r.body) {
    const corps = await r.json().catch(() => ({}));
    if (r.status === 401) { jeton.ecrire(null); throw new SessionExpiree(corps.error ?? 'Session expirée'); }
    throw new Error(corps.error ?? `Erreur ${r.status}`);
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let fin: { message_id: string | null; conversation_id: string } | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const blocs = buf.split('\n\n');
    buf = blocs.pop() ?? '';
    for (const bloc of blocs) {
      const ev = /^event: (.+)$/m.exec(bloc)?.[1];
      const raw = /^data: (.+)$/m.exec(bloc)?.[1];
      if (!ev || !raw) continue;
      let data: Record<string, unknown>;
      try { data = JSON.parse(raw); } catch { continue; }
      // Les erreurs serveur doivent remonter telles quelles (hors du try/catch du parse).
      if (ev === 'error') throw new Error(String(data.message ?? 'Erreur du service IA'));
      if (ev === 'meta') cb.onMeta?.(data as never);
      if (ev === 'delta') cb.onDelta(String(data.text ?? ''));
      if (ev === 'done') fin = data as never;
    }
  }
  if (!fin) throw new Error('Réponse interrompue. Réessayez.');
  return fin;
}

export function minutesEnTexte(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Balise de relais émise par un agent face à une demande hors de son périmètre. */
export function extraireRelais(contenu: string): { texte: string; relais: string | null } {
  const m = /\[\[RELAIS:([a-z0-9_-]+)\]\]/i.exec(contenu);
  // Pendant le flux, une balise incomplète en fin de texte est masquée aussi.
  const texte = contenu.replace(/\[\[RELAIS:[a-z0-9_-]+\]\]/gi, '').replace(/\[\[(R(E(L(A(I(S(:[a-z0-9_-]*\]?)?)?)?)?)?)?)?$/i, '').trimEnd();
  return { texte, relais: m ? m[1].toLowerCase() : null };
}
