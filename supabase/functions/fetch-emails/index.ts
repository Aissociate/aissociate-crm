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
class DenoImap {
  private enc = new TextEncoder();
  private dec = new TextDecoder("latin1");
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

// Format date as DD-Mon-YYYY for IMAP SINCE command
function imapDate(d: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
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
      return json({ ok: false, error: "Configuration IMAP incomplète (Paramètres → Serveur IMAP)" });
    }

    // Expéditeurs connus : contacts (avec conseiller affecté), formateurs, candidats.
    const { data: contactRows } = await sb.from("contacts").select("id, owner_id, responsable_id, email").not("email", "is", null);
    const contactMap = new Map<string, { id: string; owner_id: string | null }>();
    for (const c of (contactRows ?? [])) {
      if (c.email) contactMap.set((c.email as string).toLowerCase(), { id: c.id as string, owner_id: (c.responsable_id ?? c.owner_id ?? null) as string | null });
    }
    const knownExtra = new Set<string>();
    const { data: formateurRows } = await sb.from("formateurs").select("email").not("email", "is", null);
    for (const f of (formateurRows ?? [])) if (f.email) knownExtra.add((f.email as string).toLowerCase());
    const { data: candidatRows } = await sb.from("candidats").select("email").not("email", "is", null);
    for (const k of (candidatRows ?? [])) if (k.email) knownExtra.add((k.email as string).toLowerCase());

    // Date de coupure : paramètre `email_sync_since` prioritaire (réglé au flush),
    // sinon repli sur le dernier e-mail connu (- 1 jour) ou aujourd'hui.
    const { data: sinceParam } = await sb.from("parametres").select("valeur").eq("cle", "email_sync_since").maybeSingle();
    const sinceCfg = (sinceParam?.valeur as { date?: string } | null)?.date;
    let sinceDate: Date;
    if (sinceCfg) {
      sinceDate = new Date(`${sinceCfg}T00:00:00`);
    } else {
      const { data: lastRow } = await sb.from("emails").select("sent_at").order("sent_at", { ascending: false }).limit(1).maybeSingle();
      sinceDate = lastRow?.sent_at ? new Date(lastRow.sent_at) : new Date();
      sinceDate.setDate(sinceDate.getDate() - 1); // marge même-jour
    }
    const sinceStr = imapDate(sinceDate);

    // TLS connection with timeout
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

      // Search unseen messages since the cutoff date
      const searchRes = await imap.cmd(`UID SEARCH UNSEEN SINCE ${sinceStr}`);
      const searchLine = searchRes.lines.find((l) => /^\* SEARCH/i.test(l)) ?? "";
      const uids = searchLine.replace(/^\* SEARCH\s*/i, "").split(/\s+/).map(Number).filter(Boolean);
      const recent = uids.slice(-50);

      let imported = 0;
      let skipped = 0;

      if (recent.length > 0) {
        const rawMap = await imap.fetchRaw(recent);
        for (const [uid, raw] of rawMap) {
          const parsed = await simpleParser(Buffer.from(raw));
          const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase() ?? null;

          // On n'ingère que les expéditeurs connus (contact, formateur ou candidat).
          const contact = fromAddr ? contactMap.get(fromAddr) : undefined;
          const known = !!contact || (fromAddr ? knownExtra.has(fromAddr) : false);
          if (!known) {
            skipped++;
            continue;
          }

          const messageId = parsed.messageId ?? `imap-${uid}`;
          const from = parsed.from?.text ?? null;
          const to = (parsed.to?.value ?? []).map((a: { address?: string }) => a.address).filter(Boolean);

          const { error, data: rows } = await sb.from("emails").upsert(
            {
              direction: "entrant",
              message_id: messageId,
              expediteur: from,
              destinataires: to,
              contact_id: contact?.id ?? null,
              owner_id: contact?.owner_id ?? null,
              sujet: parsed.subject ?? "(sans objet)",
              corps: parsed.text ?? parsed.html ?? "",
              statut: "recu",
              lu: false,
              sent_at: parsed.date ? new Date(parsed.date).toISOString() : null,
            },
            { onConflict: "message_id", ignoreDuplicates: true },
          ).select("id");

          if (error) {
            console.error("upsert error", error.message);
          } else {
            if (rows && rows.length > 0) imported++;
            await imap.cmd(`UID STORE ${uid} +FLAGS (\\Seen)`);
          }
        }
      }

      await imap.close();
      return json({ ok: true, imported, skipped, since: sinceStr, total_unseen: uids.length });
    } catch (err) {
      try { await imap.close(); } catch { /**/ }
      throw err;
    }
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
