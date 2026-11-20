-- Tâches planifiées, reprises de la production Supabase (cron.job au 18/11/2026).
-- ⚠ À exécuter UNIQUEMENT à la bascule, une fois Supabase arrêté côté tâches :
--   lancées en parallèle des deux côtés, elles enverraient e-mails, newsletters
--   et publications en double. Horaires en UTC, comme chez Supabase.
--   psql -v api_url='https://api.aissociate.re' -v service_key='<clé service_role>' -f 30-cron.sql
\set ON_ERROR_STOP on

-- Secrets lus par les tâches (ex-Vault Supabase).
insert into vault.secrets (name, secret) values ('project_url', :'api_url'), ('service_role_key', :'service_key')
on conflict (name) do update set secret = excluded.secret, updated_at = now();

-- Appel d'une fonction avec la clé service (forme commune à 9 tâches).
create or replace function public.cron_appeler_fonction(p_fonction text, p_body jsonb default '{}'::jsonb, p_timeout_ms integer default 5000)
returns bigint language sql security definer set search_path = public as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/' || p_fonction,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := p_body,
    timeout_milliseconds := p_timeout_ms)
$$;
revoke all on function public.cron_appeler_fonction(text, jsonb, integer) from public, anon, authenticated;

-- Appel de la fonction studio, authentifié par sa propre clé (studio_cron_cle).
create or replace function public.cron_appeler_studio(p_action text, p_timeout_ms integer)
returns bigint language sql security definer set search_path = public as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/studio',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('action', p_action, 'cle', (select cle from public.studio_cron_cle where id = 1)),
    timeout_milliseconds := p_timeout_ms)
$$;
revoke all on function public.cron_appeler_studio(text, integer) from public, anon, authenticated;

select cron.schedule('ai-actions-expire',   '5 * * * *',    $c$update ai_actions set statut = 'expiree' where statut = 'proposee' and created_at < now() - interval '24 hours'$c$);
select cron.schedule('observabilite-purge', '15 1 * * *',   $c$delete from public.job_runs where created_at < now() - interval '90 days'; delete from public.client_errors where created_at < now() - interval '90 days';$c$);
select cron.schedule('blog-generate',       '0 8 * * 2,5',  $c$select public.cron_appeler_fonction('generate-article')$c$);
select cron.schedule('imap-sync',           '*/5 * * * *',  $c$select public.cron_appeler_fonction('fetch-emails', '{}', 90000)$c$);
select cron.schedule('sheets-import',       '*/5 * * * *',  $c$select public.cron_appeler_fonction('import-sheets', '{"source":"prospects"}')$c$);
-- Ajoutée le 19/11/2026 (après la bascule) : prospects des formulaires Meta, lus directement.
select cron.schedule('meta-leads',          '*/5 * * * *',  $c$select public.cron_appeler_fonction('meta-leads', '{}', 60000)$c$);
select cron.schedule('newsletter-drain',    '0 7 * * *',    $c$select public.cron_appeler_fonction('generate-newsletter', '{"action":"process_queue","source":"cron"}', 120000)$c$);
select cron.schedule('newsletter-weekly',   '0 9 * * 1',    $c$select public.cron_appeler_fonction('generate-newsletter', '{"source":"cron"}', 150000)$c$);
select cron.schedule('notifications-cron',  '0 3 * * *',    $c$select public.cron_appeler_fonction('notifications-cron', '{}', 120000)$c$);
select cron.schedule('qonto-sync',          '30 3 * * *',   $c$select public.cron_appeler_fonction('qonto-sync', '{}', 120000)$c$);
select cron.schedule('qualiopi-auto-envoi', '0 7 * * *',    $c$select public.cron_appeler_fonction('qualiopi-cron', '{}', 120000)$c$);
select cron.schedule('rgpd-purge',          '0 2 * * 0',    $c$select public.cron_appeler_fonction('rgpd-purge', '{}', 120000)$c$);
select cron.schedule('studio-controle',     '0 2 * * *',    $c$select public.cron_appeler_studio('controle_cron', 10000)$c$);
select cron.schedule('studio-taches',       '1 * * * *',    $c$select public.cron_appeler_studio('taches_cron', 30000)$c$);
-- Ajoutée le 21/11/2026 : propositions d'amélioration tirées des conversations du Studio.
select cron.schedule('studio-ameliorations', '0 3 * * *', $c$select public.cron_appeler_studio('ameliorations_cron', 10000)$c$);

select jobname, schedule, active from cron.job order by jobname;
