-- Exclusions d'import : un contact/candidat supprimé dans le CRM ne doit jamais
-- réapparaître via l'import Google Sheet (cron ou manuel).
-- Le Sheet reste source des NOUVEAUX leads + sauvegarde ; le CRM est autoritaire
-- une fois le lead importé (modification / réaffectation / suppression indépendantes).

create table if not exists public.import_exclusions (
  source text not null,            -- 'contacts' | 'candidats'
  external_id text not null,       -- ex. 'pros:email' ou 'meta:<id>'
  nom text,
  email text,
  deleted_at timestamptz not null default now(),
  primary key (source, external_id)
);

-- Table interne : pas d'accès via l'API publique (RLS activée, aucune policy).
-- Le trigger (security definer) et le service_role (Edge Function) y accèdent.
alter table public.import_exclusions enable row level security;

comment on table public.import_exclusions is
  'Clés external_id supprimées du CRM : filtrées par import-sheets pour ne pas les recréer.';

-- Mémorise toute suppression d'une ligne issue d'un import (external_id non nul).
create or replace function public.record_import_exclusion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.external_id is not null and OLD.external_id <> '' then
    insert into public.import_exclusions (source, external_id, nom, email)
    values (TG_TABLE_NAME, OLD.external_id, OLD.nom, OLD.email)
    on conflict (source, external_id) do nothing;
  end if;
  return OLD;
end;
$$;

drop trigger if exists trg_contacts_import_exclusion on public.contacts;
create trigger trg_contacts_import_exclusion
  after delete on public.contacts
  for each row execute function public.record_import_exclusion();

drop trigger if exists trg_candidats_import_exclusion on public.candidats;
create trigger trg_candidats_import_exclusion
  after delete on public.candidats
  for each row execute function public.record_import_exclusion();
