/*
  # 06 — Policies RLS : application de la matrice des droits (CDC 2.1 / 4.9)

  Principes (EF-DROITS-01) :
    - admin                : acces total partout
    - directeur_commercial : voit/edite tous les dossiers, catalogue, plans
    - conseiller           : voit/edite SES dossiers (owner_id), catalogue en
                             lecture seule, pas de recrutement ni d'export/RGPD

  Helpers : is_admin(), is_manager(), auth_role() (def. dans 01_core).
  Convention : "owned" = visible par le proprietaire OU un manager.
*/

-- ─────────────── PROFILES ───────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all to authenticated
  using (is_admin()) with check (is_admin());

-- ─────────────── FINANCEURS (referentiel : lecture tous, ecriture manager) ───────────────
drop policy if exists financeurs_select on public.financeurs;
create policy financeurs_select on public.financeurs for select to authenticated using (true);
drop policy if exists financeurs_write on public.financeurs;
create policy financeurs_write on public.financeurs for all to authenticated
  using (is_manager()) with check (is_manager());

-- ─────────────── ENTREPRISES (owned) ───────────────
drop policy if exists entreprises_select on public.entreprises;
create policy entreprises_select on public.entreprises for select to authenticated
  using (is_manager() or owner_id = auth.uid());
drop policy if exists entreprises_insert on public.entreprises;
create policy entreprises_insert on public.entreprises for insert to authenticated
  with check (is_manager() or owner_id = auth.uid());
drop policy if exists entreprises_modify on public.entreprises;
create policy entreprises_modify on public.entreprises for update to authenticated
  using (is_manager() or owner_id = auth.uid()) with check (is_manager() or owner_id = auth.uid());
drop policy if exists entreprises_delete on public.entreprises;
create policy entreprises_delete on public.entreprises for delete to authenticated
  using (is_manager() or owner_id = auth.uid());

-- ─────────────── CONTACTS (owned) ───────────────
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select to authenticated
  using (is_manager() or owner_id = auth.uid());
drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts for insert to authenticated
  with check (is_manager() or owner_id = auth.uid());
drop policy if exists contacts_modify on public.contacts;
create policy contacts_modify on public.contacts for update to authenticated
  using (is_manager() or owner_id = auth.uid()) with check (is_manager() or owner_id = auth.uid());
drop policy if exists contacts_delete on public.contacts;
create policy contacts_delete on public.contacts for delete to authenticated
  using (is_manager() or owner_id = auth.uid());

-- ─────────────── OPPORTUNITES (owned) ───────────────
drop policy if exists opp_select on public.opportunites;
create policy opp_select on public.opportunites for select to authenticated
  using (is_manager() or owner_id = auth.uid());
drop policy if exists opp_insert on public.opportunites;
create policy opp_insert on public.opportunites for insert to authenticated
  with check (is_manager() or owner_id = auth.uid());
drop policy if exists opp_modify on public.opportunites;
create policy opp_modify on public.opportunites for update to authenticated
  using (is_manager() or owner_id = auth.uid()) with check (is_manager() or owner_id = auth.uid());
drop policy if exists opp_delete on public.opportunites;
create policy opp_delete on public.opportunites for delete to authenticated
  using (is_manager() or owner_id = auth.uid());

-- ─────────────── FORMATIONS (catalogue : lecture tous, ecriture manager) ───────────────
drop policy if exists formations_select on public.formations;
create policy formations_select on public.formations for select to authenticated using (true);
drop policy if exists formations_write on public.formations;
create policy formations_write on public.formations for all to authenticated
  using (is_manager()) with check (is_manager());

-- ─────────────── PLANS DE FORMATION (owned, creation par tous) ───────────────
drop policy if exists plans_select on public.plans_formation;
create policy plans_select on public.plans_formation for select to authenticated
  using (is_manager() or owner_id = auth.uid());
drop policy if exists plans_insert on public.plans_formation;
create policy plans_insert on public.plans_formation for insert to authenticated
  with check (is_manager() or owner_id = auth.uid());
drop policy if exists plans_modify on public.plans_formation;
create policy plans_modify on public.plans_formation for update to authenticated
  using (is_manager() or owner_id = auth.uid()) with check (is_manager() or owner_id = auth.uid());
