-- Refonte du Studio, lot 4 (§3.4, §3.5) : les tâches planifiées deviennent des routines.
--
-- studio_taches garde son rôle de moteur (planning, exécution horaire, réservation) et reçoit :
--   etapes          chaîne affichée (agent, validation, envoi), pour une routine proposée par Léa ;
--                   null pour une routine tirée d'un modèle (étapes recalculées par le code) et
--                   pour les anciennes tâches (chaîne déduite de l'agent et du titre) ;
--   modele          identifiant du modèle de routine (functions/studio/routines.ts) ;
--   reglages        réglages en langage courant (seuil, ton, bascules, réponse à la question de Léa) ;
--   essai_jusqu_au  fin du mode essai : avant cette date, les passages ne soumettent rien ;
--   essai_signale   la décision « mettre en route ? » a été déposée dans « Aujourd'hui » ;
--   reprise_prevue  nouvel essai automatique après un passage en échec (une seule fois).
--
-- studio_routine_passages : l'historique « Ce qui s'est passé », une ligne par passage.
-- Aucune donnée existante n'est modifiée.

alter table public.studio_taches add column if not exists etapes jsonb;
alter table public.studio_taches add column if not exists modele text;
alter table public.studio_taches add column if not exists reglages jsonb not null default '{}'::jsonb;
alter table public.studio_taches add column if not exists essai_jusqu_au timestamptz;
alter table public.studio_taches add column if not exists essai_signale boolean not null default false;
alter table public.studio_taches add column if not exists reprise_prevue timestamptz;

alter table public.studio_taches drop constraint if exists studio_taches_etapes_check;
alter table public.studio_taches add constraint studio_taches_etapes_check
  check (etapes is null or (jsonb_typeof(etapes) = 'array' and jsonb_array_length(etapes) between 1 and 8));

create index if not exists idx_studio_taches_reprise on public.studio_taches(reprise_prevue) where reprise_prevue is not null;
create index if not exists idx_studio_taches_essai on public.studio_taches(essai_jusqu_au)
  where essai_jusqu_au is not null and not essai_signale;

create table if not exists public.studio_routine_passages (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.studio_workspaces(id) on delete cascade,
  tache_id       uuid not null references public.studio_taches(id) on delete cascade,
  debut          timestamptz not null default now(),
  fin            timestamptz,
  statut         text not null default 'en_cours' check (statut in ('en_cours', 'ok', 'erreur')),
  tentative      smallint not null default 1 check (tentative between 1 and 3),
  essai          boolean not null default false,
  manuel         boolean not null default false,
  compte_rendu   text,
  propositions   jsonb not null default '[]'::jsonb,
  nb_livrables   integer not null default 0,
  conversation_id uuid references public.studio_conversations(id) on delete set null
);
create index if not exists idx_studio_routine_passages_tache on public.studio_routine_passages(tache_id, debut desc);
alter table public.studio_routine_passages enable row level security;
drop policy if exists studio_routine_passages_manager on public.studio_routine_passages;
create policy studio_routine_passages_manager on public.studio_routine_passages for select to authenticated using (public.is_manager());
