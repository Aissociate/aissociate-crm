-- Formation « sur mesure » définie depuis un dossier.
-- L'écriture du catalogue est réservée aux managers (formations_write) : cette
-- fonction laisse tout utilisateur ayant la main sur le dossier créer une
-- formation hors catalogue public (actif = false) et la rattacher au dossier.
create or replace function public.creer_formation_sur_mesure(
  p_dossier uuid, p_intitule text, p_duree_heures numeric default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  if coalesce(btrim(p_intitule), '') = '' then raise exception 'Intitulé requis'; end if;
  if not exists (
    select 1 from dossiers d where d.id = p_dossier and (is_manager() or d.owner_id = auth.uid())
  ) then raise exception 'Dossier introuvable ou non autorisé'; end if;

  insert into formations (intitule, duree_heures, actif, programme)
  values (btrim(p_intitule), coalesce(round(p_duree_heures), 0)::int, false, '[]'::jsonb)
  returning id into v_id;

  update dossiers set formation_id = v_id where id = p_dossier;
  return v_id;
end $$;

revoke all on function public.creer_formation_sur_mesure(uuid, text, numeric) from public, anon;
grant execute on function public.creer_formation_sur_mesure(uuid, text, numeric) to authenticated;
