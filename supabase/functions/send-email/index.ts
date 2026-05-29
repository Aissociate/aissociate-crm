// Supabase Edge Function — envoi d'e-mails SMTP (CDC 4.7)
// Déploiement :  supabase functions deploy send-email
// Secrets requis (supabase secrets set ...) :
//   SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM
//
// Appel côté app : supabase.functions.invoke('send-email', { body: { to, subject, html } })

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EmailPayload {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, html, text } = (await req.json()) as EmailPayload;
    const recipients = Array.isArray(to) ? to : [to];

    if (!recipients.length || !subject) {
      return json({ error: 'Champs "to" et "subject" requis' }, 400);
    }

    const host = Deno.env.get('SMTP_HOST');
    const port = Number(Deno.env.get('SMTP_PORT') ?? '587');
    const username = Deno.env.get('SMTP_USERNAME');
    const password = Deno.env.get('SMTP_PASSWORD');
    const from = Deno.env.get('SMTP_FROM') ?? username;

    if (!host || !username || !password || !from) {
      return json({ error: 'Configuration SMTP incomplète (secrets manquants)' }, 500);
    }

    const client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        tls: port === 465,
        auth: { username, password },
      },
    });

    await client.send({
      from,
      to: recipients,
      subject,
      content: text ?? 'Voir le contenu HTML.',
      html: html ?? text ?? '',
    });
    await client.close();

    return json({ ok: true, sent: recipients.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
