/*
  # 11 — Releve IMAP automatique (pg_cron + pg_net)

  Planifie un appel a l'Edge Function `fetch-emails` toutes les 15 minutes.

  Prerequis (a creer dans Supabase -> Project Settings -> Vault) :
    - secret `project_url`       = https://<ref>.supabase.co
    - secret `service_role_key`  = cle service_role du projet

  Tout est encapsule dans un bloc defensif : si pg_cron / pg_net / Vault ne sont
  pas disponibles, la migration n'echoue pas (simple NOTICE). Rejouable.
*/

do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  perform cron.unschedule(jobid) from cron.job where jobname = 'imap-sync';

  perform cron.schedule(
    'imap-sync',
    '*/15 * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/fetch-emails',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' ||
            (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := '{}'::jsonb
      );
    $job$
  );

  raise notice 'Job cron "imap-sync" planifie (toutes les 15 min).';
exception when others then
  raise notice 'Releve IMAP cron non configuree (%). Ajoutez les secrets Vault project_url et service_role_key, deployez fetch-emails, puis rejouez cette migration.', sqlerrm;
end $$;
