/*
  # Correctif : récursion infinie dans la RLS de `profiles`

  Symptôme : le SELECT sur profiles renvoie 500 « infinite recursion detected in
  policy for relation profiles » → le front ne charge jamais le profil → role null
  → l'admin ne voit rien.

  Cause : une policy de `profiles` évalue un helper (is_admin) qui relit `profiles`
  sans bypasser la RLS → la policy se redéclenche en boucle.

  Correctif (idempotent) :
  1. Helpers is_admin/is_manager en SECURITY DEFINER (lisent profiles HORS RLS).
  2. Purge de toutes les policies de `profiles` puis recréation du jeu sain et
     non récursif (select libre aux authenticated ; update de sa propre ligne ;
     accès total admin via le helper security-definer).
*/

-- 1) Helpers non récursifs
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'directeur_commercial') from public.profiles where id = auth.uid()), false);
$$;

-- 2) Réinitialise proprement les policies de profiles (supprime toute policy récursive résiduelle)
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
