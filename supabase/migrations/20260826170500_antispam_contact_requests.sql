/*
  # Anti-spam des formulaires publics (contact_requests)

  Garde-fou côté base (les formulaires du site insèrent directement via la clé
  anon) : au plus 5 demandes par heure pour une même adresse e-mail, et 100
  demandes par heure au total. Complète le honeypot ajouté côté front.
  SECURITY DEFINER : le rôle anon n'a pas le droit de lire la table, mais le
  trigger doit compter les lignes récentes.
*/

create or replace function public.contact_requests_ratelimit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  n int;
begin
  if new.email is not null then
    select count(*) into n from contact_requests
      where lower(email) = lower(new.email) and created_at > now() - interval '1 hour';
    if n >= 5 then
      raise exception 'Trop de demandes envoyées récemment. Merci de réessayer plus tard.';
    end if;
  end if;
  select count(*) into n from contact_requests where created_at > now() - interval '1 hour';
  if n >= 100 then
    raise exception 'Service momentanément indisponible. Merci de réessayer plus tard.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_contact_requests_ratelimit on public.contact_requests;
create trigger trg_contact_requests_ratelimit
  before insert on public.contact_requests
  for each row execute function public.contact_requests_ratelimit();
