-- Sécurité : empêcher l'auto-attribution d'un rôle privilégié.
--
-- 1. handle_new_user prenait le rôle dans raw_user_meta_data, c'est-à-dire dans
--    les données envoyées par la personne qui s'inscrit : avec l'inscription
--    publique ouverte, n'importe qui pouvait créer un compte « admin ».
--    Le rôle n'est plus jamais lu depuis les métadonnées : un nouveau compte est
--    « conseiller » (sauf le tout premier, admin, comportement inchangé) et
--    c'est un admin qui le promeut depuis l'écran Administration.
--
-- 2. La policy profiles_update_self laisse un utilisateur modifier toute sa
--    ligne, y compris role / is_admin / actif / approved. Un trigger refuse
--    désormais la modification de ces colonnes à qui n'est pas admin.
--    Les fonctions serveur (service_role) et les fonctions SECURITY DEFINER
--    (exécutées en propriétaire) ne sont pas concernées.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role public.user_role;
begin
  if not exists (select 1 from public.profiles) then
    v_role := 'admin';
  else
    v_role := 'conseiller';
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
$function$;

create or replace function public.profiles_proteger_colonnes_sensibles()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.role              is distinct from old.role
    or new.is_admin          is distinct from old.is_admin
    or new.actif             is distinct from old.actif
    or new.approved          is distinct from old.approved
    or new.statut_conseiller is distinct from old.statut_conseiller
    or new.date_recrutement  is distinct from old.date_recrutement
    or new.email             is distinct from old.email
    or new.id                is distinct from old.id then
      raise exception 'Modification réservée aux administrateurs (rôle, droits, statut)'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_profiles_proteger on public.profiles;
create trigger trg_profiles_proteger
  before update on public.profiles
  for each row execute function public.profiles_proteger_colonnes_sensibles();
