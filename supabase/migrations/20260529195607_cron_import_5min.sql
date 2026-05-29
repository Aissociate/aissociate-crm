/*
  # 15 — Import auto des nouveaux prospects toutes les 5 minutes

  Reprogramme le job `sheets-import` en */5 (au lieu d'1h). Les nouveaux
  prospects arrivent « non affectés » et sont relevés toutes les 5 min.
  Prérequis Vault inchangés (project_url, service_role_key) ; bloc défensif.
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

  raise notice 'Job cron "sheets-import" reprogrammé toutes les 5 minutes.';
exception when others then
  raise notice 'Cron import 5 min non configuré (%). Secrets Vault requis + import-sheets déployée.', sqlerrm;
end $$;
