alter table public.profiles add column if not exists is_admin boolean not null default false;

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

update public.profiles set role = 'admin'
  where coalesce(is_admin, false) = true and role is distinct from 'admin';
update public.profiles set is_admin = true
  where role = 'admin' and coalesce(is_admin, false) = false;

notify pgrst, 'reload schema';
