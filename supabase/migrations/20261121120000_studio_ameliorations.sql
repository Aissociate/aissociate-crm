-- Studio IA — analyse quotidienne des conversations (supabase/functions/studio/ameliorations.ts).
-- Les conversations des dernières 24 h sont lues par un LLM (OpenRouter) qui en tire des
-- propositions d'amélioration utiles au client ; elles sont déposées, seulement s'il y en a,
-- dans CRM › Développement (table tickets, type « proposition »). Historique : job_runs
-- (fonction « studio-ameliorations »).
-- Prod (VPS) : cron_appeler_studio existe déjà (deploy/data/sql/30-cron.sql).

-- Chaque jour à 03:00 UTC (07:00 à La Réunion).
select cron.unschedule(jobid) from cron.job where jobname = 'studio-ameliorations';
select cron.schedule('studio-ameliorations', '0 3 * * *', $c$select public.cron_appeler_studio('ameliorations_cron', 10000)$c$);
