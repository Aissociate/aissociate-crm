/*
  # Évaluations de fin de formation — à chaud et à froid (J+30)

  Qualiopi indicateurs 11 (atteinte des objectifs) et 30 (appréciations des
  parties prenantes). Même mécanique que le test de positionnement : un lien
  tokenisé `/evaluation/:token`, nominatif ou de groupe, sans que l'apprenant
  ait à exister en base ; l'identité est déclarée par le répondant.

  - `evaluation_liens` : un lien, de type `chaud` (fin de formation) ou
    `froid` (retour d'expérience, envoyé à J+30). `envoi_prevu_le` porte
    l'échéance d'envoi : date de fin de formation + 30 jours pour un froid.
    `source_evaluation_id` relie un froid à la réponse à chaud qui l'a fait
    naître (programmation « J+30 pour les répondants à chaud »), ce qui évite
    de programmer deux fois le même apprenant.
  - `evaluations` : une réponse. Questionnaire générique (indépendant de la
    thématique de la formation) ; les réponses brutes sont conservées avec la
    note pour pouvoir tout recalculer si le barème évolue.

  RLS : alignée sur le positionnement — tout utilisateur authentifié. L'accès
  public passe par l'Edge Function `evaluation` (service role + token).
*/

create table if not exists public.evaluation_liens (
  id                   uuid primary key default gen_random_uuid(),
  token                text not null unique default encode(gen_random_bytes(16), 'hex'),
  type                 text not null check (type in ('chaud', 'froid')),
  libelle              text not null,
  contact_id           uuid references public.contacts(id) on delete set null,
  destinataire_nom     text,
  destinataire_email   text,
  dossier_id           uuid references public.dossiers(id) on delete set null,
  session_id           uuid references public.sessions_formation(id) on delete set null,
  formation_intitule   text,
  date_fin_formation   date,
  -- Échéance d'envoi (J+30 de la fin pour un froid) ; null = envoi libre.
  envoi_prevu_le       date,
  source_evaluation_id uuid,
  multi                boolean not null default false,
  actif                boolean not null default true,
  statut               text not null default 'a_envoyer'
                         check (statut in ('a_envoyer', 'envoye', 'relance', 'complete', 'clos')),
  sent_at              timestamptz,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_eval_liens_contact on public.evaluation_liens(contact_id);
create index if not exists idx_eval_liens_dossier on public.evaluation_liens(dossier_id);
create index if not exists idx_eval_liens_echeance on public.evaluation_liens(envoi_prevu_le) where statut = 'a_envoyer';
alter table public.evaluation_liens enable row level security;

drop trigger if exists trg_eval_liens_updated on public.evaluation_liens;
create trigger trg_eval_liens_updated before update on public.evaluation_liens
  for each row execute function public.set_updated_at();

drop policy if exists evaluation_liens_all on public.evaluation_liens;
create policy evaluation_liens_all on public.evaluation_liens for all to authenticated
  using (true) with check (true);

create table if not exists public.evaluations (
  id                 uuid primary key default gen_random_uuid(),
  type               text not null check (type in ('chaud', 'froid')),
  lien_id            uuid references public.evaluation_liens(id) on delete set null,
  contact_id         uuid references public.contacts(id) on delete set null,
  dossier_id         uuid references public.dossiers(id) on delete set null,
  session_id         uuid references public.sessions_formation(id) on delete set null,
  nom                text not null default '',
  email              text,
  organisation       text,
  poste              text,
  formation_intitule text,
  origine            text not null default 'apprenant'
                       check (origine in ('apprenant', 'formateur')),
  reponses           jsonb not null default '{}'::jsonb,
  -- Moyenne des échelles 1-5 et recommandation 0-10.
  note_globale       numeric(3,1),
  pct                int,
  nps                int,
  synthese           text,
  document_id        uuid references public.dossier_documents(id) on delete set null,
  saisi_par          uuid references public.profiles(id) on delete set null,
  completed_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_evaluations_lien on public.evaluations(lien_id);
create index if not exists idx_evaluations_contact on public.evaluations(contact_id);
create index if not exists idx_evaluations_dossier on public.evaluations(dossier_id);
create index if not exists idx_evaluations_date on public.evaluations(completed_at desc);
alter table public.evaluations enable row level security;

alter table public.evaluation_liens drop constraint if exists evaluation_liens_source_fk;
alter table public.evaluation_liens add constraint evaluation_liens_source_fk
  foreign key (source_evaluation_id) references public.evaluations(id) on delete set null;

drop trigger if exists trg_evaluations_updated on public.evaluations;
create trigger trg_evaluations_updated before update on public.evaluations
  for each row execute function public.set_updated_at();

drop policy if exists evaluations_all on public.evaluations;
create policy evaluations_all on public.evaluations for all to authenticated
  using (true) with check (true);

notify pgrst, 'reload schema';
