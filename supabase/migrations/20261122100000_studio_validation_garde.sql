-- Studio IA — garde de la machine à états des livrables (refonte, lot 1, §4.1).
-- La règle vit déjà dans supabase/functions/studio/livrables.ts ; ce déclencheur la
-- répète en base pour qu'aucune écriture (fonction, script, correction à la main) ne
-- puisse passer un livrable à « validé » ou « publié » sans décision enregistrée,
-- ni à « publié » sans être passé par « validé ».
-- Seulement sur changement de statut : les lignes existantes et les restaurations
-- de sauvegarde (insertions) ne sont pas concernées.

create or replace function public.studio_livrables_garde() returns trigger
language plpgsql as $$
begin
  if new.statut in ('valide', 'publie') and new.decide_par is null then
    raise exception 'Livrable % : statut « % » impossible sans décision enregistrée (decide_par).', new.id, new.statut;
  end if;
  if new.statut = 'publie' and old.statut <> 'valide' then
    raise exception 'Livrable % : « publié » exige d''être passé par « validé » (statut actuel : %).', new.id, old.statut;
  end if;
  return new;
end $$;

drop trigger if exists trg_studio_livrables_garde on public.studio_livrables;
create trigger trg_studio_livrables_garde before update of statut on public.studio_livrables
  for each row when (old.statut is distinct from new.statut)
  execute function public.studio_livrables_garde();
