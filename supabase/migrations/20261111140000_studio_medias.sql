/*
  Studio IA — génération d'images (meta/muse-image) et de vidéos (minimax/hailuo-3-max).

  - Un super-pouvoir marqué "media": "image" | "video" ne passe pas par le chat :
    l'Edge Function `studio` lance la génération et crée une ligne `studio_medias`.
  - Images : générées en tâche de fond (EdgeRuntime.waitUntil), la page interroge l'état.
  - Vidéos : job OpenRouter asynchrone ; chaque interrogation (`media_statut`) vérifie
    le job et, une fois terminé, rapatrie le fichier dans le stockage.
  - Fichiers dans le bucket privé `studio-medias` (URL signées à la volée, jamais publiques).
  - Quotas mensuels séparés : la vidéo coûte cher (~0,08 $/s).
*/

create table if not exists public.studio_medias (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.studio_workspaces(id) on delete cascade,
  user_id         uuid references public.studio_users(id) on delete set null,
  agent_id        text references public.studio_agents(id) on delete set null,
  conversation_id uuid references public.studio_conversations(id) on delete set null,
  type            text not null check (type in ('image', 'video')),
  modele          text not null,
  prompt          text not null,
  parametres      jsonb not null default '{}'::jsonb,   -- aspect_ratio, duration…
  statut          text not null default 'en_cours' check (statut in ('en_cours', 'pret', 'echec')),
  job_id          text,                                 -- vidéo : id du job OpenRouter
  chemin          text,                                 -- chemin dans le bucket studio-medias
  mime            text,
  erreur          text,
  cout            numeric,
  created_at      timestamptz not null default now(),
  termine_at      timestamptz
);
create index if not exists idx_studio_medias_ws on public.studio_medias(workspace_id, created_at desc);

alter table public.studio_messages add column if not exists media_id uuid references public.studio_medias(id) on delete set null;

alter table public.studio_workspaces add column if not exists quota_images_mois integer default 30;
alter table public.studio_workspaces add column if not exists quota_videos_mois integer default 5;

alter table public.studio_medias enable row level security;
drop policy if exists studio_medias_manager on public.studio_medias;
create policy studio_medias_manager on public.studio_medias for select to authenticated using (public.is_manager());

-- Bucket privé (aucune politique storage : seul le service role y accède).
insert into storage.buckets (id, name, public, file_size_limit)
values ('studio-medias', 'studio-medias', false, 104857600)
on conflict (id) do nothing;

-- Super-pouvoirs média de Hugo (ajoutés seulement s'ils n'existent pas encore).
update public.studio_agents
set super_pouvoirs = super_pouvoirs || $j$[
 {"id":"visuel_ia","titre":"Créer un visuel","description":"Une image prête à publier, générée par IA.","media":"image",
  "champs":[{"nom":"sujet","label":"Que doit montrer le visuel ?","type":"long","requis":true,"aide":"ex. une vitrine de boulangerie au lever du jour, croissants dorés"},
            {"nom":"format","label":"Format","type":"choix","requis":true,"options":["1:1","4:5","16:9","9:16"]},
            {"nom":"style","label":"Style","type":"choix","options":["Photo réaliste","Illustration","Minimaliste","3D"]}],
  "gabarit":"{{sujet}}. Style : {{style}}. Image professionnelle pour les réseaux sociaux d'une entreprise, composition soignée, lumière naturelle, aucun texte incrusté."},
 {"id":"video_ia","titre":"Créer une courte vidéo","description":"Une vidéo de quelques secondes pour les réseaux.","media":"video",
  "champs":[{"nom":"scene","label":"Décrivez la scène","type":"long","requis":true,"aide":"ex. travelling lent sur un comptoir de pâtisseries, vapeur qui s'élève"},
            {"nom":"format","label":"Format","type":"choix","requis":true,"options":["9:16","16:9","1:1"]},
            {"nom":"duree","label":"Durée","type":"choix","requis":true,"options":["6","10"]}],
  "gabarit":"{{scene}}. Vidéo courte et professionnelle pour les réseaux sociaux d'une entreprise, mouvement de caméra fluide, rendu réaliste."}
]$j$::jsonb
where id = 'hugo' and not (super_pouvoirs @> '[{"id":"visuel_ia"}]'::jsonb);

notify pgrst, 'reload schema';
