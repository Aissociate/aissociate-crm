/*
  # RLS profiles : helpers basés sur le rôle (non récursifs)

  Les helpers is_admin() et is_manager() deviennent SECURITY DEFINER pour lire
  profiles hors RLS et éviter la récursion infinie. On tient aussi compte du
  flag is_admin booléen sur la ligne de profil.

  Les policies de profiles sont réinitialisées puis recréées :
  - SELECT libre pour les authenticated (annuaire interne)
  - UPDATE de sa propre ligne uniquement
  - Admin : accès total via le helper security-definer
*/
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'admin' or coalesce(is_admin, false) from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('admin', 'directeur_commercial') or coalesce(is_admin, false)
     from public.profiles where id = auth.uid()),
    false
  );
$$;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using (true);

create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
