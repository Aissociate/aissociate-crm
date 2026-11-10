/*
  Qualiopi branché sur les documents réels.

  Constat (audit 2026-11) : la checklist `qualiopi_dossier_docs` restait à
  « à générer » alors que conventions, plans, émargements, positionnements et
  évaluations existaient ailleurs dans le CRM.

  1. `bucket` : la pièce peut désormais pointer un fichier d'un autre bucket
     (plans, pieces) au lieu d'exiger une copie dans « qualiopi ».
     `source = 'auto'` marque les lignes cochées par la synchronisation.
  2. `qualiopi_sync_preuves()` : coche les lignes encore « à générer » dès que
     la preuve existe. Ne touche jamais une ligne déjà traitée à la main.
  3. Déclencheurs : la synchronisation tourne à chaque écriture d'une source.
     Une erreur de synchronisation ne bloque jamais l'écriture d'origine.
  4. `qualiopi_prepare_session` ne provisionne plus `questionnaire_envois`
     (ancien système de questionnaires, jamais utilisé : remplacé par
     positionnement_liens / evaluation_liens).
*/

alter table public.qualiopi_dossier_docs add column if not exists bucket text not null default 'qualiopi';
alter table public.qualiopi_dossier_docs add column if not exists source text;

create or replace function public.qualiopi_sync_preuves()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  total integer := 0;
  n integer;
begin
  -- ── Pièces déposées dans le dossier du participant (preuve la plus forte) ──
  with src as (
    select distinct on (sp.session_id, sp.id, m.type_doc)
           sp.session_id, sp.id as participant_id, m.type_doc, m.collectif, dp.fichier_url, dp.updated_at
    from session_participants sp
    join sessions_formation s on s.id = sp.session_id
    join dossiers d on d.contact_id = sp.contact_id
                   and (s.formation_id is null or d.formation_id is null or d.formation_id = s.formation_id)
    join dossier_pieces dp on dp.dossier_id = d.id and dp.fichier_url is not null
    join (values
      ('convention / contrat de formation', 'convention', true),
      ('feuille d''émargement',             'emargement', true),
      ('programme de formation',            'deroule_pedagogique', true),
      ('convocation',                       'convocation', false)
    ) as m(libelle, type_doc, collectif) on lower(dp.libelle) = m.libelle
    where sp.contact_id is not null
    order by sp.session_id, sp.id, m.type_doc, dp.updated_at desc
  )
  update qualiopi_dossier_docs q
     set statut = 'recu', fichier_url = src.fichier_url, bucket = 'pieces', source = 'auto', genere_at = src.updated_at
    from src
   where q.statut = 'a_generer' and q.session_id = src.session_id and q.type_doc = src.type_doc
     and ((src.collectif and q.participant_id is null) or (not src.collectif and q.participant_id = src.participant_id));
  get diagnostics n = row_count; total := total + n;

  -- ── Convention et plan produits par le CRM (plan_pdfs) ──
  with src as (
    select distinct on (sp.session_id, pp.kind)
           sp.session_id, pp.kind, pp.fichier_url, pp.created_at
    from session_participants sp
    join sessions_formation s on s.id = sp.session_id
    join plans_formation pl on (pl.contact_id = sp.contact_id
                                or pl.dossier_id in (select d.id from dossiers d where d.contact_id = sp.contact_id))
                           and (s.formation_id is null or pl.formation_id is null or pl.formation_id = s.formation_id)
    join plan_pdfs pp on pp.plan_id = pl.id and pp.kind in ('convention', 'plan') and pp.fichier_url is not null
    where sp.contact_id is not null
    order by sp.session_id, pp.kind, pp.created_at desc
  )
  update qualiopi_dossier_docs q
     set statut = 'genere', fichier_url = src.fichier_url, bucket = 'plans', source = 'auto', genere_at = src.created_at
    from src
   where q.statut = 'a_generer' and q.session_id = src.session_id and q.participant_id is null
     and q.type_doc = case src.kind when 'convention' then 'convention' else 'deroule_pedagogique' end;
  get diagnostics n = row_count; total := total + n;

  -- ── Émargement : tous les créneaux signés (ou déclarés) par tous les participants ──
  with src as (
    select c.session_id
    from emargement_creneaux c
    group by c.session_id
    having (select count(*) from emargement_signatures es
             join emargement_creneaux c2 on c2.id = es.creneau_id
            where c2.session_id = c.session_id)
           >= count(*) * greatest(1, (select count(*) from session_participants sp where sp.session_id = c.session_id))
  )
  update qualiopi_dossier_docs q
     set statut = 'signe', source = 'auto', genere_at = now()
    from src
   where q.statut = 'a_generer' and q.session_id = src.session_id and q.participant_id is null and q.type_doc = 'emargement';
  get diagnostics n = row_count; total := total + n;

  -- ── Positionnement à l'entrée ──
  with src as (
    select distinct on (sp.id) sp.id as participant_id, sp.session_id, p.completed_at
    from session_participants sp
    join positionnements p
      on (sp.contact_id is not null and p.contact_id = sp.contact_id)
      or (p.session_id = sp.session_id and (
            (sp.email is not null and lower(p.email) = lower(sp.email))
            or lower(p.nom) like '%' || lower(sp.nom) || '%'))
    order by sp.id, p.completed_at desc
  )
  update qualiopi_dossier_docs q
     set statut = 'recu', source = 'auto', genere_at = src.completed_at
    from src
   where q.statut = 'a_generer' and q.participant_id = src.participant_id and q.type_doc = 'positionnement';
  get diagnostics n = row_count; total := total + n;

  -- ── Évaluations à chaud / à froid ──
  with src as (
    select distinct on (sp.id, e.type) sp.id as participant_id, e.type, e.completed_at
    from session_participants sp
    join evaluations e
      on (e.session_id is null or e.session_id = sp.session_id)
     and ((sp.contact_id is not null and e.contact_id = sp.contact_id)
          or (e.session_id = sp.session_id and sp.email is not null and lower(e.email) = lower(sp.email)))
    order by sp.id, e.type, e.completed_at desc
  )
  update qualiopi_dossier_docs q
     set statut = 'recu', source = 'auto', genere_at = src.completed_at
    from src
   where q.statut = 'a_generer' and q.participant_id = src.participant_id
     and q.type_doc = case src.type when 'chaud' then 'questionnaire_chaud' else 'questionnaire_froid' end;
  get diagnostics n = row_count; total := total + n;

  return total;
