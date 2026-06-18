alter type public.contact_type add value if not exists 'formateur';
alter type public.contact_type add value if not exists 'encadrement';

notify pgrst, 'reload schema';
