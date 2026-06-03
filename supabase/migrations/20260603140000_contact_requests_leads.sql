/*
  # Leads du site vitrine -> contacts du CRM

  - `contact_requests` : dépôt des demandes des formulaires publics (site OF).
    Insérable par un visiteur anonyme (formulaire public) ; lisible/gérable par
    la direction côté CRM.
  - Trigger : chaque lead crée automatiquement un CONTACT (type prospect) dans le
    CRM, de sorte que « les leads du front remontent dans contacts ».

  Sécurité : l'insertion publique est limitée à cette table de dépôt ; la création
  du contact se fait via une fonction SECURITY DEFINER (le visiteur n'écrit jamais
  directement dans `contacts`).
*/

create table if not exists public.contact_requests (
  id           uuid primary key default gen_random_uuid(),
  first_name   text,
  last_name    text,
  email        text,
  phone        text,
  company      text,
  request_type text,
  message      text,
  source       text,
  status       text not null default 'new',
  contact_id   uuid references public.contacts(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.contact_requests enable row level security;

-- Soumission publique (anonyme) d'un lead depuis le site.
drop policy if exists contact_requests_insert_public on public.contact_requests;
create policy contact_requests_insert_public on public.contact_requests
  for insert to anon, authenticated with check (true);

-- Lecture / gestion réservée à la direction (CRM).
drop policy if exists contact_requests_manage on public.contact_requests;
create policy contact_requests_manage on public.contact_requests
  for all to authenticated using (is_manager()) with check (is_manager());

-- Crée un contact prospect à partir d'un lead (bypass RLS via security definer).
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
  update public.contact_requests set contact_id = cid where id = new.id;
  return new;
end $$;

drop trigger if exists trg_lead_to_contact on public.contact_requests;
create trigger trg_lead_to_contact after insert on public.contact_requests
  for each row execute function public.lead_to_contact();

notify pgrst, 'reload schema';
