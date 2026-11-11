/*
  Studio IA — base de connaissances PAR AGENT (savoir-faire d'Aissociate).

  Distincte des ressources d'un client (studio_documents) : ici, la référence
  métier commune à tous les clients (ex. dispositifs de financement pour Nora,
  règles de relance d'impayé pour Maël, bonnes pratiques SEO pour Inès).
  Alimentée depuis CRM › Studio IA clients › Catalogue d'agents. L'agent s'y
  appuie et cite la source ; le contenu brut n'est jamais renvoyé au client.
*/

create table if not exists public.studio_agent_savoirs (
  id         uuid primary key default gen_random_uuid(),
  agent_id   text not null references public.studio_agents(id) on delete cascade,
  titre      text not null,
  -- Référence citée par l'agent : URL, texte officiel, « Guide interne Aissociate 2026 »…
  source     text,
  contenu    text not null default '',
  actif      boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_studio_savoirs_agent on public.studio_agent_savoirs(agent_id, updated_at desc);
create index if not exists idx_studio_savoirs_fts on public.studio_agent_savoirs using gin (
  to_tsvector('french', coalesce(titre, '') || ' ' || coalesce(contenu, ''))
);
drop trigger if exists trg_studio_savoirs_updated on public.studio_agent_savoirs;
create trigger trg_studio_savoirs_updated before update on public.studio_agent_savoirs
  for each row execute function public.set_updated_at();

alter table public.studio_agent_savoirs enable row level security;
drop policy if exists studio_savoirs_manager on public.studio_agent_savoirs;
create policy studio_savoirs_manager on public.studio_agent_savoirs for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- Recherche plein texte dans la base d'UN agent (mêmes règles que studio_recherche_docs).
create or replace function public.studio_recherche_savoirs(p_agent text, p_question text, p_limite int default 3)
returns table (id uuid, titre text, source text, extrait text, rang real)
language sql stable security definer set search_path = public as $$
  with q as (
    select websearch_to_tsquery('french',
      regexp_replace(regexp_replace(left(p_question, 500), '[^[:alnum:][:space:]]', ' ', 'g'), '\s+', ' or ', 'g')) as tsq
  )
  select s.id, s.titre, s.source, left(s.contenu, 5000) as extrait,
         ts_rank(to_tsvector('french', coalesce(s.titre, '') || ' ' || coalesce(s.contenu, '')), q.tsq) as rang
  from public.studio_agent_savoirs s, q
  where s.agent_id = p_agent
    and s.actif
    and to_tsvector('french', coalesce(s.titre, '') || ' ' || coalesce(s.contenu, '')) @@ q.tsq
  order by rang desc
  limit greatest(1, least(p_limite, 6));
$$;
revoke all on function public.studio_recherche_savoirs(text, text, int) from public, anon, authenticated;
grant execute on function public.studio_recherche_savoirs(text, text, int) to service_role;

-- Exemple de départ pour Nora (modifiable ou supprimable dans le CRM).
insert into public.studio_agent_savoirs (agent_id, titre, source, contenu)
select 'nora', 'Financer la formation d''un dirigeant non salarié (TNS)',
  'Guide interne Aissociate — à vérifier auprès du fonds concerné',
  'Les dirigeants non salariés cotisent à un Fonds d''assurance formation (FAF) selon leur activité : AGEFICE pour le commerce, l''industrie et les services (hors professions libérales), FIF PL pour les professions libérales, FAFCEA pour les artisans. Le dossier est généralement déposé AVANT le début de la formation, avec le devis ou le programme, l''attestation de contribution à la formation professionnelle (URSSAF) et l''extrait Kbis ou d''inscription. Les plafonds et critères changent chaque année : toujours vérifier les critères de l''année en cours sur le site du fonds. Aissociate, organisme certifié Qualiopi, accompagne le montage du dossier.'
where not exists (select 1 from public.studio_agent_savoirs where agent_id = 'nora');

notify pgrst, 'reload schema';
