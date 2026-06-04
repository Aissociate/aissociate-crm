/*
  # Leads du front → contact ET opportunité

  Le trigger existant (lead_to_contact) créait un CONTACT prospect à partir de
  chaque lead public. On l'étend pour créer AUSSI une OPPORTUNITÉ (entrée du
  pipeline commercial), afin que « les leads du front remontent dans contacts
  ET opportunités » de l'app.

  - SECURITY DEFINER : le visiteur anonyme n'écrit jamais directement dans
    contacts/opportunites (RLS) ; tout passe par contact_requests + ce trigger.
  - Idempotent (create or replace).
*/
create or replace function public.lead_to_contact()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare cid uuid;
begin
  insert into public.contacts (type, nom, prenom, email, telephone, statut_prospect, besoin_resume, formation_envisagee, notes)
  values (
    'prospect',
    coalesce(nullif(trim(new.last_name), ''), '(lead)'),
    nullif(trim(new.first_name), ''),
    new.email, new.phone, 'nouveau',
    new.message, new.request_type,
    'Lead site web' || coalesce(' — ' || new.source, '') || coalesce(' — entreprise : ' || new.company, '')
  )
  returning id into cid;

  -- Opportunité commerciale liée au lead (entrée du pipeline, étape « nouveau »)
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
