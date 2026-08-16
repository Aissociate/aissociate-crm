/*
  # 42 — Qualiopi : envoi automatique des questionnaires (cron quotidien)

  Paramètre `qualiopi_auto` : { enabled, depuis, site_url }.
   - enabled  : interrupteur général (mettre false pour tout couper).
   - depuis    : date plancher — seules les sessions dont date_debut >= depuis
                 sont concernées (protège les sessions passées d'un envoi rétro).
   - site_url : base des liens tokenisés (…/q/<token>).

  Le cron appelle l'Edge Function `qualiopi-cron` chaque jour à 07:00 UTC.
  Fenêtres : positionnement ~J-3 ; à chaud dès la fin ; à froid J+90 ; relance J+7.
*/

-- Configuration (créée une seule fois ; ne pas écraser les réglages ultérieurs).
-- enabled=FALSE par défaut : l'automatisation d'envoi est installée mais NE
-- s'exécute PAS tant que vous ne passez pas enabled=true (envoi d'e-mails à de
-- vrais apprenants — activation manuelle volontaire).
insert into public.parametres (cle, valeur)
select 'qualiopi_auto',
       jsonb_build_object('enabled', false, 'depuis', '2026-07-04', 'site_url', 'https://aissociate.re')
where not exists (select 1 from public.parametres where cle = 'qualiopi_auto');

-- Planification quotidienne (nécessite les secrets Vault project_url + service_role_key,
-- déjà utilisés par les autres crons de l'app).
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  perform cron.unschedule(jobid) from cron.job where jobname = 'qualiopi-auto-envoi';

  perform cron.schedule(
    'qualiopi-auto-envoi',
    '0 7 * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/qualiopi-cron',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' ||
            (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $job$
  );

  raise notice 'Cron "qualiopi-auto-envoi" programmé chaque jour à 07:00 UTC.';
exception when others then
  raise notice 'Cron Qualiopi non configuré (%). Secrets Vault requis + qualiopi-cron déployée.', sqlerrm;
end $$;
