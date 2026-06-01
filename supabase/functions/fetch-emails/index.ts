import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Buffer } from "node:buffer";
import { simpleParser } from "npm:mailparser@3.7.1";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ImapCfg { host: string; port: number; user: string; pass: string; }

async function loadImap(sb: ReturnType<typeof createClient>): Promise<ImapCfg | null> {
  const { data } = await sb.from("parametres").select("valeur").eq("cle", "imap").maybeSingle();
  const c = (data?.valeur ?? {}) as Record<string, unknown>;
  const host = (c.host as string) || Deno.env.get("IMAP_HOST");
  const user = (c.user as string) || Deno.env.get("IMAP_USERNAME");
  const pass = (c.password as string) || Deno.env.get("IMAP_PASSWORD");
  const port = Number(c.port) || Number(Deno.env.get("IMAP_PORT") ?? "0") || 993;
  if (!host || !user || !pass) return null;
  return { host, user, pass, port };
}

// Minimal IMAP client — Deno-native TLS, no Node.js compat layer.
// Using Deno.connectTls ensures async DNS + TLS so setTimeout always fires.
class DenoImap {
  private enc = new TextEncoder();
  private dec = new TextDecoder("binary");
  private buf = new Uint8Array(0);
  private tagN = 0;

  constructor(private conn: Deno.TlsConn) {}

  private async fill(): Promise<void> {
    const tmp = new Uint8Array(65536);
    const n = await this.conn.read(tmp);
    if (n === null) throw new Error("IMAP: connexion fermée par le serveur");
    const merged = new Uint8Array(this.buf.length + n);
    merged.set(this.buf);
    merged.set(tmp.slice(0, n), this.buf.length);
    this.buf = merged;
  }

  async readLine(): Promise<string> {
    while (true) {
      const i = this.buf.indexOf(10);
      if (i !== -1) {
        const end = (i > 0 && this.buf[i - 1] === 13) ? i - 1 : i;
        const line = this.dec.decode(this.buf.slice(0, end));
        this.buf = this.buf.slice(i + 1);
        return line;
      }
      await this.fill();
    }
  }

  async readBytes(n: number): Promise<Uint8Array> {
    while (this.buf.length < n) await this.fill();
    const out = this.buf.slice(0, n);
    this.buf = this.buf.slice(n);
    return out;
  }

  private async write(s: string): Promise<void> {
    await this.conn.write(this.enc.encode(s + "\r\n"));
  }

  private nextTag(): string { return `T${++this.tagN}`; }

  async cmd(command: string): Promise<{ lines: string[]; ok: boolean }> {
    const t = this.nextTag();
    await this.write(`${t} ${command}`);
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine();
      if (line.startsWith(`${t} `)) return { lines, ok: line.includes(" OK ") || line.endsWith(" OK") };
      lines.push(line);
    }
  }

  // UID FETCH multiple messages, returns Map<uid → raw bytes>
  async fetchRaw(uids: number[]): Promise<Map<number, Uint8Array>> {
    const t = this.nextTag();
    await this.write(`${t} UID FETCH ${uids.join(",")} (UID RFC822)`);
    const result = new Map<number, Uint8Array>();
    let pendingUid = 0;
    while (true) {
      const line = await this.readLine();
      if (line.startsWith(`${t} `)) break;
      const uidMatch = line.match(/\bUID (\d+)\b/i);
      if (uidMatch) pendingUid = parseInt(uidMatch[1], 10);
      const litMatch = line.match(/\{(\d+)\}$/);
      if (litMatch) {
        const bytes = await this.readBytes(parseInt(litMatch[1], 10));
        if (pendingUid > 0) { result.set(pendingUid, bytes); pendingUid = 0; }
      }
    }
    return result;
  }

  async close(): Promise<void> {
    try { await this.write(`${this.nextTag()} LOGOUT`); } catch { /**/ }
    try { this.conn.close(); } catch { /**/ }
  }
}

function imapStr(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
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

    // Connexion TLS native Deno — DNS et TLS sont entièrement async, les timeouts fonctionnent.
    const conn = await Promise.race([
      Deno.connectTls({ hostname: cfg.host, port: cfg.port }),
      new Promise<never>((_, rej) =>
        setTimeout(
          () => rej(new Error(`Serveur IMAP inaccessible ${cfg.host}:${cfg.port} — délai 12 s dépassé`)),
          12000,
        )
      ),
    ]);

    const imap = new DenoImap(conn);
    try {
      await imap.readLine(); // greeting

      const loginRes = await imap.cmd(`LOGIN ${imapStr(cfg.user)} ${imapStr(cfg.pass)}`);
      if (!loginRes.ok) throw new Error("Authentification IMAP échouée — vérifiez l'identifiant et le mot de passe");

      const selRes = await imap.cmd("SELECT INBOX");
      if (!selRes.ok) throw new Error("Impossible d'ouvrir INBOX");

      const searchRes = await imap.cmd("UID SEARCH UNSEEN");
      const searchLine = searchRes.lines.find((l) => /^\* SEARCH/i.test(l)) ?? "";
      const uids = searchLine.replace(/^\* SEARCH\s*/i, "").split(/\s+/).map(Number).filter(Boolean);
      const recent = uids.slice(-30);

      let imported = 0;
      if (recent.length > 0) {
        const rawMap = await imap.fetchRaw(recent);
        for (const [uid, raw] of rawMap) {
          const parsed = await simpleParser(Buffer.from(raw));
          const messageId = parsed.messageId ?? `imap-${uid}`;
          const from = parsed.from?.text ?? null;
          const fromAddr = parsed.from?.value?.[0]?.address ?? null;
          const to = (parsed.to?.value ?? []).map((a: { address?: string }) => a.address).filter(Boolean);

          let contactId: string | null = null;
          let ownerId: string | null = null;
          if (fromAddr) {
            const { data: contact } = await sb.from("contacts").select("id, owner_id")
              .ilike("email", fromAddr).limit(1).maybeSingle();
            if (contact) { contactId = contact.id; ownerId = contact.owner_id ?? null; }
          }

          const { error } = await sb.from("emails").insert({
            direction: "entrant", message_id: messageId, expediteur: from,
            destinataires: to, contact_id: contactId, owner_id: ownerId,
            sujet: parsed.subject ?? "(sans objet)", corps: parsed.text ?? parsed.html ?? "",
            statut: "recu", lu: false,
            sent_at: parsed.date ? new Date(parsed.date).toISOString() : null,
          });

          if (!error) {
            imported++;
            await imap.cmd(`UID STORE ${uid} +FLAGS (\\Seen)`);
          } else if ((error as { code?: string }).code !== "23505") {
            console.error("insert error", error.message);
          }
        }
      }

      await imap.close();
      return json({ ok: true, imported });
    } catch (err) {
      try { await imap.close(); } catch { /**/ }
      throw err;
    }
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
