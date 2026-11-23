/*
  Studio IA — prospection locale (Google Maps via Apify), super-pouvoir de Sam.
  - studio_prospections : une ligne par recherche (activité + zone), avec ses fiches.
    Sert au cloisonnement par espace, au plafond mensuel de fiches et à la relecture
    sans nouveau coût (outils prospects_chercher / prospects_resultats, prospection.ts).
  - studio_config `prospection_fiches_mois` : plafond de fiches par espace et par mois
    (200 par défaut ; 0 = prospection fermée).
  - Sam : super-pouvoir « Trouver des prospects locaux ».
  Rejouable.
*/

create table if not exists public.studio_prospections (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.studio_workspaces(id) on delete cascade,
  agent_id        text,
  conversation_id uuid,
  activite        text not null,
  zone            text not null,
  nombre          int  not null check (nombre between 1 and 50),
  statut          text not null default 'en_cours' check (statut in ('en_cours', 'terminee', 'echec')),
  run_id          text,
  dataset_id      text,
  nb              int,
  resultats       jsonb,
  erreur          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_studio_prospections_ws on public.studio_prospections(workspace_id, created_at desc);
drop trigger if exists trg_studio_prospections_updated on public.studio_prospections;
create trigger trg_studio_prospections_updated before update on public.studio_prospections
  for each row execute function public.set_updated_at();
alter table public.studio_prospections enable row level security;
drop policy if exists studio_prospections_manager on public.studio_prospections;
create policy studio_prospections_manager on public.studio_prospections for select to authenticated using (public.is_manager());

insert into public.studio_config (cle, valeur) values ('prospection_fiches_mois', '200')
on conflict (cle) do nothing;

update public.studio_agents set super_pouvoirs = super_pouvoirs || $j$[
 {"id":"prospects_locaux","titre":"Trouver des prospects locaux","description":"Une liste d'entreprises à contacter, trouvée sur Google Maps, avec l'approche pour chacune.",
  "champs":[{"nom":"activite","label":"Quel type d'entreprise ?","type":"texte","requis":true,"aide":"ex. salon de coiffure, restaurant, expert-comptable"},
            {"nom":"zone","label":"Où ?","type":"texte","requis":true,"aide":"ex. Saint-Pierre, La Réunion"},
            {"nom":"nombre","label":"Combien de fiches ?","type":"choix","options":["10","20","50"]},
            {"nom":"offre","label":"Ce que vous voulez leur proposer","type":"long"}],
  "gabarit":"Trouve des prospects locaux avec l'outil prospects_chercher.\nActivité : {{activite}}\nZone : {{zone}}\nNombre de fiches : {{nombre}}\nCe que je veux leur proposer : {{offre}}\n\nLivre : 1) le tableau des entreprises trouvées, tel que renvoyé par l'outil (aucune donnée inventée ni complétée), avec la référence de la recherche ; 2) les 5 prospects à contacter en premier et pourquoi (note, nombre d'avis, site absent ou présent, rapport avec mon offre) ; 3) un script d'appel de 30 secondes et un e-mail de premier contact de moins de 120 mots, à personnaliser pour chacun ; 4) la prochaine étape concrète. Si l'outil prospects_chercher n'est pas disponible, dis-le simplement au lieu d'inventer une liste."}
]$j$::jsonb
where id = 'sam' and not super_pouvoirs @> '[{"id":"prospects_locaux"}]'::jsonb;

notify pgrst, 'reload schema';
