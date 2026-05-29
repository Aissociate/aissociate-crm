/*
  # 05 — Tracabilite (ENF-04) & parametres (CDC 4.9 / 6)

  1. `audit_log`  : journal des actions (qui / quoi / quand) pour tracabilite RGPD
  2. `parametres` : configuration cle/valeur (organisme, SMTP, libelles...)
  3. `log_audit(action, entite, entite_id, details)` : helper d'ecriture

  Securite : audit en lecture admin/manager, parametres geres par admin.
*/

create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  action     text not null,
  entite     text not null,
  entite_id  uuid,
  details    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created on public.audit_log(created_at desc);
create index if not exists idx_audit_entite on public.audit_log(entite, entite_id);
alter table public.audit_log enable row level security;

create or replace function public.log_audit(
  p_action text, p_entite text, p_entite_id uuid, p_details jsonb default null
)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (user_id, action, entite, entite_id, details)
  values (auth.uid(), p_action, p_entite, p_entite_id, p_details);
$$;

create table if not exists public.parametres (
  id          uuid primary key default gen_random_uuid(),
  cle         text not null unique,
  valeur      jsonb,
  description text,
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_parametres_updated on public.parametres;
create trigger trg_parametres_updated before update on public.parametres
  for each row execute function public.set_updated_at();
alter table public.parametres enable row level security;
