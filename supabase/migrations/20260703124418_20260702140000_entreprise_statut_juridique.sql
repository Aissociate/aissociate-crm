alter table public.entreprises add column if not exists statut_juridique text;

notify pgrst, 'reload schema';
