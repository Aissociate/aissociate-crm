/*
  # Promotion du compte principal en administrateur

  Idempotent : no-op si le compte est deja admin ou absent.
*/
update public.profiles
set role = 'admin'
where lower(email) = lower('contact@aissociate.re')
  and role <> 'admin';
