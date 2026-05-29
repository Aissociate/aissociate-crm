/*
  # 12 — Import Google Sheets : deduplication + offre dediee

  - `candidats.external_id`  : cle externe (id du lead Meta) pour upsert idempotent
  - `contacts.external_id`   : cle externe (email/telephone) pour upsert idempotent
  - Index UNIQUE plein (les NULL restent distincts) -> compatible ON CONFLICT.
  - Seed de l'offre "Charge de formation" (rattachement des candidatures importees).
*/

alter table public.candidats add column if not exists external_id text;
alter table public.contacts  add column if not exists external_id text;

create unique index if not exists uq_candidats_external on public.candidats(external_id);
create unique index if not exists uq_contacts_external  on public.contacts(external_id);

insert into public.offres_recrutement (titre, profil, statut)
select 'Chargé de formation',
       'Profil commercial / pédagogique, à l''aise en indépendant',
       'ouverte'
where not exists (
  select 1 from public.offres_recrutement where titre = 'Chargé de formation'
);
