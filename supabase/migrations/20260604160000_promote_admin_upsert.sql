/*
  # Promotion admin robuste (upsert)

  La migration précédente (`update ... where email = ...`) ne faisait RIEN si la
  ligne `profiles` n'existait pas encore dans le projet cible — ce qui était le
  cas sur le projet réellement utilisé par l'app (avatar « ? », profil null).

  Ici on (re)crée la ligne à partir de `auth.users` puis on force `role = 'admin'`.
  Idempotent : à relancer sans risque, ne touche que les deux comptes de l'organisme.
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
