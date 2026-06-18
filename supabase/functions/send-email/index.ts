// Supabase Edge Function — envoi d'e-mails SMTP (CDC 4.7)
// Config : secrets Supabase prioritaires, sinon table `parametres` (cle='smtp').
//   SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.15";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailPayload {
  to?: string | string[];
  // Copie cachée : utilisé pour les envois de masse (newsletter) afin de ne pas
  // exposer les adresses des destinataires entre eux.
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  // Pièces jointes issues de l'espace documentaire : { nom de fichier, URL publique }.
  attachments?: { filename: string; url: string }[];
}

interface SmtpConfig {
  host?: string; port?: number; user?: string; pass?: string; from?: string; secure?: boolean;
}

// Secrets Supabase d'abord, puis table parametres (cle='smtp') en repli.
// Port 465 → SSL/TLS (secure=true) ; port 587 → STARTTLS (secure=false).
async function loadSmtp(): Promise<SmtpConfig> {
  const env = {
    host: Deno.env.get("SMTP_HOST"),
    port: Number(Deno.env.get("SMTP_PORT") ?? "0") || undefined,
    user: Deno.env.get("SMTP_USERNAME"),
    pass: Deno.env.get("SMTP_PASSWORD"),
    from: Deno.env.get("SMTP_FROM"),
  };
  if (env.host && env.user && env.pass) {
    const port = env.port ?? 587;
    return { ...env, from: env.from ?? env.user, port, secure: port === 465 };
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await sb.from("parametres").select("valeur").eq("cle", "smtp").maybeSingle();
  const c = (data?.valeur ?? {}) as Record<string, unknown>;
  const port = Number(c.port) || 587;
  // secure déduit du port : 465 = SSL, tout autre = STARTTLS
  const secure = port === 465;
  return {
    host: c.host as string,
    user: c.user as string,
    pass: c.password as string,
    from: (c.from as string) ?? (c.user as string),
    port,
    secure,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { to, bcc, subject, html, text, attachments } = (await req.json()) as EmailPayload;
    const toList = (Array.isArray(to) ? to : to ? [to] : []).filter(Boolean);
    const bccList = (Array.isArray(bcc) ? bcc : bcc ? [bcc] : []).filter(Boolean);
    if ((!toList.length && !bccList.length) || !subject) {
      return json({ error: 'Champs "to" (ou "bcc") et "subject" requis' }, 400);
    }

    // Nodemailer récupère chaque pièce jointe depuis son URL (path).
    const mailAttachments = (attachments ?? [])
      .filter((a) => a?.url)
      .map((a) => ({ filename: a.filename || "piece-jointe", path: a.url }));

    const cfg = await loadSmtp();
    if (!cfg.host || !cfg.user || !cfg.pass || !cfg.from) {
      return json({ error: "Configuration SMTP incomplète (secrets Supabase ou Paramètres)" }, 500);
    }

    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port ?? 587,
      secure: cfg.secure ?? false,
      auth: { user: cfg.user, pass: cfg.pass },
    });

    // Envoi de masse en BCC : le « to » est l'expéditeur lui-même (mail valide
    // sans dévoiler la liste), les destinataires réels passent en bcc.
    const toField = (toList.length ? toList : [cfg.from!]).join(", ");
    const info = await transporter.sendMail({
      from: cfg.from,
      to: toField,
      bcc: bccList.length ? bccList.join(", ") : undefined,
      subject,
      text: text ?? "",
      html: html ?? text ?? "",
      attachments: mailAttachments,
    });

    return json({ ok: true, messageId: info.messageId, sent: toList.length + bccList.length });
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
