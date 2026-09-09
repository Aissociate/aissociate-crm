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

// ── Avis de non-remise (bounce / DSN) ───────────────────────────────────────
// Ces messages viennent de MAILER-DAEMON, jamais d'un contact connu : ils
// étaient donc écartés par le filtre des expéditeurs connus et l'utilisateur ne
// voyait jamais qu'un envoi avait échoué (ticket Benjamin « messages d'erreur »).
const BOUNCE_FROM = /^(mailer-daemon|postmaster|no-?reply|bounce)/i;
const BOUNCE_SUBJECT =
  /(undelivered|undeliverable|delivery (status notification|has failed|failure)|returned mail|mail delivery (failed|system)|failure notice|non[- ]remis|échec de (la )?remise|message non distribué)/i;

type BounceInfo = { recipient: string | null; originalId: string | null; diagnostic: string | null };

/** Reconnaît un avis de non-remise à ses en-têtes / objet / type MIME. */
function isBounce(headersRaw: string, subject: string, fromAddr: string | null): boolean {
  if (/content-type:\s*multipart\/report[^\n]*report-type=\s*"?delivery-status/i.test(headersRaw)) return true;
  if (fromAddr && BOUNCE_FROM.test(fromAddr)) return true;
  return BOUNCE_SUBJECT.test(subject ?? "");
}

/** Extrait du corps DSN l'adresse en échec, le motif et l'id du message d'origine. */
function bounceInfo(raw: string): BounceInfo {
  const recipient =
    raw.match(/^Final-Recipient:\s*(?:rfc822;)?\s*<?([^\s<>]+@[^\s<>]+)>?/im)?.[1] ??
    raw.match(/^Original-Recipient:\s*(?:rfc822;)?\s*<?([^\s<>]+@[^\s<>]+)>?/im)?.[1] ??
    raw.match(/^X-Failed-Recipients:\s*<?([^\s<>,]+@[^\s<>,]+)>?/im)?.[1] ??
    null;
  const diagnostic = raw.match(/^Diagnostic-Code:\s*(?:[^;]*;)?\s*(.+)$/im)?.[1]?.trim().slice(0, 300) ?? null;
  // L'en-tête du message d'origine est réinclus dans la partie message/rfc822 :
  // le dernier Message-ID rencontré est donc celui de l'envoi qui a échoué.
  const ids = [...raw.matchAll(/^Message-ID:\s*<([^>]+)>/gim)].map((m) => m[1]);
  return { recipient: recipient?.toLowerCase() ?? null, originalId: ids.length > 1 ? ids[ids.length - 1] : null, diagnostic };
}

function imapStr(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

// Format date as DD-Mon-YYYY for IMAP SINCE command
function imapDate(d: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  // Jour sur deux chiffres : c'est la forme exigée par la RFC 3501, et certains
  // serveurs rejettent « 2-Jun-2026 » là où ils acceptent « 02-Jun-2026 ».
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

// ── Actions automatiques sur mail entrant ────────────────────────────────────
// Ticket Benjamin « création automatique d'actions dans contacts » : chaque mail
// entrant rattaché à un contact produit (1) une action RÉALISÉE horodatée, dont
// la description porte un résumé du message, et (2) une relance ASAP à traiter.
const pad2 = (n: number) => String(n).padStart(2, "0");
const ymdLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Âge au-delà duquel un mail entrant n'engendre plus d'action ni de relance.
 * Sert de garde-fou au rattrapage : reprendre un arriéré de plusieurs mois ne
 * doit pas remplir « Actions à faire » de relances portant sur des échanges
 * déjà clos. Trois jours couvrent un week-end prolongé.
 */
const ACTION_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

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
    // Les adresses complémentaires comptent au même titre que l'adresse principale :
    // une organisation écrit depuis sa comptabilité ou son service formation, et le
    // message doit se rattacher au même contact (ticket Benjamin « ajouts de champs
    // mails supplémentaires identifiables »).
    // Chargement PAGINÉ : PostgREST plafonne une réponse à 1 000 lignes. Avec
    // près de 1 300 contacts, le dernier quart n'entrait pas dans la table de
    // correspondance et leurs messages restaient non rattachés — sans que rien
    // ne le signale, puisqu'une réponse tronquée est une réponse valide.
    const contactRows: Record<string, unknown>[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb.from("contacts")
        .select("id, owner_id, responsable_id, email, email2, email3")
        .order("id", { ascending: true })
        .range(de, de + 999);
      if (error) { console.error("chargement contacts", error.message); break; }
      contactRows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const contactMap = new Map<string, { id: string; owner_id: string | null }>();
    const cibleDe = (c: Record<string, unknown>) =>
      ({ id: c.id as string, owner_id: (c.responsable_id ?? c.owner_id ?? null) as string | null });
    // Deux passes : les adresses principales d'abord, pour qu'une adresse partagée
    // (la comptabilité d'un groupe, par exemple) déclarée en secondaire chez un
    // contact n'écrase jamais l'adresse principale d'un autre.
    for (const c of (contactRows ?? [])) {
      const adresse = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
      if (adresse) contactMap.set(adresse, cibleDe(c));
    }
    for (const c of (contactRows ?? [])) {
      for (const champ of [c.email2, c.email3]) {
        const adresse = typeof champ === "string" ? champ.trim().toLowerCase() : "";
        if (adresse && !contactMap.has(adresse)) contactMap.set(adresse, cibleDe(c));
      }
    }
    const knownExtra = new Set<string>();
    const { data: formateurRows } = await sb.from("formateurs").select("email").not("email", "is", null);
    for (const f of (formateurRows ?? [])) if (f.email) knownExtra.add((f.email as string).toLowerCase());
    const { data: candidatRows } = await sb.from("candidats").select("email").not("email", "is", null);
    for (const k of (candidatRows ?? [])) if (k.email) knownExtra.add((k.email as string).toLowerCase());

    // Curseur de progression : dernier UID traité dans INBOX, avec l'UIDVALIDITY
    // de la boîte au moment où il a été relevé (un changement d'UIDVALIDITY
    // signifie que le serveur a renuméroté les messages : le curseur ne veut
    // alors plus rien dire et il faut repartir de la date de coupure).
    const { data: curseurRow } = await sb.from("parametres").select("valeur").eq("cle", "imap_cursor").maybeSingle();
    const curseur = (curseurRow?.valeur ?? {}) as { uidvalidity?: number; last_uid?: number };

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

      // EXAMINE et non SELECT : la boîte est ouverte en lecture seule. La
      // progression est tenue par le curseur d'UID, plus par le drapeau \Seen,
      // et le CRM n'a donc aucune raison de modifier l'état des messages.
      const selRes = await imap.cmd("EXAMINE INBOX");
      if (!selRes.ok) throw new Error("Impossible d'ouvrir INBOX");
      const uidvalidity = Number(
        selRes.lines.map((l) => l.match(/\[UIDVALIDITY (\d+)\]/i)?.[1]).find(Boolean) ?? 0,
      );

      // Sélection des messages à traiter.
      //
      // La recherche portait sur `UNSEEN SINCE <date>` : tout message lu ailleurs
      // (webmail, téléphone, client de messagerie) avant le passage du cron
      // sortait définitivement du champ, sans aucun rattrapage — c'est ce qui
      // faisait « disparaître » des mails de la messagerie. La progression est
      // désormais tenue par un curseur d'UID, insensible à qui lit la boîte :
      // seuls les messages arrivés après le dernier traité sont repris.
      const reprise = uidvalidity > 0 && curseur.uidvalidity === uidvalidity && Number(curseur.last_uid) > 0;
      const depuisUid = reprise ? Number(curseur.last_uid) + 1 : 0;
      const critere = reprise ? `UID ${depuisUid}:*` : `SINCE ${sinceStr}`;
      const searchRes = await imap.cmd(`UID SEARCH ${critere}`);
      const searchLine = searchRes.lines.find((l) => /^\* SEARCH/i.test(l)) ?? "";
      const uids = searchLine.replace(/^\* SEARCH\s*/i, "").split(/\s+/).map(Number)
        .filter((u) => Number.isFinite(u) && u > 0)
        // `UID x:*` renvoie toujours au moins le dernier message de la boîte, même
        // quand son UID est inférieur à x : ce filtre évite de le retraiter sans fin.
        .filter((u) => u >= depuisUid)
        .sort((a, b) => a - b);
      // Les plus ANCIENS d'abord : le curseur avance lot par lot, et un rattrapage
      // se déroule dans l'ordre chronologique au fil des passages du cron.
      const recent = uids.slice(0, 50);

      let imported = 0;
      let skipped = 0;
      let sansContact = 0;
      let dernierUid = reprise ? Number(curseur.last_uid) : 0;
      // Le curseur ne doit jamais franchir un message que l'on n'a pas su
      // enregistrer : il serait perdu pour de bon. On retient le plus petit UID
      // en échec et le curseur s'arrête juste avant.
      let premierEchec = Number.POSITIVE_INFINITY;

      if (recent.length > 0) {
        const rawMap = await imap.fetchRaw(recent);
        for (const [uid, raw] of rawMap) {
          const parsed = await simpleParser(Buffer.from(raw));
          const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase() ?? null;
          const rawText = new TextDecoder("utf-8", { fatal: false }).decode(raw);

          // Avis de non-remise : traité avant le filtre des expéditeurs connus,
          // puisqu'il arrive toujours de MAILER-DAEMON.
          if (isBounce(rawText.split(/\r?\n\r?\n/)[0] ?? "", parsed.subject ?? "", fromAddr)) {
            const info = bounceInfo(rawText);
            const traite = await handleBounce(sb, info, parsed, parsed.messageId ?? `imap-${uid}`);
            if (traite) imported++; else skipped++;
            dernierUid = Math.max(dernierUid, uid);
            continue;
          }

          // Expéditeur inconnu : le message est ingéré sans contact rattaché plutôt
          // que jeté. C'est ce qui alimente « Individu non référencé » au tableau de
          // bord (ticket Benjamin du 14/08), et la RLS réserve ces messages aux
          // administrateurs tant qu'ils ne sont rattachés à personne.
          const contact = fromAddr ? contactMap.get(fromAddr) : undefined;
          if (!contact && !(fromAddr && knownExtra.has(fromAddr))) sansContact++;

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
            premierEchec = Math.min(premierEchec, uid);
          } else {
            const nouveau = !!rows && rows.length > 0;
            if (nouveau) imported++;
            // Journalisation dans le suivi du contact — uniquement pour un mail
            // réellement nouveau (l'upsert ignore les doublons), rattaché, et
            // RÉCENT : rattraper un arriéré de plusieurs mois créerait autant de
            // relances « ASAP » antidatées dans « Actions à faire », pour des
            // échanges déjà traités depuis longtemps.
            const recuLe = parsed.date ? new Date(parsed.date) : new Date();
            const recentPourAction = Date.now() - recuLe.getTime() < ACTION_MAX_AGE_MS;
            if (nouveau && actionsEnabled && contact?.id && recentPourAction) {
              try {
                const recu = recuLe;
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
            // Le message est traité : le curseur peut passer son UID. Le drapeau
            // \Seen n'est plus posé — il appartient désormais au seul lecteur
            // humain, et le CRM ne fait plus passer pour lus des messages que
            // personne n'a ouverts.
            dernierUid = Math.max(dernierUid, uid);
          }
        }
      }

      // Curseur écrit à la fin du lot : une interruption en cours de route fait
      // simplement rejouer le lot au passage suivant, l'upsert écartant les
      // messages déjà enregistrés. Mieux vaut réimporter que perdre.
      const curseurFinal = Math.min(dernierUid, premierEchec - 1);
      if (curseurFinal > 0 && uidvalidity > 0 && curseurFinal !== Number(curseur.last_uid)) {
        await sb.from("parametres").upsert(
          { cle: "imap_cursor", valeur: { uidvalidity, last_uid: curseurFinal, maj_le: new Date().toISOString() } },
          { onConflict: "cle" },
        );
      }

      await imap.close();
      const reste = Math.max(0, uids.length - recent.length);
      await recordSync(sb, { ok: true, imported, skipped, sans_contact: sansContact, reste });
      return json({
        ok: true, imported, skipped, sans_contact: sansContact,
        mode: reprise ? "curseur" : "rattrapage", critere, trouves: uids.length, reste, last_uid: curseurFinal,
      });
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

/**
 * Enregistre un avis de non-remise et le rattache à l'envoi concerné.
 * L'adresse en échec n'est pas celle d'un contact (c'est souvent une faute de
 * frappe) : on retrouve donc le contact via l'e-mail sortant qui la visait.
 * Renvoie `true` si un nouvel avis a été enregistré.
 */
// deno-lint-ignore no-explicit-any
async function handleBounce(sb: any, info: BounceInfo, parsed: any, messageId: string): Promise<boolean> {
  type Origine = { id: string; contact_id: string | null; owner_id: string | null; dossier_id: string | null; sujet: string | null };
  const COLS = "id, contact_id, owner_id, dossier_id, sujet";
  let origine: Origine | null = null;
  if (info.originalId) {
    const { data } = await sb.from("emails").select(COLS).eq("message_id", info.originalId).maybeSingle();
    origine = (data as Origine) ?? null;
  }
  if (!origine && info.recipient) {
    const { data } = await sb.from("emails").select(COLS)
      .eq("direction", "sortant").contains("destinataires", [info.recipient])
      .order("sent_at", { ascending: false, nullsFirst: false }).limit(1);
    origine = ((data ?? [])[0] as Origine) ?? null;
  }

  const corps = [
    info.recipient ? `Adresse en échec : ${info.recipient}` : "",
    info.diagnostic ? `Motif : ${info.diagnostic}` : "",
    origine?.sujet ? `Message d'origine : « ${origine.sujet} »` : "",
    "",
    String(parsed.text ?? "").trim().slice(0, 4000),
  ].filter(Boolean).join("\n");

  const { data: rows, error } = await sb.from("emails").upsert({
    direction: "entrant",
    message_id: messageId,
    expediteur: parsed.from?.text ?? "MAILER-DAEMON",
    destinataires: (parsed.to?.value ?? []).map((a: { address?: string }) => a.address).filter(Boolean),
    contact_id: origine?.contact_id ?? null,
    dossier_id: origine?.dossier_id ?? null,
    owner_id: origine?.owner_id ?? null,
    sujet: `Non délivré : ${parsed.subject ?? "échec de remise"}`,
    corps,
    statut: "echec",
    lu: false,
    sent_at: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
  }, { onConflict: "message_id", ignoreDuplicates: true }).select("id");

  if (error) { console.error("bounce upsert", error.message); return false; }
  if (!rows || rows.length === 0) return false; // déjà importé

  // L'envoi d'origine passe en échec ; le contact garde une trace de l'incident.
  if (origine?.id) await sb.from("emails").update({ statut: "echec" }).eq("id", origine.id);
  if (origine?.contact_id) {
    const now = new Date();
    try {
      await sb.from("contact_actions").insert({
        contact_id: origine.contact_id, date_action: ymdLocal(now),
        heure_action: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
        type: "email", faite: true,
        description: `E-mail NON DÉLIVRÉ à ${info.recipient ?? "destinataire inconnu"}${info.diagnostic ? ` — ${info.diagnostic}` : ""}`,
      });
    } catch (e) { console.error("bounce action", e); }
  }
  return true;
}

// Journalise l'horodatage de la dernière synchronisation IMAP dans `parametres`
// (clé `imap_sync`), pour affichage dans la Messagerie — ticket Benjamin
// « synchronisation messagerie ». Ne doit jamais faire échouer la synchro.
// deno-lint-ignore no-explicit-any
async function recordSync(
  sb: any,
  info: { ok: boolean; imported?: number; skipped?: number; sans_contact?: number; reste?: number; error?: string },
) {
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
