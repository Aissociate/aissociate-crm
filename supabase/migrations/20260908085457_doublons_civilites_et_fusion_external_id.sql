-- Détection des doublons insensible aux civilités et à l'ordre prénom/nom,
-- et correction d'un défaut de la fusion de contacts.
--
-- Ticket Benjamin « Dossier & coffre-fort : bug sur contact » : le dossier et
-- les documents d'Olivier Morel n'apparaissaient pas dans sa fiche. Ce n'était
-- pas un défaut d'affichage mais un doublon — l'import CSV de l'ancien CRM
-- plaçait la civilité dans « First Name » et « Prénom Nom » dans « Last Name »,
-- créant une fiche « M. » / « Olivier morel » distincte de « Olivier » / « Morel »,
-- qui portait le dossier et le coffre-fort. 209 fiches étaient dans ce cas.
--
-- La détection ne pouvait pas les voir : elle comparait `prenom || ' ' || nom`,
-- donc « m. olivier morel » ≠ « olivier morel ». La clé de comparaison retire
-- désormais les civilités, les accents et la ponctuation, puis trie les mots :
-- l'ordre prénom/nom n'a plus d'importance non plus (l'import inversait parfois
-- les deux).

create or replace function public.cle_nom_contact(p_prenom text, p_nom text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(array_to_string(
    array(
      select mot from unnest(string_to_array(
        regexp_replace(
          translate(
            lower(trim(coalesce(p_prenom, '') || ' ' || coalesce(p_nom, ''))),
            'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ''-.',
            'aaaaaaceeeeiiiinooooouuuuyy   '
          ),
          '\s+', ' ', 'g'
        ), ' ')) as mot
      where mot <> '' and mot !~ '^(m|mr|mme|mlle|monsieur|madame|mademoiselle|dr|me)$'
      order by mot
    ), ' '), '');
$$;

create or replace function public.contacts_doublons()
returns table(id1 uuid, id2 uuid, raisons text)
language sql
stable
set search_path = public
as $$
  with c as (
    select id,
           lower(nullif(trim(email), '')) as email,
           nullif(regexp_replace(coalesce(telephone, ''), '\D', '', 'g'), '') as tel,
           cle_nom_contact(prenom, nom) as nomc
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

-- Fusion : libérer l'identifiant d'import du doublon AVANT de le transmettre au
-- contact conservé. Sans cela, `uq_contacts_external` rejetait toute fusion où
-- le contact conservé n'avait pas encore d'external_id — la fusion échouait
-- depuis l'interface sur une erreur de clé dupliquée, et c'était précisément le
-- cas de la paire Olivier Morel.
create or replace function public.merge_contacts(p_garde uuid, p_doublon uuid)
returns void
language plpgsql
security definer
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

  -- 2) Libérer l'identifiant d'import avant de le reprendre sur le contact conservé.
  update contacts set external_id = null where id = p_doublon;

  -- 3) Compléter les champs vides du contact conservé.
  update contacts g set
    email       = coalesce(nullif(g.email, ''), v_doublon.email),
    email2      = coalesce(nullif(g.email2, ''), v_doublon.email2),
    telephone   = coalesce(nullif(g.telephone, ''), v_doublon.telephone),
    fonction    = coalesce(nullif(g.fonction, ''), v_doublon.fonction),
    ville       = coalesce(nullif(g.ville, ''), v_doublon.ville),
    siret       = coalesce(nullif(g.siret, ''), v_doublon.siret),
    civilite    = coalesce(nullif(g.civilite, ''), v_doublon.civilite),
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

  -- 4) Empêcher l'import Sheets de recréer le contact supprimé.
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

-- Normalisation des fiches importées : la civilité quitte le prénom. Idempotent
-- (plus aucune ligne ne correspond une fois la reprise faite). Les valeurs
-- d'origine sont conservées dans `contacts_civilite_backup`.
create table if not exists public.contacts_civilite_backup (
  id uuid, civilite text, prenom text, nom text, sauvegarde_le timestamptz
);
alter table public.contacts_civilite_backup enable row level security;
comment on table public.contacts_civilite_backup is
  'Sauvegarde des prénom/nom avant normalisation des civilités issues de l''import CSV (2026-09-08). RLS active sans policy : lecture réservée au service_role.';

insert into public.contacts_civilite_backup (id, civilite, prenom, nom, sauvegarde_le)
select id, civilite, prenom, nom, now() from public.contacts
where prenom ~* '^(m|mme|mlle|mr|monsieur|madame|mademoiselle)\.?$'
  and not exists (select 1 from public.contacts_civilite_backup b where b.id = contacts.id);

-- Nom composé de plusieurs mots : « M. » + « Olivier morel » → « M. » / « Olivier » / « Morel ».
with cible as (
  select id,
         case when prenom ~* '^(mme|madame)\.?$' then 'Mme'
              when prenom ~* '^(mlle|mademoiselle)\.?$' then 'Mlle'
              else 'M.' end as civ,
         initcap(split_part(trim(nom), ' ', 1)) as prenom_reel,
         initcap(trim(substr(trim(nom), length(split_part(trim(nom), ' ', 1)) + 1))) as nom_reel
  from public.contacts
  where prenom ~* '^(m|mme|mlle|mr|monsieur|madame|mademoiselle)\.?$'
    and nom is not null and nom like '% %'
)
update public.contacts c
set civilite = coalesce(nullif(trim(coalesce(c.civilite, '')), ''), t.civ),
    prenom = t.prenom_reel,
    nom = t.nom_reel,
    updated_at = now()
from cible t
where c.id = t.id and t.nom_reel <> '';

-- Nom d'un seul mot : « M. » + « Baronne » = civilité + nom, sans prénom.
update public.contacts set
  civilite = coalesce(nullif(trim(coalesce(civilite, '')), ''),
                      case when prenom ~* '^(mme|madame)\.?$' then 'Mme'
                           when prenom ~* '^(mlle|mademoiselle)\.?$' then 'Mlle' else 'M.' end),
  prenom = null,
  updated_at = now()
where prenom ~* '^(m|mme|mlle|mr|monsieur|madame|mademoiselle)\.?$';
