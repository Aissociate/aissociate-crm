/*
  Reprogramme le job sheets-import toutes les 5 minutes.
*/

do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  perform cron.unschedule(jobid) from cron.job where jobname = 'sheets-import';

  perform cron.schedule(
    'sheets-import',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/import-sheets',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' ||
            (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := '{"source":"prospects"}'::jsonb
      );
    $job$
  );

  raise notice 'Job cron sheets-import reprogramme toutes les 5 minutes.';
exception when others then
  raise notice 'Cron import 5 min non configure (%). Secrets Vault requis + import-sheets deployee.', sqlerrm;
end $$;
