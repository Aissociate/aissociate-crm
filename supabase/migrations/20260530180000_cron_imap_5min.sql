/*
  # 23 — Relève IMAP automatique toutes les 5 minutes

  Reprogramme le job `imap-sync` (appel de l'Edge Function fetch-emails) en
  */5 (au lieu de 15 min). Prérequis Vault : project_url + service_role_key.
  Bloc défensif : n'échoue jamais si pg_cron / pg_net / Vault sont absents.
*/

do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  perform cron.unschedule(jobid) from cron.job where jobname = 'imap-sync';

  perform cron.schedule(
    'imap-sync',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/fetch-emails',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' ||
            (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 90000
      );
    $job$
  );

  raise notice 'Job cron "imap-sync" reprogrammé toutes les 5 minutes.';
exception when others then
  raise notice 'Cron IMAP 5 min non configuré (%). Secrets Vault requis + fetch-emails déployée.', sqlerrm;
end $$;