end $$;

grant execute on function public.qualiopi_sync_preuves() to authenticated;

-- Déclencheur commun : jamais bloquant pour l'écriture d'origine.
create or replace function public.trg_qualiopi_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  begin
    perform public.qualiopi_sync_preuves();
  exception when others then
    raise warning 'qualiopi_sync_preuves: %', sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists trg_q_sync on public.plan_pdfs;
create trigger trg_q_sync after insert or update on public.plan_pdfs
  for each statement execute function public.trg_qualiopi_sync();
drop trigger if exists trg_q_sync on public.dossier_pieces;
create trigger trg_q_sync after insert or update on public.dossier_pieces
  for each statement execute function public.trg_qualiopi_sync();
drop trigger if exists trg_q_sync on public.positionnements;
create trigger trg_q_sync after insert or update on public.positionnements
  for each statement execute function public.trg_qualiopi_sync();
drop trigger if exists trg_q_sync on public.evaluations;
create trigger trg_q_sync after insert or update on public.evaluations
  for each statement execute function public.trg_qualiopi_sync();
drop trigger if exists trg_q_sync on public.emargement_signatures;
create trigger trg_q_sync after insert or update on public.emargement_signatures
  for each statement execute function public.trg_qualiopi_sync();
drop trigger if exists trg_q_sync on public.session_participants;
create trigger trg_q_sync after insert or update on public.session_participants
  for each statement execute function public.trg_qualiopi_sync();

-- Provisionnement d'une session : checklist seule, plus d'anciens questionnaires.
create or replace function public.qualiopi_prepare_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  p record;
begin
  insert into qualiopi_dossier_docs (session_id, participant_id, indicateur_numero, type_doc, libelle)
  values
    (p_session, null, 4, 'analyse_besoins',     'Analyse du besoin'),
    (p_session, null, 5, 'convention',          'Convention de formation'),
    (p_session, null, 9, 'livret_accueil',      'Livret d''accueil apprenant'),
    (p_session, null, 6, 'emargement',          'État d''émargement'),
    (p_session, null, 6, 'deroule_pedagogique', 'Déroulé pédagogique')
  on conflict do nothing;

  for p in select * from session_participants where session_id = p_session loop
    insert into qualiopi_dossier_docs (session_id, participant_id, indicateur_numero, type_doc, libelle)
    values
      (p_session, p.id, 9,  'convocation',            'Convocation'),
      (p_session, p.id, 8,  'positionnement',         'Positionnement à l''entrée'),
      (p_session, p.id, 10, 'livret_suivi',           'Livret de suivi individualisé'),
      (p_session, p.id, 11, 'eval_acquis',            'Évaluation des acquis'),
      (p_session, p.id, 9,  'attestation_fin',        'Attestation de fin de formation'),
      (p_session, p.id, 11, 'certificat_realisation', 'Certificat de réalisation'),
      (p_session, p.id, 30, 'questionnaire_chaud',    'Évaluation à chaud (preuve)'),
      (p_session, p.id, 30, 'questionnaire_froid',    'Évaluation à froid (preuve)')
    on conflict do nothing;
  end loop;

  perform public.qualiopi_sync_preuves();
end $$;

-- Rattrapage de l'existant.
select public.qualiopi_sync_preuves();
