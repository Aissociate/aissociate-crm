alter table public.opportunites
  add column if not exists date_cloture timestamptz;

create or replace function public.set_opp_cloture()
returns trigger language plpgsql as $$
begin
  if new.stage in ('gagne', 'perdu') then
    if tg_op = 'INSERT' or old.stage is distinct from new.stage then
      new.date_cloture := coalesce(new.date_cloture, now());
    end if;
  else
    new.date_cloture := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_opp_cloture on public.opportunites;
create trigger trg_opp_cloture before insert or update on public.opportunites
  for each row execute function public.set_opp_cloture();

update public.opportunites
  set date_cloture = updated_at
  where stage in ('gagne', 'perdu') and date_cloture is null;

create table if not exists public.page_views (
  id         uuid primary key default gen_random_uuid(),
  path       text not null,
  visitor_id text,
  referrer   text,
  created_at timestamptz not null default now()
);
create index if not exists idx_page_views_created on public.page_views(created_at desc);
create index if not exists idx_page_views_visitor on public.page_views(visitor_id);
alter table public.page_views enable row level security;

drop policy if exists page_views_insert_public on public.page_views;
create policy page_views_insert_public on public.page_views
  for insert to anon, authenticated with check (true);

drop policy if exists page_views_select_manager on public.page_views;
create policy page_views_select_manager on public.page_views
  for select to authenticated using (is_manager());

notify pgrst, 'reload schema';
