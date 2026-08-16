/*
  # Tag « nouveau prospect » : posé sur TOUT nouveau prospect, retiré à la 1re action

  Règle métier demandée :
  - Chaque nouveau prospect (import Sheet, création manuelle, lead du site) reçoit
    automatiquement le tag « nouveau prospect ».
  - Le tag disparaît dès la PREMIÈRE action enregistrée par un utilisateur
    (n'importe quel rôle) sur ce contact — et NON plus à l'affectation (owner_id).

  Mécanisme :
  1. trg_contact_tag_nouveau  (BEFORE INSERT sur contacts) : ajoute le tag pour
     type='prospect' s'il n'y est pas déjà. Couvre toutes les voies de création
     (l'insert de lead_to_contact passe aussi par ici → dédoublonné).
  2. trg_contact_action_clear_nouveau (AFTER INSERT sur contact_actions) : retire
     le tag du contact concerné dès la première action.
  3. contact_clear_lead_flags_on_assign : NE retire PLUS le tag à l'attribution
     (on conserve seulement le passage de statut « non assigné » → « nouveau »).
*/

-- 1) Pose du tag sur tout nouveau prospect
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

-- 2) Retrait du tag à la première action (quel que soit l'utilisateur)
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

-- 3) L'attribution ne retire plus le tag (conserve uniquement la bascule de statut)
create or replace function public.contact_clear_lead_flags_on_assign()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  -- Première attribution : owner_id passe de NULL à renseigné
  if new.owner_id is not null and old.owner_id is null then
    if new.statut_prospect = 'non assigné' then
      new.statut_prospect := 'nouveau';
    end if;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
