import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ImapFlow } from "npm:imapflow@1.0.171";
import { simpleParser } from "npm:mailparser@3.7.1";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

// Priorité : table parametres (cle='imap'), puis secrets Supabase en repli.
// Port 993 → SSL/TLS (secure=true) ; port 143 → STARTTLS (secure=false).
async function loadImap(sb: ReturnType<typeof createClient>): Promise<ImapConfig | null> {
  const { data } = await sb.from("parametres").select("valeur").eq("cle", "imap").maybeSingle();
  const c = (data?.valeur ?? {}) as Record<string, unknown>;

  const host = (c.host as string) || Deno.env.get("IMAP_HOST");
  const user = (c.user as string) || Deno.env.get("IMAP_USERNAME");
  const pass = (c.password as string) || Deno.env.get("IMAP_PASSWORD");
  const port = Number(c.port) || Number(Deno.env.get("IMAP_PORT") ?? "0") || 993;

  if (!host || !user || !pass) return null;
  return { host, user, pass, port };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cfg = await loadImap(sb);
    if (!cfg) {
      return json({ error: "Configuration IMAP incomplète (Paramètres → Serveur IMAP)" }, 500);
    }

    const client = new ImapFlow({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 993,
      auth: { user: cfg.user, pass: cfg.pass },
      logger: false,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      disableAutoIdle: true,
    });

    await Promise.race([
      client.connect(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("Connexion IMAP : délai dépassé (hôte/port/identifiants ?)")), 20000)
      ),
    ]);

    const MAX = 30;
    let imported = 0;
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = (await client.search({ seen: false }, { uid: true })) || [];
      const recent = uids.slice(-MAX);
      for await (const msg of (recent.length
        ? client.fetch(recent, { envelope: true, source: true }, { uid: true })
        : [])) {
        const parsed = await simpleParser(msg.source as Uint8Array);
        const messageId = parsed.messageId ?? `imap-${msg.uid}`;
        const from = parsed.from?.text ?? msg.envelope?.from?.[0]?.address ?? null;
        const fromAddr = parsed.from?.value?.[0]?.address ?? msg.envelope?.from?.[0]?.address ?? null;
        const to = (parsed.to?.value ?? [])
          .map((a: { address?: string }) => a.address)
          .filter(Boolean);

        let contactId: string | null = null;
        let ownerId: string | null = null;
        if (fromAddr) {
          const { data: contact } = await sb
            .from("contacts")
            .select("id, owner_id")
            .ilike("email", fromAddr)
            .limit(1)
            .maybeSingle();
          if (contact) {
            contactId = contact.id;
            ownerId = contact.owner_id ?? null;
          }
        }

        const { error } = await sb.from("emails").insert({
          direction: "entrant",
          message_id: messageId,
          expediteur: from,
          destinataires: to,
          contact_id: contactId,
          owner_id: ownerId,
          sujet: parsed.subject ?? "(sans objet)",
          corps: parsed.text ?? parsed.html ?? "",
          statut: "recu",
          lu: false,
          sent_at: parsed.date ? new Date(parsed.date).toISOString() : null,
        });

        if (!error) imported++;
        else if ((error as { code?: string }).code !== "23505") {
          console.error("insert error", error.message);
        }

        await client.messageFlagsAdd(msg.uid, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
    await client.logout();

    return json({ ok: true, imported });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
