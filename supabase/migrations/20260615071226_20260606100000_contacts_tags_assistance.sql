alter table public.contacts
  add column if not exists tags text[] not null default '{}'::text[];
create index if not exists idx_contacts_tags on public.contacts using gin (tags);

create or replace function public.lead_to_contact()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cid uuid;
  v_tags text[] := '{}'::text[];
begin
  if new.request_type ~* 'assistance' then
    v_tags := array['Assistance'];
  end if;

  insert into public.contacts (type, nom, prenom, email, telephone, statut_prospect, besoin_resume, formation_envisagee, notes, tags)
  values (
    'prospect',
    coalesce(nullif(trim(new.last_name), ''), '(lead)'),
    nullif(trim(new.first_name), ''),
    new.email, new.phone, 'nouveau',
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

notify pgrst, 'reload schema';
