/*
  # Planification des nouvelles Edge Functions (pg_cron + pg_net + Vault)

  - notifications-cron : tous les jours à 03:00 UTC (07:00 à La Réunion) —
    notifications in-app + e-mail de synthèse quotidienne.
  - rgpd-purge : le dimanche à 02:00 UTC — purge candidats non retenus,
    audio des conversations, page_views anciens (délais dans parametres.rgpd).
  - qonto-sync : tous les jours à 03:30 UTC — rapprochement bancaire des
    factures (ne fait rien tant que les secrets QONTO_* ne sont pas posés).

  Prérequis identiques aux crons existants : secrets Vault `project_url` et
  `service_role_key`.
*/

-- Délais de conservation RGPD par défaut (modifiables en base).
insert into public.parametres (cle, valeur)
values ('rgpd', '{"mois_candidats": 24, "mois_audio": 12, "mois_page_views": 24}'::jsonb)
on conflict (cle) do nothing;

do $$
declare
  jobs text[][] := array[
    array['notifications-cron', '0 3 * * *'],
    array['rgpd-purge',         '0 2 * * 0'],
    array['qonto-sync',         '30 3 * * *']
  ];
  j text[];
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  foreach j slice 1 in array jobs loop
    perform cron.unschedule(jobid) from cron.job where jobname = j[1];
    perform cron.schedule(
      j[1],
      j[2],
      format($job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
                 || '/functions/v1/%s',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' ||
              (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 120000
        );
      $job$, j[1])
    );
  end loop;

  raise notice 'Jobs cron notifications-cron / rgpd-purge / qonto-sync programmés.';
exception when others then
  raise notice 'Crons non configurés (%). Secrets Vault requis + fonctions déployées.', sqlerrm;
end $$;
