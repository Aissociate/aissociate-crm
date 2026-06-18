create table if not exists public.import_batches (
  id          uuid primary key default gen_random_uuid(),
  source      text not null default 'csv',
  count       integer not null default 0,
  contact_ids uuid[] not null default '{}',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  undone      boolean not null default false,
  undone_at   timestamptz
);
create index if not exists idx_import_batches_recent
  on public.import_batches(undone, created_at desc);
alter table public.import_batches enable row level security;

drop policy if exists import_batches_all on public.import_batches;
create policy import_batches_all on public.import_batches for all to authenticated
  using (is_manager() or created_by = auth.uid())
  with check (is_manager() or created_by = auth.uid());

notify pgrst, 'reload schema';