drop policy if exists plans_delete on public.plans_formation;
create policy plans_delete on public.plans_formation for delete to authenticated
  using (is_manager() or owner_id = auth.uid());

-- ─────────────── WORKFLOWS + ETAPES (lecture tous, ecriture manager) ───────────────
drop policy if exists wf_select on public.workflows;
create policy wf_select on public.workflows for select to authenticated using (true);
drop policy if exists wf_write on public.workflows;
create policy wf_write on public.workflows for all to authenticated
  using (is_manager()) with check (is_manager());

drop policy if exists wfe_select on public.workflow_etapes;
create policy wfe_select on public.workflow_etapes for select to authenticated using (true);
drop policy if exists wfe_write on public.workflow_etapes;
create policy wfe_write on public.workflow_etapes for all to authenticated
  using (is_manager()) with check (is_manager());

-- ─────────────── DOSSIERS (owned : conseiller voit les siens) ───────────────
drop policy if exists dossiers_select on public.dossiers;
create policy dossiers_select on public.dossiers for select to authenticated
  using (is_manager() or owner_id = auth.uid());
drop policy if exists dossiers_insert on public.dossiers;
create policy dossiers_insert on public.dossiers for insert to authenticated
  with check (is_manager() or owner_id = auth.uid());
drop policy if exists dossiers_modify on public.dossiers;
create policy dossiers_modify on public.dossiers for update to authenticated
  using (is_manager() or owner_id = auth.uid()) with check (is_manager() or owner_id = auth.uid());
drop policy if exists dossiers_delete on public.dossiers;
create policy dossiers_delete on public.dossiers for delete to authenticated
  using (is_manager() or owner_id = auth.uid());

-- ─────────────── PIECES (heritent du dossier parent) ───────────────
drop policy if exists pieces_all on public.dossier_pieces;
create policy pieces_all on public.dossier_pieces for all to authenticated
  using (exists (
    select 1 from public.dossiers d
    where d.id = dossier_id and (is_manager() or d.owner_id = auth.uid())
  ))
  with check (exists (
    select 1 from public.dossiers d
    where d.id = dossier_id and (is_manager() or d.owner_id = auth.uid())
  ));

-- ─────────────── DOCUMENTS (lecture tous, ecriture manager) ───────────────
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select to authenticated using (true);
drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents for all to authenticated
  using (is_manager()) with check (is_manager());

-- ─────────────── KANBAN (collaboratif : tous les authentifies) ───────────────
drop policy if exists boards_all on public.kanban_boards;
create policy boards_all on public.kanban_boards for all to authenticated using (true) with check (true);
drop policy if exists colonnes_all on public.kanban_colonnes;
create policy colonnes_all on public.kanban_colonnes for all to authenticated using (true) with check (true);
drop policy if exists cartes_all on public.kanban_cartes;
create policy cartes_all on public.kanban_cartes for all to authenticated using (true) with check (true);

-- ─────────────── EMAILS (owner ou manager) ───────────────
drop policy if exists emails_select on public.emails;
create policy emails_select on public.emails for select to authenticated
  using (is_manager() or owner_id = auth.uid());
drop policy if exists emails_write on public.emails;
create policy emails_write on public.emails for all to authenticated
  using (is_manager() or owner_id = auth.uid()) with check (is_manager() or owner_id = auth.uid());

-- ─────────────── RECRUTEMENT (manager uniquement — conseiller exclu) ───────────────
drop policy if exists offres_all on public.offres_recrutement;
create policy offres_all on public.offres_recrutement for all to authenticated
  using (is_manager()) with check (is_manager());
drop policy if exists candidats_all on public.candidats;
create policy candidats_all on public.candidats for all to authenticated
  using (is_manager()) with check (is_manager());

-- ─────────────── AUDIT (lecture manager ; ecriture via log_audit) ───────────────
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using (is_manager());

-- ─────────────── PARAMETRES (lecture tous, ecriture admin) ───────────────
drop policy if exists parametres_select on public.parametres;
create policy parametres_select on public.parametres for select to authenticated using (true);
drop policy if exists parametres_write on public.parametres;
create policy parametres_write on public.parametres for all to authenticated
  using (is_admin()) with check (is_admin());
