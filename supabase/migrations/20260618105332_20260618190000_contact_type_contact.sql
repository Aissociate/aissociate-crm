alter type public.contact_type add value if not exists 'contact';
notify pgrst, 'reload schema';