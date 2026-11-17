-- Studio IA — tâches planifiées des agents.
-- Une consigne confiée à un agent, rejouée automatiquement aux jours (ISO,
-- 1 = lundi) et heures (La Réunion) choisis. Un job pg_cron horaire appelle
-- l'Edge Function `studio` (action taches_cron) avec une clé tirée au hasard,
-- conservée dans une table fermée (RLS sans politique : service role seulement).
-- Prérequis identiques aux autres crons : secret Vault `project_url`.

create table if not exists public.studio_taches (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.studio_workspaces(id) on delete cascade,
  user_id              uuid not null references public.studio_users(id) on delete cascade,
  agent_id             text not null references public.studio_agents(id) on delete cascade,
  titre                text not null check (char_length(titre) between 1 and 120),
  consigne             text not null check (char_length(consigne) between 1 and 4000),
  heures               smallint[] not null,
  jours                smallint[] not null,
  actif                boolean not null default true,
  prochaine_execution  timestamptz,
  en_cours_depuis      timestamptz,
  derniere_execution   timestamptz,
  dernier_statut       text check (dernier_statut in ('ok', 'erreur')),
  dernier_compte_rendu text,
  conversation_id      uuid references public.studio_conversations(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_studio_taches_ws on public.studio_taches(workspace_id, created_at);
create index if not exists idx_studio_taches_echeance on public.studio_taches(prochaine_execution) where actif;
drop trigger if exists trg_studio_taches_updated on public.studio_taches;
create trigger trg_studio_taches_updated before update on public.studio_taches
  for each row execute function public.set_updated_at();
alter table public.studio_taches enable row level security;
drop policy if exists studio_taches_manager on public.studio_taches;
create policy studio_taches_manager on public.studio_taches for select to authenticated using (public.is_manager());

-- Clé du déclencheur (jamais exposée : aucune politique RLS).
create table if not exists public.studio_cron_cle (
  id  smallint primary key default 1 check (id = 1),
  cle text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
alter table public.studio_cron_cle enable row level security;
revoke all on public.studio_cron_cle from anon, authenticated;
insert into public.studio_cron_cle (id) values (1) on conflict (id) do nothing;

notify pgrst, 'reload schema';

-- Déclencheur : toutes les heures à hh:01.
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.unschedule(jobid) from cron.job where jobname = 'studio-taches';
  perform cron.schedule(
    'studio-taches',
    '1 * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/studio',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('action', 'taches_cron', 'cle', (select cle from public.studio_cron_cle where id = 1)),
        timeout_milliseconds := 30000
      );
    $job$
  );
  raise notice 'Job cron studio-taches programmé.';
exception when others then
  raise notice 'Cron studio-taches non configuré (%). Secret Vault project_url requis.', sqlerrm;
end $$;
