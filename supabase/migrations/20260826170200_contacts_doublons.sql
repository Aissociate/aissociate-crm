/*
  # Doublons de contacts — détection + fusion

  - `contacts_doublons()` : paires de contacts probablement identiques
    (même e-mail, même téléphone — 9 derniers chiffres —, ou même nom+prénom).
    SECURITY INVOKER : la RLS de `contacts` s'applique, un conseiller ne voit
    que les doublons parmi ses propres contacts.
  - `merge_contacts(garde, doublon)` : réservé à la direction. Réaffecte TOUTES
    les références (FK découvertes dynamiquement → robuste aux tables futures),
    complète les champs vides du contact conservé, inscrit l'external_id du
    doublon dans `import_exclusions` (l'import Sheets ne le recréera pas),
    puis supprime le doublon.
*/

create or replace function public.contacts_doublons()
returns table(id1 uuid, id2 uuid, raisons text)
language sql stable
set search_path = public
as $$
  with c as (
    select id,
           lower(nullif(trim(email), '')) as email,
           nullif(regexp_replace(coalesce(telephone, ''), '\D', '', 'g'), '') as tel,
           lower(trim(coalesce(prenom, '') || ' ' || coalesce(nom, ''))) as nomc
    from contacts
  ), paires as (
    select a.id as id1, b.id as id2, 'e-mail identique' as raison
      from c a join c b on a.email = b.email and a.id < b.id
      where a.email is not null
    union
    select a.id, b.id, 'téléphone identique'
      from c a join c b on right(a.tel, 9) = right(b.tel, 9) and a.id < b.id
      where a.tel is not null and length(a.tel) >= 9 and b.tel is not null and length(b.tel) >= 9
    union
    select a.id, b.id, 'nom + prénom identiques'
      from c a join c b on a.nomc = b.nomc and a.id < b.id
      where length(a.nomc) > 3
  )
  select id1, id2, string_agg(raison, ' + ' order by raison)
  from paires group by id1, id2;
$$;

create or replace function public.merge_contacts(p_garde uuid, p_doublon uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  r record;
  v_garde contacts%rowtype;
  v_doublon contacts%rowtype;
begin
  if not is_manager() then
    raise exception 'Fusion réservée à la direction';
  end if;
  if p_garde = p_doublon then
    raise exception 'Impossible de fusionner un contact avec lui-même';
  end if;
  select * into v_garde from contacts where id = p_garde;
  if not found then raise exception 'Contact à conserver introuvable'; end if;
  select * into v_doublon from contacts where id = p_doublon;
  if not found then raise exception 'Contact doublon introuvable'; end if;

  -- 1) Réaffecter toutes les références au doublon vers le contact conservé.
  for r in
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_name = 'contacts' and ccu.column_name = 'id'
      and tc.table_name <> 'contacts'
  loop
    execute format('update public.%I set %I = $1 where %I = $2', r.table_name, r.column_name, r.column_name)
      using p_garde, p_doublon;
  end loop;

  -- 2) Compléter les champs vides du contact conservé.
  update contacts g set
    email       = coalesce(nullif(g.email, ''), v_doublon.email),
    email2      = coalesce(nullif(g.email2, ''), v_doublon.email2),
    telephone   = coalesce(nullif(g.telephone, ''), v_doublon.telephone),
    fonction    = coalesce(nullif(g.fonction, ''), v_doublon.fonction),
    ville       = coalesce(nullif(g.ville, ''), v_doublon.ville),
    siret       = coalesce(nullif(g.siret, ''), v_doublon.siret),
    entreprise_id = coalesce(g.entreprise_id, v_doublon.entreprise_id),
    financeur_id  = coalesce(g.financeur_id, v_doublon.financeur_id),
    owner_id      = coalesce(g.owner_id, v_doublon.owner_id),
    external_id   = coalesce(g.external_id, v_doublon.external_id),
    tags        = (select coalesce(array_agg(distinct t), '{}')
                   from unnest(coalesce(g.tags, '{}') || coalesce(v_doublon.tags, '{}')) as t),
    notes       = case
                    when nullif(v_doublon.notes, '') is null then g.notes
                    when coalesce(g.notes, '') = '' then v_doublon.notes
                    when position(v_doublon.notes in g.notes) > 0 then g.notes
                    else g.notes || e'\n\n— Notes du doublon fusionné —\n' || v_doublon.notes
                  end
  where g.id = p_garde;

  -- 3) Empêcher l'import Sheets de recréer le contact supprimé.
  if v_doublon.external_id is not null and v_doublon.external_id <> coalesce(v_garde.external_id, '') then
    begin
      insert into import_exclusions(source, external_id, nom, email, deleted_at)
      values ('fusion_doublon', v_doublon.external_id,
              trim(coalesce(v_doublon.prenom, '') || ' ' || coalesce(v_doublon.nom, '')),
              v_doublon.email, now());
    exception when others then null; -- déjà exclu : sans conséquence
    end;
  end if;

  delete from contacts where id = p_doublon;
end;
$$;

revoke all on function public.merge_contacts(uuid, uuid) from public;
grant execute on function public.merge_contacts(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
