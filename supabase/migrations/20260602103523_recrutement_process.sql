/*
  # 20 — Structuration du processus de recrutement
*/
alter table public.candidats add column if not exists ville text;
alter table public.candidats add column if not exists statut_entreprise text;
alter table public.candidats add column if not exists siret text;
alter table public.candidats add column if not exists document_identite boolean not null default false;
alter table public.candidats add column if not exists profil_details text;
alter table public.candidats add column if not exists historique text;
alter table public.candidats add column if not exists prochaine_action text;
alter table public.candidats add column if not exists date_prochaine_action date;
alter table public.candidats add column if not exists note_experience smallint;
alter table public.candidats add column if not exists note_conversation smallint;
alter table public.candidats add column if not exists note_autonomie smallint;
alter table public.candidats add column if not exists note_comprehension smallint;
alter table public.candidats add column if not exists note_motivation smallint;
alter table public.candidats add column if not exists score_total smallint not null default 0;
alter table public.candidats add column if not exists avis text;
alter table public.candidats add column if not exists contract_etape1 boolean not null default false;
alter table public.candidats add column if not exists contract_etape2 boolean not null default false;
alter table public.candidats add column if not exists contract_etape3 boolean not null default false;
alter table public.candidats add column if not exists contract_etape4 boolean not null default false;
