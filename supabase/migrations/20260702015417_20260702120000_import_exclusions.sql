create table if not exists public.import_exclusions (
  source text not null,
  external_id text not null,
  nom text,
  email text,
  deleted_at timestamptz not null default now(),
  primary key (source, external_id)
);

alter table public.import_exclusions enable row level security;

comment on table public.import_exclusions is
  'Clés external_id supprimées du CRM : filtrées par import-sheets pour ne pas les recréer.';

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
