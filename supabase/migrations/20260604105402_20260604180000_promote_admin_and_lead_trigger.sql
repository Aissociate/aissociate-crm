/*
  # Promote admin users + lead_to_contact trigger

  1. Profiles
     - Promote contact@aissociate.re and benjamin@aissociate.re to role 'admin'

  2. Function lead_to_contact
     - Replaces previous version
     - On INSERT into contact_requests: creates a contact (type prospect) + an opportunite (stage 'nouveau')
     - Updates contact_requests.contact_id with the new contact id
*/

-- 1) Promote admins
UPDATE public.profiles
SET role = 'admin'
WHERE lower(email) IN ('contact@aissociate.re', 'benjamin@aissociate.re');

-- 2) Lead -> contact + opportunite trigger function
CREATE OR REPLACE FUNCTION public.lead_to_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cid uuid;
BEGIN
  INSERT INTO public.contacts (type, nom, prenom, email, telephone, statut_prospect, besoin_resume, formation_envisagee, notes)
  VALUES (
    'prospect',
    coalesce(nullif(trim(new.last_name), ''), '(lead)'),
    nullif(trim(new.first_name), ''),
    new.email,
    new.phone,
    'nouveau',
    new.message,
    new.request_type,
    'Lead site web'
      || coalesce(' — ' || new.source, '')
      || coalesce(' — entreprise : ' || new.company, '')
  )
  RETURNING id INTO cid;

  INSERT INTO public.opportunites (titre, contact_id, stage, notes)
  VALUES (
    'Lead site — ' || coalesce(nullif(trim(new.request_type), ''), 'demande de contact'),
    cid,
    'nouveau',
    coalesce(new.message, '')
  );

  UPDATE public.contact_requests SET contact_id = cid WHERE id = new.id;

  RETURN new;
END;
$$;
