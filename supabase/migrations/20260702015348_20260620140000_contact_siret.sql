alter table public.contacts
  add column if not exists siret text;

notify pgrst, 'reload schema';
