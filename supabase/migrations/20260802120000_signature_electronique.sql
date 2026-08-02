-- Signature électronique interne (niveau « simple » au sens eIDAS).
--
-- Principe commun aux deux usages : un lien tokenisé + un code à usage unique
-- envoyé par e-mail. Le code n'est jamais stocké en clair — seule son empreinte
-- l'est — et chaque validation laisse un journal de preuve (horodatage, IP,
-- agent, empreinte du document avant/après).
--
-- Deux usages :
--   1. `signatures`  — signature d'un document (convention, devis, attestation).
--   2. `emargement_*` — présence par demi-journée. Le code reste valable
--      plusieurs jours : en formation, les stagiaires n'ont pas toujours accès
--      à leur messagerie sur le créneau lui-même. Un repli déclaratif permet au
--      formateur d'attester la présence à leur place, avec motif.

-- ── 1. Signature de document ────────────────────────────────────────────────
create table if not exists public.signatures (
  id                uuid primary key default gen_random_uuid(),
  token             text not null unique default encode(gen_random_bytes(16), 'hex'),

  -- Document signé : chemin dans le Storage + rattachements facultatifs.
  libelle           text not null,
  bucket            text not null default 'plans',
  fichier_url       text not null,
  plan_pdf_id       uuid references public.plan_pdfs(id) on delete set null,
  devis_id          uuid references public.devis(id) on delete set null,
  dossier_id        uuid references public.dossiers(id) on delete set null,

  -- Signataire
  contact_id        uuid references public.contacts(id) on delete set null,
  signataire_nom    text not null,
  signataire_email  text not null,

  -- Code à usage unique (empreinte uniquement)
  code_hash         text,
  code_envoye_at    timestamptz,
  code_expire_at    timestamptz,
  tentatives        integer not null default 0,

  -- Résultat et journal de preuve
  statut            text not null default 'en_attente',  -- en_attente | signee | annulee
  signe_at          timestamptz,
  signature_nom     text,                                 -- nom saisi par le signataire
  fichier_signe_url text,
  hash_avant        text,
  hash_apres        text,
  ip                text,
  user_agent        text,

  expire_at         timestamptz not null default now() + interval '30 days',
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

comment on table public.signatures is
  'Demandes de signature électronique de documents (lien tokenisé + code à usage unique).';

create index if not exists signatures_statut_idx on public.signatures (statut);
create index if not exists signatures_dossier_idx on public.signatures (dossier_id);

-- ── 2. Émargement par demi-journée ──────────────────────────────────────────
create table if not exists public.emargement_creneaux (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions_formation(id) on delete cascade,
  date          date not null,
  demi_journee  text not null check (demi_journee in ('matin', 'apres_midi')),
  heures        numeric(4,2) not null default 3.5,
  created_at    timestamptz not null default now(),
  unique (session_id, date, demi_journee)
);

comment on table public.emargement_creneaux is
  'Demi-journées émargeables d''une session de formation.';

-- Accès d'un participant à l'émargement d'une session : un lien, un code.
create table if not exists public.emargement_acces (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique default encode(gen_random_bytes(16), 'hex'),
  session_id      uuid not null references public.sessions_formation(id) on delete cascade,
  participant_id  uuid not null references public.session_participants(id) on delete cascade,
  code_hash       text,
  code_envoye_at  timestamptz,
  -- Volontairement long : le stagiaire régularise après coup (voir en-tête).
  code_expire_at  timestamptz,
  tentatives      integer not null default 0,
  expire_at       timestamptz not null default now() + interval '60 days',
  created_at      timestamptz not null default now(),
  unique (session_id, participant_id)
);

comment on table public.emargement_acces is
  'Lien et code d''émargement d''un participant pour une session. Le code reste valable plusieurs jours pour permettre la régularisation.';

create table if not exists public.emargement_signatures (
  id              uuid primary key default gen_random_uuid(),
  creneau_id      uuid not null references public.emargement_creneaux(id) on delete cascade,
  participant_id  uuid not null references public.session_participants(id) on delete cascade,
  statut          text not null default 'present' check (statut in ('present', 'absent', 'excuse')),
  -- « code » : signé par le stagiaire ; « declaratif » : attesté par le formateur.
  mode            text not null default 'code' check (mode in ('code', 'declaratif')),
  signe_at        timestamptz not null default now(),
  code_at         timestamptz,
  declare_par     uuid references auth.users(id) on delete set null,
  motif           text,
  ip              text,
  user_agent      text,
  unique (creneau_id, participant_id)
);

comment on table public.emargement_signatures is
  'Présence d''un participant sur une demi-journée : signée par code, ou déclarée par le formateur avec motif.';

create index if not exists emargement_signatures_creneau_idx on public.emargement_signatures (creneau_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Les pages publiques passent par des Edge Functions en service_role : aucune
-- policy « anon » n'est nécessaire. Côté application, tout utilisateur connecté
-- gère les signatures et émargements qu'il voit.
alter table public.signatures enable row level security;
alter table public.emargement_creneaux enable row level security;
alter table public.emargement_acces enable row level security;
alter table public.emargement_signatures enable row level security;

do $$
declare t text;
begin
  foreach t in array array['signatures', 'emargement_creneaux', 'emargement_acces', 'emargement_signatures']
  loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format(
      'create policy %I_all on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;
