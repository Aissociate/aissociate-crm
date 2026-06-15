/*
  # Alignement du modèle de rôle base ↔ frontend (correctif upload documents)

  Symptôme : un utilisateur voit les boutons « manager » (Nouveau document,
  Nouvelle formation…) et téléverse bien le fichier dans le Storage, mais
  l'enregistrement de la ligne échoue silencieusement / en erreur RLS.

  Cause : deux modèles de rôle coexistent.
   - Le frontend (AuthContext) considère « admin/manager » si `role = 'admin'`
     OU si la colonne booléenne `profiles.is_admin = true` (flag écrit par le
     flux du site, sans renseigner `role`).
   - La base ne regardait QUE `role` dans `is_admin()` / `is_manager()`. Les
     policies d'écriture (documents, formations, sessions, plan_pdfs…) passent
     par ces helpers → un « admin par flag » est bloqué côté base.

  Correctif (idempotent) :
   1. Garantir la colonne `profiles.is_admin` (booléen) — créée hors migration
      par le flux du site ; on la matérialise pour que la base puisse s'y fier.
   2. Redéfinir `is_admin()` / `is_manager()` en SECURITY DEFINER (lecture hors
      RLS, non récursive) pour honorer `role` ET le flag `is_admin`.
   3. Cohérence des données : si `is_admin = true` et `role` non-manager,
      promouvoir `role = 'admin'` (et inversement, refléter `role` sur le flag).
*/

-- 1) Colonne flag (no-op si déjà présente)
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- 2) Helpers alignés sur les deux modèles
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

-- 3) Réconciliation des deux champs sur les lignes existantes
update public.profiles set role = 'admin'
  where coalesce(is_admin, false) = true and role is distinct from 'admin';
update public.profiles set is_admin = true
  where role = 'admin' and coalesce(is_admin, false) = false;

notify pgrst, 'reload schema';
