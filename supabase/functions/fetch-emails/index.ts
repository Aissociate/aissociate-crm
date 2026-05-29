// Supabase Edge Function — réception d'e-mails IMAP (CDC 4.7 v2)
// Déploiement :  supabase functions deploy fetch-emails
// Secrets requis :
//   IMAP_HOST, IMAP_PORT, IMAP_USERNAME, IMAP_PASSWORD
// (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.)
//
// Appel : supabase.functions.invoke('fetch-emails')   — ou via cron pg_cron.
// Récupère les messages non lus de la boîte INBOX et les insère dans `emails`
// (direction = 'entrant'), en dédoublonnant sur message_id.

import { ImapFlow } from 'npm:imapflow@1.0.171';
import { simpleParser } from 'npm:mailparser@3.7.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const host = Deno.env.get('IMAP_HOST');
    const port = Number(Deno.env.get('IMAP_PORT') ?? '993');
    const user = Deno.env.get('IMAP_USERNAME');
    const pass = Deno.env.get('IMAP_PASSWORD');
    if (!host || !user || !pass) {
      return json({ error: 'Configuration IMAP incomplète (secrets manquants)' }, 500);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const client = new ImapFlow({
      host, port, secure: port === 993,
      auth: { user, pass },
      logger: false,
    });
    await client.connect();

    let imported = 0;
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Messages non lus uniquement
      for await (const msg of client.fetch({ seen: false }, { envelope: true, source: true })) {
        const parsed = await simpleParser(msg.source as Uint8Array);
        const messageId = parsed.messageId ?? `imap-${msg.uid}`;
        const from = parsed.from?.text ?? msg.envelope?.from?.[0]?.address ?? null;
        const to = (parsed.to?.value ?? []).map((a: { address?: string }) => a.address).filter(Boolean);

        const { error } = await supabase.from('emails').insert({
          direction: 'entrant',
          message_id: messageId,
          expediteur: from,
          destinataires: to,
          sujet: parsed.subject ?? '(sans objet)',
          corps: parsed.text ?? parsed.html ?? '',
          statut: 'recu',
          lu: false,
          sent_at: parsed.date ? new Date(parsed.date).toISOString() : null,
        });
        // 23505 = doublon message_id → on ignore silencieusement
        if (!error) imported++;
        else if (error.code !== '23505') console.error('insert error', error.message);

        // Marque le message comme lu côté serveur
        await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
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
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
