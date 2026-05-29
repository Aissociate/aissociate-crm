/*
  # 13 — Import automatique des Google Sheets (pg_cron + pg_net)

  Planifie un appel a l'Edge Function `import-sheets` toutes les heures
  (candidatures + prospects). Memes prerequis Vault que la releve IMAP :
  secrets `project_url` et `service_role_key`.

  Bloc defensif : n'echoue jamais si pg_cron / pg_net / Vault sont absents.
*/

do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  perform cron.unschedule(jobid) from cron.job where jobname = 'sheets-import';

  perform cron.schedule(
    'sheets-import',
    '0 * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/import-sheets',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' ||
            (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := '{"source":"all"}'::jsonb
      );
    $job$
  );

  raise notice 'Job cron "sheets-import" planifie (toutes les heures).';
exception when others then
  raise notice 'Import auto cron non configure (%). Ajoutez les secrets Vault project_url et service_role_key, deployez import-sheets, puis rejouez.', sqlerrm;
end $$;
