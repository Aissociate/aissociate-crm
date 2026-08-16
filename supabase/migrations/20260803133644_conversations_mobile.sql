-- Capture mobile — enregistrement d'une conversation depuis le téléphone.
--
-- Usage : le conseiller ouvre /mobile sur son Android (page installable sur
-- l'écran d'accueil), saisit ou choisit le numéro de son interlocuteur, et
-- enregistre l'entretien au micro (appel en haut-parleur ou rendez-vous en
-- présentiel — aucun navigateur n'a accès au flux d'un appel Android).
--
-- L'audio est découpé en segments de quelques minutes, téléversés au fil de
-- l'eau dans le bucket privé « conversations » : si le téléphone se verrouille
-- ou que la page est tuée, tout ce qui précède est déjà en sécurité.
--
-- L'Edge Function `conversation` transcrit ensuite chaque segment, en tire un
-- compte-rendu structuré et le déverse dans le CRM (action sur la fiche
-- contact + relance planifiée).

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),

  -- Rattachement CRM : le numéro est la clé d'entrée côté téléphone, le
  -- contact est résolu à partir de lui (ou créé depuis la page mobile).
  contact_id      uuid references public.contacts(id) on delete set null,
  telephone       text not null,
  titre           text,

  auteur_id       uuid references auth.users(id) on delete set null,
  source          text not null default 'micro' check (source in ('micro', 'import')),

  -- en_cours   : enregistrement en cours côté téléphone
  -- a_traiter  : audio complet, transcription pas encore lancée
  -- traitement : transcription / analyse en cours
  -- traitee    : compte-rendu déversé dans le CRM
  -- erreur     : échec (voir colonne `erreur`), l'audio reste disponible
  statut          text not null default 'en_cours'
                  check (statut in ('en_cours', 'a_traiter', 'traitement', 'traitee', 'erreur')),

  demarree_at     timestamptz not null default now(),
  duree_secondes  integer not null default 0,

  -- [{ index, path, duree, taille, mime }] — chemins dans le bucket privé.
  segments        jsonb not null default '[]'::jsonb,

  transcription   text,
  resume          text,
  -- Compte-rendu structuré renvoyé par l'IA (besoin, formation envisagée,
  -- financement, prochaine action, points clés…). Nommé `compte_rendu` et non
  -- `analyse` : ANALYSE est un mot réservé de PostgreSQL.
  compte_rendu    jsonb,
  action_id       uuid references public.contact_actions(id) on delete set null,
  erreur          text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.conversations is
  'Conversations enregistrées depuis la page mobile : audio segmenté, transcription et compte-rendu déversés dans la fiche contact.';

create index if not exists conversations_contact_idx on public.conversations (contact_id);
create index if not exists conversations_auteur_idx on public.conversations (auteur_id);
create index if not exists conversations_statut_idx on public.conversations (statut);

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Même portée que les actions de contact : la direction voit tout, un
-- conseiller voit ce qu'il a enregistré et ce qui concerne ses contacts.
alter table public.conversations enable row level security;

drop policy if exists conversations_all on public.conversations;
create policy conversations_all on public.conversations
  for all to authenticated
  using (
    public.is_manager()
    or auteur_id = auth.uid()
    or exists (
      select 1 from public.contacts c
      where c.id = conversations.contact_id
        and (c.owner_id = auth.uid() or c.responsable_id = auth.uid())
    )
  )
  with check (
    public.is_manager()
    or auteur_id = auth.uid()
    or exists (
      select 1 from public.contacts c
      where c.id = conversations.contact_id
        and (c.owner_id = auth.uid() or c.responsable_id = auth.uid())
    )
  );

-- ── Stockage de l'audio (bucket privé) ──────────────────────────────────────
-- 50 Mo par segment : très au-delà d'un segment de 5 min en Opus (~1 Mo).
insert into storage.buckets (id, name, public, file_size_limit)
values ('conversations', 'conversations', false, 52428800)
on conflict (id) do nothing;

drop policy if exists conversations_storage_rw on storage.objects;
create policy conversations_storage_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'conversations')
  with check (bucket_id = 'conversations');
