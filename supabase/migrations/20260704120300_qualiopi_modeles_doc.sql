/*
  # 43 — Qualiopi : modèles de production de documents (publipostage)

  Un modèle Word (.docx) par type de pièce de dossier. Les documents personnalisés
  sont produits en remplaçant les champs de fusion [TOKEN] par les données du
  dossier (organisme / entreprise / formation / session / apprenant).

  Si aucun modèle actif n'existe pour un type_doc, `qualiopi-doc` retombe sur la
  génération pdf-lib générique.
*/
create table if not exists public.qualiopi_modeles_doc (
  type_doc     text primary key,
  titre        text not null,
  fichier_url  text,
  actif        boolean not null default true,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

drop trigger if exists trg_q_modeles_doc_updated on public.qualiopi_modeles_doc;
create trigger trg_q_modeles_doc_updated before update on public.qualiopi_modeles_doc
  for each row execute function public.set_updated_at();

alter table public.qualiopi_modeles_doc enable row level security;

drop policy if exists q_modeles_doc_sel on public.qualiopi_modeles_doc;
create policy q_modeles_doc_sel on public.qualiopi_modeles_doc for select to authenticated using (true);
drop policy if exists q_modeles_doc_wr on public.qualiopi_modeles_doc;
create policy q_modeles_doc_wr on public.qualiopi_modeles_doc for all to authenticated
  using (is_manager()) with check (is_manager());

-- Catalogue des types de pièces personnalisables (libellés ; fichier à téléverser via l'UI).
insert into public.qualiopi_modeles_doc (type_doc, titre, actif) values
  ('convention',             'Convention de formation',          false),
  ('convocation',            'Convocation',                       false),
  ('emargement',             'État d''émargement',                false),
  ('attestation_fin',        'Attestation de fin de formation',   false),
  ('attestation_presence',   'Attestation de présence',           false),
  ('attestation_assiduite',  'Attestation d''assiduité',          false),
  ('certificat_realisation', 'Certificat de réalisation',         false),
  ('livret_accueil',         'Livret d''accueil apprenant',       false),
  ('livret_suivi',           'Livret de suivi individualisé',     false),
  ('analyse_besoins',        'Analyse du besoin',                 false),
  ('deroule_pedagogique',    'Déroulé pédagogique',               false),
  ('positionnement',         'Positionnement à l''entrée',        false),
  ('eval_acquis',            'Évaluation des acquis',             false)
on conflict (type_doc) do nothing;
