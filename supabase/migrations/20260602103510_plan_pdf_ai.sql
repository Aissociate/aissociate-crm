/*
  # 19 — Génération de plans de formation en PDF (IA OpenRouter)
*/
create table if not exists public.plan_pdfs (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid references public.plans_formation(id) on delete set null,
  titre       text not null,
  apprenant   text,
  organisme   text,
  fichier_url text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_plan_pdfs_created on public.plan_pdfs(created_at desc);
alter table public.plan_pdfs enable row level security;

drop policy if exists plan_pdfs_all on public.plan_pdfs;
create policy plan_pdfs_all on public.plan_pdfs for all to authenticated
  using (true) with check (true);

insert into storage.buckets (id, name, public) values ('plans', 'plans', false)
on conflict (id) do nothing;

drop policy if exists "plans_storage_rw" on storage.objects;
create policy "plans_storage_rw" on storage.objects for all to authenticated
  using (bucket_id = 'plans') with check (bucket_id = 'plans');

insert into public.parametres (cle, valeur, description) values
  ('ai',
   jsonb_build_object(
     'provider', 'openrouter',
     'model', 'anthropic/claude-opus-4.8',
     'openrouter_key', '',
     'plan_prompt',
     'Tu es un ingénieur pédagogique. À partir des données JSON d''un plan de formation, '
     || 'rédige un plan structuré, professionnel et prêt à présenter à un partenaire/financeur. '
     || 'Réponds UNIQUEMENT par un objet JSON valide de la forme '
     || '{"titre": string, "sections": [{"titre": string, "contenu": string}]}. '
     || 'Sections attendues : Présentation, Objectifs pédagogiques, Public visé et prérequis, '
     || 'Programme détaillé, Modalités pédagogiques et d''évaluation, Durée et organisation, '
     || 'Accessibilité et handicap, Tarifs et financement. Style clair, phrases complètes, en français.'
   ),
   'Configuration IA — génération des plans de formation (OpenRouter)')
on conflict (cle) do nothing;
