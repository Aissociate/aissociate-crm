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

// ── Actions automatiques sur mail entrant ────────────────────────────────────
// Ticket Benjamin « création automatique d'actions dans contacts » : chaque mail
// entrant rattaché à un contact produit (1) une action RÉALISÉE horodatée, dont
// la description porte un résumé du message, et (2) une relance ASAP à traiter.
const pad2 = (n: number) => String(n).padStart(2, "0");
const ymdLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Première heure ouvrable à venir : 9 h le prochain jour ouvré (lun-ven). */
function prochaineHeureOuvrable(from = new Date()): { date: string; heure: string } {
  const d = new Date(from);
  const ouvre = (x: Date) => x.getDay() >= 1 && x.getDay() <= 5;
  if (!ouvre(d) || d.getHours() >= 9) {
    do { d.setDate(d.getDate() + 1); } while (!ouvre(d));
  }
  return { date: ymdLocal(d), heure: "09:00" };
}

/**
 * Résumé court du mail par l'IA. Jamais bloquant : en cas d'absence de clé,
 * d'erreur réseau ou de dépassement du délai, on retombe sur un extrait brut du
 * corps du message — l'action est créée dans tous les cas.
 */
async function resumeMail(apiKey: string, model: string, sujet: string, corps: string): Promise<string> {
  const extrait = corps.replace(/\s+/g, " ").trim().slice(0, 4000);
  const repli = extrait.slice(0, 180) + (extrait.length > 180 ? "…" : "");
  if (!apiKey || !extrait) return repli;
  try {
    const resp = await Promise.race([
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json",
          "HTTP-Referer": "https://aissociate.crm", "X-Title": "CRM Formation AIssociate",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Tu résumes des e-mails professionnels en français pour un CRM de formation. Réponds par UNE seule phrase de 25 mots maximum, factuelle, sans formule de politesse ni préambule." },
            { role: "user", content: `Objet : ${sujet}\n\n${extrait}` },
          ],
          temperature: 0.2, max_tokens: 120,
        }),
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000)),
    ]);
    if (!resp.ok) return repli;
    const data = await resp.json();
    const txt = String(data?.choices?.[0]?.message?.content ?? "").replace(/\s+/g, " ").trim();
    return txt || repli;
  } catch (e) {
    console.error("resumeMail", e);
    return repli;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const sb = createClient(SUPABASE_URL, SERVICE);

    // — Contrôle d'accès : cron interne (service_role) ou utilisateur connecté.
    // La lecture des emails importés reste protégée par la RLS de la table.
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    if (bearer !== SERVICE) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: ud } = await userClient.auth.getUser();
      if (!ud.user) return json({ ok: false, error: "Non authentifié" }, 401);
    }

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

    // Réglages des actions automatiques (Paramètres → IA). Activées par défaut ;
    // `resume_ia: false` conserve les actions mais se passe de l'appel payant.
    const { data: mailActRow } = await sb.from("parametres").select("valeur").eq("cle", "mail_actions").maybeSingle();
    const mailAct = (mailActRow?.valeur ?? {}) as { enabled?: boolean; resume_ia?: boolean; max_par_passage?: number };
    const actionsEnabled = mailAct.enabled !== false;
    const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
    const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
    const aiKey = mailAct.resume_ia === false ? "" : (Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key || "").trim();
    const aiModel = (ai.model_resume || ai.model || "anthropic/claude-opus-4.8").replace(/:online$/, "");
    // Garde-fou de coût et de temps : nombre de résumés IA par passage du cron.
    let resumesRestants = Number(mailAct.max_par_passage ?? 10);

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
            const nouveau = !!rows && rows.length > 0;
            if (nouveau) imported++;
            // Journalisation dans le suivi du contact — uniquement pour un mail
            // réellement nouveau (l'upsert ignore les doublons) et rattaché.
            if (nouveau && actionsEnabled && contact?.id) {
              try {
                const recu = parsed.date ? new Date(parsed.date) : new Date();
                const sujet = parsed.subject ?? "(sans objet)";
                const corps = String(parsed.text ?? parsed.html ?? "");
                const resume = resumesRestants > 0
                  ? await resumeMail(aiKey, aiModel, sujet, corps)
                  : corps.replace(/\s+/g, " ").trim().slice(0, 180);
                if (resumesRestants > 0) resumesRestants--;
                const suite = prochaineHeureOuvrable();
                await sb.from("contact_actions").insert([
                  {
                    contact_id: contact.id, date_action: ymdLocal(recu),
                    heure_action: `${pad2(recu.getHours())}:${pad2(recu.getMinutes())}`,
                    type: "email", faite: true,
                    description: `E-mail reçu : ${sujet}${resume ? ` — ${resume}` : ""}`,
                  },
                  {
                    contact_id: contact.id, date_action: suite.date, heure_action: suite.heure,
                    type: "relance", faite: false,
                    description: `Relance ASAP — répondre à « ${sujet} »`,
                  },
                ]);
              } catch (e) {
                console.error("actions auto", e); // ne doit jamais bloquer l'import
              }
            }
            await imap.cmd(`UID STORE ${uid} +FLAGS (\\Seen)`);
          }
        }
      }

      await imap.close();
      await recordSync(sb, { ok: true, imported, skipped });
      return json({ ok: true, imported, skipped, since: sinceStr, total_unseen: uids.length });
    } catch (err) {
      try { await imap.close(); } catch { /**/ }
      throw err;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await recordSync(sb, { ok: false, error: message });
    } catch { /**/ }
    return json({ ok: false, error: message });
  }
});

// Journalise l'horodatage de la dernière synchronisation IMAP dans `parametres`
// (clé `imap_sync`), pour affichage dans la Messagerie — ticket Benjamin
// « synchronisation messagerie ». Ne doit jamais faire échouer la synchro.
// deno-lint-ignore no-explicit-any
async function recordSync(sb: any, info: { ok: boolean; imported?: number; skipped?: number; error?: string }) {
  try {
    await sb.from("parametres").upsert(
      { cle: "imap_sync", valeur: { last_at: new Date().toISOString(), ...info } },
      { onConflict: "cle" },
    );
  } catch (e) {
    console.error("recordSync", e);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
