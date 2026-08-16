/*
  # Lead du site → contact « non assigné » + tag « nouveau prospect »

  Objectif métier : un lead qui remonte du formulaire public doit arriver dans le
  CRM en prospect NON ASSIGNÉ, clairement repérable, jusqu'à son attribution à un
  conseiller.

  1. `lead_to_contact()` (trigger sur `contact_requests`) : le contact prospect est
     désormais créé avec
       - `statut_prospect = 'non assigné'`  (au lieu de 'nouveau')
       - tag `'nouveau prospect'` (+ `'Assistance'` si la demande concerne l'assistance)

  2. Nouveau trigger `trg_contact_clear_lead_flags` (BEFORE UPDATE sur `contacts`) :
     à l'ATTRIBUTION (owner_id passe de NULL à renseigné), on nettoie automatiquement
     l'état « lead frais » :
       - le tag `'nouveau prospect'` est retiré
       - le statut `'non assigné'` repasse à `'nouveau'`
     Couvre toutes les voies d'affectation (manuelle, en masse, round-robin), qui
     écrivent toutes `owner_id`.

  GoHighLevel : la synchro GHL est retirée côté front (obsolète) ; rien à modifier ici.
*/

-- 1) État d'entrée du lead
create or replace function public.lead_to_contact()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cid uuid;
  v_tags text[] := array['nouveau prospect'];
begin
  if new.request_type ~* 'assistance' then
    v_tags := array_append(v_tags, 'Assistance');
  end if;

  insert into public.contacts (type, nom, prenom, email, telephone, statut_prospect, besoin_resume, formation_envisagee, notes, tags)
  values (
    'prospect',
    coalesce(nullif(trim(new.last_name), ''), '(lead)'),
    nullif(trim(new.first_name), ''),
    new.email, new.phone, 'non assigné',
    new.message, new.request_type,
    'Lead site web' || coalesce(' — ' || new.source, '') || coalesce(' — entreprise : ' || new.company, ''),
    v_tags
  )
  returning id into cid;

  insert into public.opportunites (titre, contact_id, stage, notes)
  values (
    'Lead site — ' || coalesce(nullif(trim(new.request_type), ''), 'demande de contact'),
    cid,
    'nouveau',
    coalesce(new.message, '')
  );

  update public.contact_requests set contact_id = cid where id = new.id;
  return new;
end $$;

drop trigger if exists trg_lead_to_contact on public.contact_requests;
create trigger trg_lead_to_contact after insert on public.contact_requests
  for each row execute function public.lead_to_contact();

-- 2) Nettoyage automatique à l'attribution
create or replace function public.contact_clear_lead_flags_on_assign()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  -- Première attribution : owner_id passe de NULL à renseigné
  if new.owner_id is not null and old.owner_id is null then
    new.tags := array_remove(coalesce(new.tags, '{}'::text[]), 'nouveau prospect');
    if new.statut_prospect = 'non assigné' then
      new.statut_prospect := 'nouveau';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_contact_clear_lead_flags on public.contacts;
create trigger trg_contact_clear_lead_flags before update on public.contacts
  for each row execute function public.contact_clear_lead_flags_on_assign();

notify pgrst, 'reload schema';
