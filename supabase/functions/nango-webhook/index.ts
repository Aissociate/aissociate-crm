// Edge Function PUBLIQUE (verify_jwt=false) — webhooks Nango (connexions des clients).
//
// À configurer dans Nango › Environment settings › Webhooks :
//   URL         https://<projet>.supabase.co/functions/v1/nango-webhook
//   Signing key → secret Supabase NANGO_WEBHOOK_SIGNING_KEY
//   (pendant une rotation, l'ancienne clé peut être mise dans NANGO_WEBHOOK_SIGNING_KEY_PRECEDENTE)
//
// Sécurité / cloisonnement :
//   - signature HMAC-SHA256 du corps brut (en-tête X-Nango-Hmac-Sha256) obligatoire ;
//   - l'espace client vient du tag organization_id, posé par NOTRE serveur à la
//     création de la session de connexion ; enregistrerConnexion() refuse un
//     espace inexistant et ne déplace jamais une connexion d'un espace à un autre.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";
import { enregistrerConnexion } from "../studio/nango.ts";

const enc = new TextEncoder();

async function hmacHex(cle: string, corps: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(cle), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(corps)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparaison à temps constant de deux chaînes hexadécimales. */
function egal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const reponse = (status: number, corps: unknown = { ok: status < 300 }) =>
  new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return reponse(405);
  const cles = [Deno.env.get("NANGO_WEBHOOK_SIGNING_KEY"), Deno.env.get("NANGO_WEBHOOK_SIGNING_KEY_PRECEDENTE")]
    .map((k) => k?.trim()).filter((k): k is string => Boolean(k));
  if (!cles.length) return reponse(503, { error: "Clé de signature non configurée" });

  const brut = await req.text();
  const recue = (req.headers.get("x-nango-hmac-sha256") ?? "").toLowerCase();
  let valide = false;
  for (const k of cles) if (egal(await hmacHex(k, brut), recue)) valide = true;
  if (!valide) return reponse(401, { error: "Signature invalide" });

  let e: Record<string, unknown>;
  try { e = JSON.parse(brut); } catch { return reponse(400); }

  // Seuls les événements d'autorisation nous intéressent ; les autres sont acquittés.
  if (e.type !== "auth") return reponse(200, { ok: true, ignore: true });
  const tags = (e.tags ?? {}) as Record<string, string>;
  const wsId = tags.organization_id;
  const connectionId = String(e.connectionId ?? "");
  const integrationId = String(e.providerConfigKey ?? "");
  if (!wsId || !connectionId || !integrationId) return reponse(200, { ok: true, ignore: true });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ok = await enregistrerConnexion(sb, {
    wsId, integrationId, connectionId, provider: e.provider ? String(e.provider) : null,
    statut: e.success === false ? "erreur" : "connecte",
    erreur: e.success === false ? "Autorisation refusée ou expirée : reconnectez l'application." : null,
    email: tags.end_user_email ?? null,
  });
  // 200 même si refusé (espace inconnu) : Nango n'a pas à réessayer.
  return reponse(200, { ok });
});
