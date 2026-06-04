/*
  # Promotion du compte principal en administrateur

  Contexte : profiles.role est NOT NULL DEFAULT 'conseiller' (cf. core). Les
  comptes créés via le flux site reçoivent donc 'conseiller' et n'ont pas accès
  aux modules réservés (Recrutement, Blog, Administration), d'où l'admin qui
  « ne voit rien ». On promeut explicitement le compte de l'organisme en 'admin'.

  Idempotent : no-op si le compte est déjà admin ou absent.
*/
update public.profiles
set role = 'admin'
where lower(email) = lower('contact@aissociate.re')
  and role <> 'admin';
