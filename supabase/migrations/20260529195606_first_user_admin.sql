/*
  # 14 — Premier utilisateur = administrateur (visibilité des données)

  Problème résolu : par défaut un nouveau compte est « conseiller » et, via la
  RLS, ne voit ni le module Recrutement ni les prospects importés (sans owner).
  Résultat fréquent : « les imports ne s'affichent pas ».

  1. Promotion immédiate : si aucun admin n'existe, le compte le plus ancien
     devient admin (corrige le compte déjà créé).
  2. À l'avenir : le tout premier compte inscrit reçoit le rôle admin.
*/

-- 1) Promotion du compte existant le plus ancien si aucun admin
update public.profiles
set role = 'admin'
where id = (select id from public.profiles order by created_at asc limit 1)
  and not exists (select 1 from public.profiles where role = 'admin');

-- 2) Trigger : premier inscrit = admin, sinon rôle du metadata ou conseiller
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role;
begin
  if not exists (select 1 from public.profiles) then
    v_role := 'admin';
  else
    v_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'conseiller');
  end if;

  insert into public.profiles (id, email, nom, prenom, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    v_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
