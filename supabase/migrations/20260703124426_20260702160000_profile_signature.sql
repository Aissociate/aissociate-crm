alter table public.profiles add column if not exists signature text;

notify pgrst, 'reload schema';
