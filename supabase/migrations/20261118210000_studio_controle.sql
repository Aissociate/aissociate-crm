-- Studio IA — contrôle quotidien du parcours client (supabase/functions/studio/controle.ts).
-- Un client fictif parcourt le Studio de bout en bout (questionnaire → essai → CGV → fin d'essai
-- → paiement Stripe → déblocage), puis la configuration et les services externes sont vérifiés.
-- Problème confirmé → e-mail (constat, cause probable, solution) aux adresses de
-- studio_config `controle_destinataires`. Historique : job_runs (fonction « studio-controle »).
-- Prérequis identiques aux autres crons : secret Vault `project_url`, clé studio_cron_cle.

-- État des jobs pg_cron du Studio, lu par le contrôle (service role seulement).
create or replace function public.studio_controle_crons()
returns table (jobname text, active boolean, dernier_statut text, dernier_lancement timestamptz, dernier_message text)
language sql
security definer
set search_path = public, cron
as $$
  select j.jobname::text, j.active, d.status::text, d.start_time, left(d.return_message, 300)
  from cron.job j
  left join lateral (
    select status, start_time, return_message from cron.job_run_details r
    where r.jobid = j.jobid order by r.start_time desc limit 1
  ) d on true
  where j.jobname like 'studio-%';
$$;
revoke all on function public.studio_controle_crons() from public, anon, authenticated;
grant execute on function public.studio_controle_crons() to service_role;

-- Destinataires de l'alerte (séparés par des virgules).
insert into public.studio_config (cle, valeur)
values ('controle_destinataires', 'contact@aissociate.re')
on conflict (cle) do nothing;

notify pgrst, 'reload schema';

-- Déclencheur : chaque jour à 02:00 UTC (06:00 à La Réunion).
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.unschedule(jobid) from cron.job where jobname = 'studio-controle';
  perform cron.schedule(
    'studio-controle',
    '0 2 * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/studio',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('action', 'controle_cron', 'cle', (select cle from public.studio_cron_cle where id = 1)),
        timeout_milliseconds := 10000
      );
    $job$
  );
exception when others then
  raise notice 'pg_cron indisponible : planifier studio-controle à la main (%).', sqlerrm;
end $$;
