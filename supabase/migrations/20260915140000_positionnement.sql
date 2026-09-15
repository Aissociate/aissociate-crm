/*
  # Test de positionnement (lien personnel, apprenant hors base)

  Qualiopi indicateur 4 : le positionnement d'entrée doit être tracé pour chaque
  apprenant. Les questionnaires Qualiopi existants supposent un participant
  inscrit en base ; or un positionnement se diffuse en amont, souvent à un
  groupe entier dont l'organisme n'a pas encore la liste nominative.

  - `positionnement_liens` : un lien tokenisé `/positionnement/:token`.
    Tout y est facultatif — contact, dossier, session, destinataire : un lien
    peut être nominatif (une personne connue) ou `multi` (partagé au groupe,
    réutilisable, autant de réponses que d'apprenants). L'identité est alors
    déclarée par le répondant lui-même.
  - `positionnements` : une réponse. `lien_id` est nullable : le formateur
    peut FABRIQUER un positionnement depuis le CRM quand l'apprenant est
    absent ou n'a pas répondu (`origine = 'formateur'`), sans lien préalable.
    `contact_id` l'est aussi : un apprenant hors base n'a qu'un nom déclaré.
  - Rattachement au dossier client : `dossier_id` + `document_id` qui garde la
    trace de la synthèse déposée dans « Autres documents » du dossier.

  RLS : alignée sur les questionnaires Qualiopi — tout utilisateur authentifié
  (le formateur qui anime la session n'est pas forcément le conseiller du
  contact). L'accès public passe par l'Edge Function `positionnement`
  (service role + token), jamais par la RLS.
*/

create table if not exists public.positionnement_liens (
  id                 uuid primary key default gen_random_uuid(),
  token              text not null unique default encode(gen_random_bytes(16), 'hex'),
  libelle            text not null default 'Test de positionnement — l''IA dans votre métier',
  -- Destinataire connu : facultatif (un lien de groupe n'en a pas).
  contact_id         uuid references public.contacts(id) on delete set null,
  destinataire_nom   text,
  destinataire_email text,
  -- Rattachements facultatifs, hérités par les réponses.
  dossier_id         uuid references public.dossiers(id) on delete set null,
  session_id         uuid references public.sessions_formation(id) on delete set null,
  formation_intitule text,
  -- Lien de groupe : réutilisable, accepte plusieurs réponses.
  multi              boolean not null default false,
  actif              boolean not null default true,
  statut             text not null default 'a_envoyer'
                       check (statut in ('a_envoyer', 'envoye', 'relance', 'complete', 'clos')),
  sent_at            timestamptz,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_pos_liens_contact on public.positionnement_liens(contact_id);
create index if not exists idx_pos_liens_dossier on public.positionnement_liens(dossier_id);
alter table public.positionnement_liens enable row level security;

drop trigger if exists trg_pos_liens_updated on public.positionnement_liens;
create trigger trg_pos_liens_updated before update on public.positionnement_liens
  for each row execute function public.set_updated_at();

drop policy if exists positionnement_liens_all on public.positionnement_liens;
create policy positionnement_liens_all on public.positionnement_liens for all to authenticated
  using (true) with check (true);

create table if not exists public.positionnements (
  id                 uuid primary key default gen_random_uuid(),
  lien_id            uuid references public.positionnement_liens(id) on delete set null,
  contact_id         uuid references public.contacts(id) on delete set null,
  dossier_id         uuid references public.dossiers(id) on delete set null,
  session_id         uuid references public.sessions_formation(id) on delete set null,
  -- Identité DÉCLARÉE dans le formulaire : seule source pour un apprenant
  -- absent de la base, d'où sa présence en colonnes propres et non en jsonb.
  nom                text not null default '',
  email              text,
  organisation       text,
  poste              text,
  secteur            text,
  formation_intitule text,
  -- 'formateur' = positionnement reconstitué depuis le CRM (apprenant absent).
  origine            text not null default 'apprenant'
                       check (origine in ('apprenant', 'formateur')),
  -- Réponses brutes : permettent de recalculer le score si le barème évolue.
  reponses           jsonb not null default '{}'::jsonb,
  -- { got, max, pct, niveau, domaines: { cle: { got, max, pct } } }
  score              jsonb,
  niveau             text,
  pct                int,
  synthese           text,
  -- Trace de l'ajout au dossier client (« Autres documents »).
  document_id        uuid references public.dossier_documents(id) on delete set null,
  saisi_par          uuid references public.profiles(id) on delete set null,
  completed_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_positionnements_lien on public.positionnements(lien_id);
create index if not exists idx_positionnements_contact on public.positionnements(contact_id);
create index if not exists idx_positionnements_dossier on public.positionnements(dossier_id);
create index if not exists idx_positionnements_date on public.positionnements(completed_at desc);
alter table public.positionnements enable row level security;

drop trigger if exists trg_positionnements_updated on public.positionnements;
create trigger trg_positionnements_updated before update on public.positionnements
  for each row execute function public.set_updated_at();

drop policy if exists positionnements_all on public.positionnements;
create policy positionnements_all on public.positionnements for all to authenticated
  using (true) with check (true);

notify pgrst, 'reload schema';
