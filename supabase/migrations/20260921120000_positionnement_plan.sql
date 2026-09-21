/*
  # Positionnement ↔ plan de formation

  Un plan de formation peut être rédigé (par l'IA) à partir des réponses au
  test de positionnement d'un groupe, puis servir de base à la convention.
  `positionnements.plan_id` garde ce lien : on retrouve depuis la convention
  quelles réponses ont fondé le plan, et inversement.
*/

alter table public.positionnements
  add column if not exists plan_id uuid references public.plans_formation(id) on delete set null;

create index if not exists idx_positionnements_plan on public.positionnements(plan_id);

notify pgrst, 'reload schema';
