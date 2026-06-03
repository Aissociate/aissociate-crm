/*
  # Lecture publique des formations actives (site vitrine)

  Le site public (visiteur anonyme) doit pouvoir afficher le catalogue de
  formations issu du back-office. On autorise le rôle `anon` à lire uniquement
  les formations ACTIVES (les autres champs/lignes restent privés au CRM).
*/

drop policy if exists formations_public_read on public.formations;
create policy formations_public_read on public.formations
  for select to anon using (actif = true);

notify pgrst, 'reload schema';
