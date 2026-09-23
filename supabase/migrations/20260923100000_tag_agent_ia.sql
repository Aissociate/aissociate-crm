/*
  # Prospects « Agent IA »

  Les demandes venant de la page /agents-ia, ou dont le type de demande est
  « Employé virtuel » (formulaires /formulaire et /contact), créent un prospect
  portant le tag « Agent IA ». Rattrapage des prospects déjà créés.
*/

create or replace function public.lead_to_contact()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  cid uuid;
  v_tags text[] := array['nouveau prospect'];
begin
  if new.request_type ~* 'assistance' then
    v_tags := array_append(v_tags, 'Assistance');
  end if;
  if new.request_type ~* 'employ[eé]s?[ -]virtuel|agents? ia' or new.source ~* 'agents-ia' then
    v_tags := array_append(v_tags, 'Agent IA');
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

-- Rattrapage : prospects déjà issus de la page Agents IA
update public.contacts c
   set tags = array_append(coalesce(c.tags, '{}'::text[]), 'Agent IA')
  from public.contact_requests r
 where r.contact_id = c.id
   and (r.request_type ~* 'employ[eé]s?[ -]virtuel|agents? ia' or r.source ~* 'agents-ia')
   and not ('Agent IA' = any(coalesce(c.tags, '{}'::text[])));
