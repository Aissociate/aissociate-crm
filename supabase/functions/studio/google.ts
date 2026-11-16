// Appels aux API Google pour les outils des agents (Gmail, Agenda), avec des
// messages d'erreur lisibles. Le jeton vient de Nango, pour l'espace de la session.

export async function appelGoogle(jeton: string, url: string, service: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(url, { ...init, headers: { "Authorization": `Bearer ${jeton}`, ...(init.headers ?? {}) } });
  if (r.status === 401 || r.status === 403) {
    const t = await r.text();
    throw new Error(/insufficient|scope|PERMISSION/i.test(t)
      ? `La connexion ${service} n'autorise pas cette opération (droits insuffisants). Reconnectez ${service} depuis « Connecteurs » en acceptant tous les accès demandés.`
      : `Accès à ${service} refusé (${r.status}).`);
  }
  if (!r.ok) throw new Error(`${service} ${r.status} : ${(await r.text()).slice(0, 200)}`);
  return r;
}

/** Adresses e-mail valides d'une liste « a@x.fr, b@y.fr » (doublons retirés), ou null si l'une est invalide. */
export function adressesValides(liste: string | undefined | null): string[] | null {
  const items = String(liste ?? "").split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
  const ok = items.every((x) => /^[^\s@<>()"]+@[^\s@<>()"]+\.[a-z]{2,}$/i.test(x));
  return ok ? [...new Set(items.map((x) => x.toLowerCase()))] : null;
}
