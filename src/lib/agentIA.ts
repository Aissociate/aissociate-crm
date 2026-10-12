import { supabase } from './supabase';
import type { AiAction } from './database.types';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent`;

/** Appel JSON à l'Edge Function `agent` (modes execute, cancel, undo). */
export async function appelAgent(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { ok: false, status: 401, data: { error: 'Session expirée, reconnectez-vous.' } };
  const res = await fetch(FUNCTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null) as Record<string, unknown> | null;
  return { ok: res.ok, status: res.status, data };
}

/** Plan d'annulation rangé à l'exécution (voir supabase/functions/agent/annulation.ts). */
type Annulation = { possible: true } | { possible: false; raison: string };

/** État « défaire » d'une action : possible, déjà fait, ou impossible (avec la raison). */
export function etatAnnulation(action: AiAction): { possible: boolean; faiteLe: string | null; raison: string | null } {
  const r = action.resultat ?? {};
  const plan = r.annulation as Annulation | undefined;
  const faiteLe = typeof r.annulee_le === 'string' ? r.annulee_le : null;
  if (action.statut !== 'executee' || !plan) return { possible: false, faiteLe, raison: null };
  return { possible: plan.possible && !faiteLe, faiteLe, raison: plan.possible ? null : plan.raison };
}

/** Défait une action exécutée ; renvoie le nouveau `resultat` ou lève l'erreur du serveur. */
export async function defaireActionIA(action: AiAction): Promise<Record<string, unknown>> {
  const { ok, data } = await appelAgent({ mode: 'undo', action_id: action.id });
  if (!ok) throw new Error(String(data?.error ?? 'Annulation impossible'));
  return { ...(action.resultat ?? {}), annulee_le: data?.annulee_le };
}
