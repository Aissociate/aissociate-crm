-- Ticket Benjamin « modifications des types d'action » : « relance » est redondant
-- (une relance est un appel ou un mail) et « note » n'a jamais servi.
update public.contact_actions set type = 'appel' where type = 'relance';
update public.contact_actions set type = 'autre' where type = 'note';

-- Normalisation à l'écriture : la synchronisation IMAP crée encore des relances
-- automatiques ; on les enregistre directement au bon type.
create or replace function public.contact_action_normalise_type()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.type = 'relance' then new.type := 'appel'; end if;
  if new.type = 'note' then new.type := 'autre'; end if;
  return new;
end $$;

drop trigger if exists trg_contact_action_normalise_type on public.contact_actions;
create trigger trg_contact_action_normalise_type
before insert or update on public.contact_actions
for each row execute function public.contact_action_normalise_type();
