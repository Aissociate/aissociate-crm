/*
  # Promotion admin robuste (upsert)

  Recreer la ligne profiles depuis auth.users puis forcer role = 'admin'.
  Idempotent : ne touche que les deux comptes de l'organisme.
*/
insert into public.profiles (id, email, nom, prenom, role)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data->>'nom', ''),
       coalesce(u.raw_user_meta_data->>'prenom', ''),
       'admin'::public.user_role
from auth.users u
where lower(u.email) in ('contact@aissociate.re', 'benjamin@aissociate.re')
on conflict (id) do update set role = 'admin';
