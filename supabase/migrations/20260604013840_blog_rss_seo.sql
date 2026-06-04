/*
  # Blog IA : flux RSS de veille + mots-clés SEO

  Complète le paramètre `blog` existant avec :
   - `rss_feeds` : flux RSS d'actualité IA, source de la veille pour les articles.
   - `seo_keywords` : mots-clés SEO à intégrer dans les articles.
  Valeurs ajoutées seulement si absentes (n'écrase pas un réglage existant).
*/

update public.parametres
set valeur = valeur || jsonb_build_object(
  'rss_feeds', coalesce(valeur->'rss_feeds', jsonb_build_array(
    'https://news.google.com/rss/search?q=intelligence%20artificielle%20entreprise&hl=fr&gl=FR&ceid=FR:fr',
    'https://www.actuia.com/feed/'
  )),
  'seo_keywords', coalesce(valeur->'seo_keywords', jsonb_build_array(
    'formation IA', 'intelligence artificielle', 'IA générative', 'CPF',
    'PME', 'automatisation', 'Qualiopi', 'OPCO', 'transformation digitale'
  ))
)
where cle = 'blog';

insert into public.parametres (cle, valeur, description)
select 'blog',
  jsonb_build_object(
    'rss_feeds', jsonb_build_array(
      'https://news.google.com/rss/search?q=intelligence%20artificielle%20entreprise&hl=fr&gl=FR&ceid=FR:fr',
      'https://www.actuia.com/feed/'),
    'seo_keywords', jsonb_build_array('formation IA','intelligence artificielle','IA générative','CPF','PME','automatisation','Qualiopi','OPCO'),
    'auto_publish', false, 'use_web', true
  ),
  'Blog IA : prompt, thèmes, flux RSS, mots-clés SEO'
where not exists (select 1 from public.parametres where cle = 'blog');

notify pgrst, 'reload schema';
