// Edge Function — rapprochement bancaire Qonto ↔ factures.
// Récupère les transactions créditées du compte Qonto et marque « payée »
// toute facture « envoyée » dont le montant correspond ET dont le libellé /
// la référence mentionne le numéro de facture. Un montant identique SANS
// mention du numéro n'est jamais rapproché automatiquement (proposé en
// « à vérifier » dans le détail du job).
// Config : secrets QONTO_LOGIN (slug organisation) + QONTO_SECRET_KEY,
// ou table parametres (cle='qonto', valeur={login, secret_key, iban?}).
// Ne fait rien (ok, skipped) tant que la config est absente.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function logRun(sb: SupabaseClient, startedAt: string, ok: boolean, message: string, detail?: unknown) {
  try {
    await sb.from("job_runs").insert({
      fonction: "qonto-sync", started_at: startedAt, finished_at: new Date().toISOString(),
      ok, message, detail: detail ?? null,
    });
  } catch { /* jamais bloquant */ }
}

interface QontoTx {
  transaction_id: string;
  amount: number;
  side: "credit" | "debit";
  label: string | null;
  reference: string | null;
  settled_at: string | null;
  status: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const startedAt = new Date().toISOString();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // Config : secrets d'abord, table parametres en repli.
    let login = Deno.env.get("QONTO_LOGIN");
    let secretKey = Deno.env.get("QONTO_SECRET_KEY");
    let iban: string | undefined = Deno.env.get("QONTO_IBAN") ?? undefined;
    if (!login || !secretKey) {
      const { data } = await sb.from("parametres").select("valeur").eq("cle", "qonto").maybeSingle();
      const c = (data?.valeur ?? {}) as Record<string, string>;
      login = login ?? c.login;
      secretKey = secretKey ?? c.secret_key;
      iban = iban ?? c.iban;
    }
    if (!login || !secretKey) {
      await logRun(sb, startedAt, true, "Configuration Qonto absente : rapprochement ignoré");
      return json({ ok: true, skipped: "Configuration Qonto absente (QONTO_LOGIN / QONTO_SECRET_KEY)" });
    }

    // Factures en attente de règlement.
    const { data: factures } = await sb.from("factures")
      .select("id, numero, total_ttc, statut").eq("statut", "envoyee");
    if (!factures?.length) {
      await logRun(sb, startedAt, true, "Aucune facture en attente de règlement");
      return json({ ok: true, rapprochees: 0 });
    }

    const auth = `${login}:${secretKey}`;
    const base = "https://thirdpartygateway.qonto.com/v2";

    // IBAN du compte : fourni, sinon premier compte de l'organisation.
    if (!iban) {
      const r = await fetch(`${base}/organization`, { headers: { Authorization: auth } });
      if (!r.ok) throw new Error(`Qonto /organization : HTTP ${r.status}`);
      const org = await r.json();
      iban = org?.organization?.bank_accounts?.[0]?.iban;
      if (!iban) throw new Error("Aucun compte bancaire Qonto trouvé");
    }

    // Transactions créditées des 90 derniers jours (pagination).
    const depuis = new Date(Date.now() - 90 * 86400_000).toISOString();
    const txs: QontoTx[] = [];
    let pageNum = 1;
    for (;;) {
      const url = `${base}/transactions?iban=${encodeURIComponent(iban)}&side=credit&status[]=completed&settled_at_from=${encodeURIComponent(depuis)}&per_page=100&current_page=${pageNum}`;
      const r = await fetch(url, { headers: { Authorization: auth } });
      if (!r.ok) throw new Error(`Qonto /transactions : HTTP ${r.status}`);
      const data = await r.json();
      txs.push(...((data?.transactions ?? []) as QontoTx[]));
      const next = data?.meta?.next_page;
      if (!next) break;
      pageNum = next;
      if (pageNum > 50) break; // garde-fou
    }

    // Rapprochement : montant identique (± 1 centime) ET numéro de facture
    // cité dans le libellé ou la référence du virement.
    const norm = (s: string | null) => (s ?? "").toUpperCase().replace(/[\s-]/g, "");
    let rapprochees = 0;
    const aVerifier: { facture: string; transactions: string[] }[] = [];
    for (const f of factures) {
      const numeroNorm = norm(f.numero);
      const montant = Number(f.total_ttc) || 0;
      if (montant <= 0) continue;
      const memesMontants = txs.filter((t) => Math.abs(Number(t.amount) - montant) < 0.01);
      const citee = memesMontants.find((t) => (norm(t.label) + " " + norm(t.reference)).includes(numeroNorm));
      if (citee) {
        await sb.from("factures").update({
          statut: "payee",
          date_reglement: (citee.settled_at ?? new Date().toISOString()).slice(0, 10),
          mode_reglement: "virement",
          qonto_transaction_id: citee.transaction_id,
          rapproche_le: new Date().toISOString(),
        }).eq("id", f.id);
        rapprochees++;
      } else if (memesMontants.length > 0) {
        aVerifier.push({ facture: f.numero, transactions: memesMontants.map((t) => `${t.transaction_id} (${t.label ?? "sans libellé"})`) });
      }
    }

    const message = `${rapprochees} facture(s) rapprochée(s), ${aVerifier.length} à vérifier manuellement`;
    await logRun(sb, startedAt, true, message, { rapprochees, a_verifier: aVerifier });
    return json({ ok: true, rapprochees, a_verifier: aVerifier });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRun(sb, startedAt, false, message);
    return json({ error: message }, 500);
  }
});
