/*
  # Chatbot interne (assistant IA sur l'activite)

  - Parametre chatbot : deux prompts maitres (direction / conseiller) + droits
    de contexte par role. Lu cote serveur par l'Edge Function chatbot.
  - Colonne documents.contenu_texte : texte indexe d'un fichier de l'espace
    documentaire, pour que l'assistant puisse repondre a partir du contenu des fichiers.
*/

alter table public.documents
  add column if not exists contenu_texte text;

insert into public.parametres (cle, valeur, description) values
  ('chatbot',
   jsonb_build_object(
     'prompt_direction',
       'Tu es l''assistant interne de l''organisme de formation. Tu reponds aux questions de la DIRECTION sur l''activite : contacts, dossiers, financements, recrutement, catalogue et base documentaire. Tu as acces a l''ensemble des donnees fournies en contexte. Reponds en francais, de facon precise, factuelle et concise. Cite systematiquement tes sources entre crochets. Si l''information ne figure pas dans le contexte fourni, dis-le clairement sans inventer.',
     'prompt_conseiller',
       'Tu es l''assistant interne destine aux CONSEILLERS. Tu reponds a partir de la base documentaire interne et des contacts/dossiers qui leur sont accessibles. Tu n''as PAS acces aux informations financieres globales ni au recrutement. Reponds en francais, de facon precise et concise. Cite systematiquement tes sources entre crochets. Si l''information ne figure pas dans le contexte fourni, indique-le sans inventer.',
     'droits', jsonb_build_object(
       'conseiller', jsonb_build_object(
         'documents', true, 'contacts', true, 'dossiers', true,
         'formations', true, 'recrutement', false, 'finances', false, 'scope', 'assigned'
       ),
       'direction', jsonb_build_object(
         'documents', true, 'contacts', true, 'dossiers', true,
         'formations', true, 'recrutement', true, 'finances', true, 'scope', 'all'
       )
     )
   ),
   'Assistant IA interne : prompts maitres et droits de contexte par role')
on conflict (cle) do nothing;
