/*
  Studio IA — coût réel de chaque client et rentabilité.

  - studio_messages : coût OpenRouter (USD) et tokens de chaque réponse d'agent,
    lus dans le fragment « usage » de fin de flux.
  - studio_workspaces.abonnement_mensuel : ce que le client paie (HT, €/mois),
    renseigné dans la fiche de l'espace (CRM).
  - studio_demo_appels.cout : coût de la démo publique « Sam » (prospection).
  - studio_rentabilite_mois : agrégat mensuel par espace (missions, réponses à
    revoir, coûts texte et médias) pour l'onglet « Rentabilité » du CRM.
    security_invoker : la RLS manager des tables sous-jacentes s'applique.
*/
alter table public.studio_messages add column if not exists cout numeric;
alter table public.studio_messages add column if not exists tokens_entree integer;
alter table public.studio_messages add column if not exists tokens_sortie integer;
alter table public.studio_messages add column if not exists modele text;
alter table public.studio_workspaces add column if not exists abonnement_mensuel numeric;
alter table public.studio_demo_appels add column if not exists cout numeric;

create or replace view public.studio_rentabilite_mois with (security_invoker = true) as
with msg as (
  select workspace_id, date_trunc('month', created_at)::date as mois,
         count(*) filter (where role = 'user')                                   as missions,
         count(*) filter (where role = 'assistant')                              as reponses,
         count(*) filter (where role = 'assistant' and retour = -1)              as a_revoir,
         coalesce(sum(cout), 0)                                                  as cout_texte_usd,
         -- Réponses antérieures au suivi des coûts (ou coût non renvoyé) : à signaler.
         count(*) filter (where role = 'assistant' and media_id is null and cout is null) as sans_cout
  from public.studio_messages
  group by 1, 2
), med as (
  select workspace_id, date_trunc('month', created_at)::date as mois,
         count(*) filter (where type = 'image' and statut <> 'echec') as images,
         count(*) filter (where type = 'video' and statut <> 'echec') as videos,
         coalesce(sum(cout), 0)                                      as cout_medias_usd
  from public.studio_medias
  group by 1, 2
)
select coalesce(msg.workspace_id, med.workspace_id) as workspace_id,
       coalesce(msg.mois, med.mois)                 as mois,
       coalesce(msg.missions, 0)        as missions,
       coalesce(msg.reponses, 0)        as reponses,
       coalesce(msg.a_revoir, 0)        as a_revoir,
       coalesce(msg.sans_cout, 0)       as sans_cout,
       coalesce(med.images, 0)          as images,
       coalesce(med.videos, 0)          as videos,
       coalesce(msg.cout_texte_usd, 0)  as cout_texte_usd,
       coalesce(med.cout_medias_usd, 0) as cout_medias_usd
from msg full join med on med.workspace_id = msg.workspace_id and med.mois = msg.mois;

-- Taux de conversion USD → EUR utilisé par le CRM (modifiable dans l'onglet Rentabilité).
insert into public.studio_config (cle, valeur) values ('taux_usd_eur', '0.92')
on conflict (cle) do nothing;

notify pgrst, 'reload schema';
