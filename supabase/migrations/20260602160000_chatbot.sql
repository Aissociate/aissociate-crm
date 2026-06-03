/*
  # Chatbot interne (assistant IA sur l'activité)

  - Paramètre `chatbot` : deux prompts maîtres (direction / conseiller) + droits
    de contexte par rôle (quelles données alimentent l'assistant). Lu côté serveur
    par l'Edge Function `chatbot`.
  - Colonne `documents.contenu_texte` : texte indexé d'un fichier de l'espace
    documentaire (rempli par un futur extracteur), pour que l'assistant puisse
    répondre à partir du CONTENU des fichiers et citer la source.

  Sécurité : la table `parametres` est en lecture réservée aux admins ; la clé IA
  reste côté serveur (Edge Function). Les droits limitent les informations
  accessibles aux conseillers.
*/

alter table public.documents
  add column if not exists contenu_texte text;

insert into public.parametres (cle, valeur, description) values
  ('chatbot',
   jsonb_build_object(
     'prompt_direction',
       'Tu es l''assistant interne de l''organisme de formation. Tu réponds aux questions de la DIRECTION sur l''activité : contacts, dossiers, financements, recrutement, catalogue et base documentaire. Tu as accès à l''ensemble des données fournies en contexte. Réponds en français, de façon précise, factuelle et concise. Cite systématiquement tes sources entre crochets (ex. [D1] pour un document, ou la référence du dossier / le nom du contact). Si l''information ne figure pas dans le contexte fourni, dis-le clairement sans inventer.',
     'prompt_conseiller',
       'Tu es l''assistant interne destiné aux CONSEILLERS. Tu réponds à partir de la base documentaire interne et des contacts/dossiers qui leur sont accessibles. Tu n''as PAS accès aux informations financières globales ni au recrutement. Réponds en français, de façon précise et concise. Cite systématiquement tes sources entre crochets (ex. [D1] pour un document). Si l''information ne figure pas dans le contexte fourni, indique-le sans inventer.',
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
   'Assistant IA interne : prompts maîtres et droits de contexte par rôle')
on conflict (cle) do nothing;
