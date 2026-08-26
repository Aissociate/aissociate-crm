/*
  # Observabilité — journal des jobs (Edge Functions cron) + erreurs front

  - `job_runs` : chaque exécution d'une fonction planifiée (fetch-emails,
    notifications-cron, rgpd-purge, qonto-sync…) y consigne son résultat.
    Écrit uniquement via la clé service role (les Edge Functions) ; la
    direction consulte l'état de santé depuis Administration.
  - `client_errors` : erreurs de rendu capturées par l'ErrorBoundary du CRM.
*/

create table if not exists public.job_runs (
  id          uuid primary key default gen_random_uuid(),
  fonction    text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean not null default true,
  message     text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_job_runs_fonction on public.job_runs(fonction, started_at desc);
alter table public.job_runs enable row level security;

drop policy if exists job_runs_select on public.job_runs;
create policy job_runs_select on public.job_runs for select to authenticated using (is_manager());

create table if not exists public.client_errors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  url        text,
  message    text not null,
  stack      text,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_errors_created on public.client_errors(created_at desc);
alter table public.client_errors enable row level security;

drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors for insert to authenticated
  with check (user_id is null or user_id = auth.uid());
drop policy if exists client_errors_select on public.client_errors;
create policy client_errors_select on public.client_errors for select to authenticated using (is_manager());

-- Purge automatique : on ne garde que 90 jours de journal (tables techniques).
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'observabilite-purge';
  perform cron.schedule(
    'observabilite-purge',
    '15 1 * * *',
    $job$
      delete from public.job_runs where created_at < now() - interval '90 days';
      delete from public.client_errors where created_at < now() - interval '90 days';
    $job$
  );
exception when others then
  raise notice 'Purge observabilité non planifiée (%) — pg_cron requis.', sqlerrm;
end $$;

notify pgrst, 'reload schema';
