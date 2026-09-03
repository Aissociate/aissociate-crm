/*
  # Espace client / apprenant (lien tokenisé, sans compte)

  - `espace_acces` : un lien unique par contact (`/espace/:token`), généré
    depuis la fiche contact. Le client y retrouve : sessions à venir, devis,
    documents, questionnaires à répondre, demandes de signature.
  - `espace_consultations` : traçabilité Qualiopi — chaque ouverture de
    l'espace et chaque ressource consultée y est consignée (service role).
  - RLS CRM : visibilité alignée sur la RLS de `contacts` (un conseiller ne
    voit que les accès de ses contacts). Le public passe par l'Edge Function
    `espace-client` (service role + token).
*/

create table if not exists public.espace_acces (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null unique references public.contacts(id) on delete cascade,
  token        text not null unique default encode(gen_random_bytes(16), 'hex'),
  actif        boolean not null default true,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);
alter table public.espace_acces enable row level security;

drop policy if exists espace_acces_all on public.espace_acces;
create policy espace_acces_all on public.espace_acces for all to authenticated
  using (exists (select 1 from public.contacts c where c.id = contact_id))
  with check (exists (select 1 from public.contacts c where c.id = contact_id));

create table if not exists public.espace_consultations (
  id         uuid primary key default gen_random_uuid(),
  acces_id   uuid not null references public.espace_acces(id) on delete cascade,
  ressource  text not null,
  detail     text,
  created_at timestamptz not null default now()
);
create index if not exists idx_espace_consult_acces on public.espace_consultations(acces_id, created_at desc);
alter table public.espace_consultations enable row level security;

drop policy if exists espace_consult_select on public.espace_consultations;
create policy espace_consult_select on public.espace_consultations for select to authenticated
  using (exists (select 1 from public.espace_acces a where a.id = acces_id));

notify pgrst, 'reload schema';
