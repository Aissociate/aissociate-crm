/*
  # 41 — Qualiopi : préparation automatique du dossier de formation

  À la création d'une session (et de ses participants), on provisionne :
   - les documents attendus (checklist niveau B) — collectifs + individuels ;
   - les envois de questionnaires (positionnement / chaud / froid) par apprenant.

  Idempotent (on conflict do nothing) : rejouable sans doublon. Exposé aussi en
  RPC pour un bouton « Préparer le dossier Qualiopi » côté UI.
*/

create or replace function public.qualiopi_prepare_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  -- ── Documents COLLECTIFS (participant_id null) ──
  insert into qualiopi_dossier_docs (session_id, participant_id, indicateur_numero, type_doc, libelle)
  values
    (p_session, null, 4, 'analyse_besoins',     'Analyse du besoin'),
    (p_session, null, 5, 'convention',          'Convention de formation'),
    (p_session, null, 9, 'livret_accueil',      'Livret d''accueil apprenant'),
    (p_session, null, 6, 'emargement',          'État d''émargement'),
    (p_session, null, 6, 'deroule_pedagogique', 'Déroulé pédagogique')
  on conflict do nothing;

  -- ── Documents INDIVIDUELS + envois de questionnaires par participant ──
  for p in select * from session_participants where session_id = p_session loop
    insert into qualiopi_dossier_docs (session_id, participant_id, indicateur_numero, type_doc, libelle)
    values
      (p_session, p.id, 9,  'convocation',            'Convocation'),
      (p_session, p.id, 8,  'positionnement',         'Positionnement à l''entrée'),
      (p_session, p.id, 10, 'livret_suivi',           'Livret de suivi individualisé'),
      (p_session, p.id, 11, 'eval_acquis',            'Évaluation des acquis'),
      (p_session, p.id, 9,  'attestation_fin',        'Attestation de fin de formation'),
      (p_session, p.id, 11, 'certificat_realisation', 'Certificat de réalisation'),
      (p_session, p.id, 30, 'questionnaire_chaud',    'Questionnaire à chaud (preuve)'),
      (p_session, p.id, 30, 'questionnaire_froid',    'Questionnaire à froid (preuve)')
    on conflict do nothing;

    insert into questionnaire_envois
      (modele_code, session_id, participant_id, contact_id, destinataire_nom, destinataire_email)
    select m.code, p_session, p.id, p.contact_id,
           coalesce(nullif(trim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), ''), p.nom),
           p.email
    from questionnaire_modeles m
    where m.code in ('positionnement', 'chaud', 'froid')
    on conflict do nothing;
  end loop;
end $$;

grant execute on function public.qualiopi_prepare_session(uuid) to authenticated;

-- ── Triggers d'auto-provisionnement ──
create or replace function public.trg_qualiopi_on_session()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.qualiopi_prepare_session(new.id);
  return new;
end $$;

drop trigger if exists trg_q_prepare_session on public.sessions_formation;
create trigger trg_q_prepare_session after insert on public.sessions_formation
  for each row execute function public.trg_qualiopi_on_session();

create or replace function public.trg_qualiopi_on_participant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.qualiopi_prepare_session(new.session_id);
  return new;
end $$;

drop trigger if exists trg_q_prepare_participant on public.session_participants;
create trigger trg_q_prepare_participant after insert on public.session_participants
  for each row execute function public.trg_qualiopi_on_participant();
