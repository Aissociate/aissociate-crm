/*
  # Blog IA : illustration auto des articles

  - Bucket public `blog` : héberge les images générées (URL publique utilisée
    sur le site vitrine).
  - Paramètre `blog.image_model` : modèle de génération d'images OpenRouter
    (gratuit par défaut), configurable dans Paramètres.
*/

insert into storage.buckets (id, name, public) values ('blog', 'blog', true) on conflict (id) do nothing;
drop policy if exists "blog_storage_rw" on storage.objects;
create policy "blog_storage_rw" on storage.objects for all to authenticated
  using (bucket_id = 'blog') with check (bucket_id = 'blog');

update public.parametres
set valeur = valeur || jsonb_build_object(
  'image_model', coalesce(valeur->'image_model', '"google/gemini-2.5-flash-image-preview:free"'::jsonb)
)
where cle = 'blog';

notify pgrst, 'reload schema';
