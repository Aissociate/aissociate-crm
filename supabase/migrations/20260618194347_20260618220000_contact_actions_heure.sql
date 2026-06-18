alter table public.contact_actions
  add column if not exists heure_action time;

notify pgrst, 'reload schema';
