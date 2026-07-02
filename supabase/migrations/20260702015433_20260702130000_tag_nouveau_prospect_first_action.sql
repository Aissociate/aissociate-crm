create or replace function public.contact_tag_nouveau_prospect()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.type = 'prospect'
     and not ('nouveau prospect' = any(coalesce(new.tags, '{}'::text[]))) then
    new.tags := array_append(coalesce(new.tags, '{}'::text[]), 'nouveau prospect');
  end if;
  return new;
end $$;

drop trigger if exists trg_contact_tag_nouveau on public.contacts;
create trigger trg_contact_tag_nouveau before insert on public.contacts
  for each row execute function public.contact_tag_nouveau_prospect();

create or replace function public.contact_action_clear_nouveau()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.contacts
     set tags = array_remove(coalesce(tags, '{}'::text[]), 'nouveau prospect')
   where id = new.contact_id
     and 'nouveau prospect' = any(coalesce(tags, '{}'::text[]));
  return new;
end $$;

drop trigger if exists trg_contact_action_clear_nouveau on public.contact_actions;
create trigger trg_contact_action_clear_nouveau after insert on public.contact_actions
  for each row execute function public.contact_action_clear_nouveau();

create or replace function public.contact_clear_lead_flags_on_assign()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.owner_id is not null and old.owner_id is null then
    if new.statut_prospect = 'non assigné' then
      new.statut_prospect := 'nouveau';
    end if;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
