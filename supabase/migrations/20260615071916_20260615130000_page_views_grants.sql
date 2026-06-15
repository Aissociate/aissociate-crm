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

grant insert on public.page_views to anon, authenticated;
grant select on public.page_views to authenticated;

drop policy if exists page_views_insert_public on public.page_views;
create policy page_views_insert_public on public.page_views
  for insert to anon, authenticated with check (true);

drop policy if exists page_views_select_manager on public.page_views;
create policy page_views_select_manager on public.page_views
  for select to authenticated using (is_manager());

notify pgrst, 'reload schema';
