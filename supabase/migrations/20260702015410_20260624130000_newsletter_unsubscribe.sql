alter table public.contacts
  add column if not exists newsletter_unsubscribed boolean not null default false,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
create index if not exists idx_contacts_unsub_token on public.contacts(unsubscribe_token);

alter table public.newsletter_queue
  add column if not exists retry_count integer not null default 0;

create table if not exists public.newsletter_drain_lock (
  id           int primary key default 1,
  locked_until timestamptz
);
insert into public.newsletter_drain_lock (id, locked_until) values (1, null) on conflict (id) do nothing;
alter table public.newsletter_drain_lock enable row level security;

update public.parametres
  set valeur = coalesce(valeur, '{}'::jsonb) || jsonb_build_object('rgpd_only', false)
  where cle = 'newsletter';

notify pgrst, 'reload schema';
