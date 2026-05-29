import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.15";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailPayload {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { to, subject, html, text } = (await req.json()) as EmailPayload;
    const recipients = Array.isArray(to) ? to : [to];

    if (!recipients.length || !subject) {
      return json({ error: 'Champs "to" et "subject" requis' }, 400);
    }

    const host = Deno.env.get("SMTP_HOST");
    const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
    const user = Deno.env.get("SMTP_USERNAME");
    const pass = Deno.env.get("SMTP_PASSWORD");
    const from = Deno.env.get("SMTP_FROM") ?? user;

    if (!host || !user || !pass || !from) {
      return json({ error: "Configuration SMTP incomplète (secrets manquants)" }, 500);
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from,
      to: recipients.join(", "),
      subject,
      text: text ?? "",
      html: html ?? text ?? "",
    });

    return json({ ok: true, messageId: info.messageId, sent: recipients.length });
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
