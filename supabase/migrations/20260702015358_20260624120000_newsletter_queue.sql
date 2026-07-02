create table if not exists public.newsletter_queue (
  id            uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references public.newsletters(id) on delete cascade,
  email         text not null,
  status        text not null default 'pending',
  error         text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index if not exists idx_nlq_status on public.newsletter_queue(status, created_at);
create index if not exists idx_nlq_sent_at on public.newsletter_queue(sent_at);
create unique index if not exists uq_nlq_nl_email on public.newsletter_queue(newsletter_id, email);
alter table public.newsletter_queue enable row level security;

drop policy if exists newsletter_queue_admin on public.newsletter_queue;
create policy newsletter_queue_admin on public.newsletter_queue for all to authenticated
  using (is_manager()) with check (is_manager());

do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  perform cron.unschedule(jobid) from cron.job where jobname = 'newsletter-drain';

  perform cron.schedule(
    'newsletter-drain',
    '0 7 * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/generate-newsletter',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' ||
            (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := '{"action":"process_queue","source":"cron"}'::jsonb,
        timeout_milliseconds := 120000
      );
    $job$
  );

  raise notice 'Job cron "newsletter-drain" programmé (tous les jours 7h).';
exception when others then
  raise notice 'Cron newsletter-drain non configuré (%). Secrets Vault requis.', sqlerrm;
end $$;

notify pgrst, 'reload schema';
