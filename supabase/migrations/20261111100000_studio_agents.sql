/*
  # Studio IA — espace agentique des entreprises clientes (module isolé)

  Les entreprises qui souscrivent à l'offre « agents IA » d'Aissociate reçoivent
  un accès email + mot de passe à `/studio`. Elles y travaillent avec une équipe
  d'agents IA spécialisés (assistant général, marketing, commercial, …) nourris
  du contexte de leur entreprise et de leur base de connaissances.

  ISOLATION (choix structurant) :
  - Les comptes clients NE SONT PAS des utilisateurs Supabase Auth. Une vingtaine
    de politiques RLS du CRM ouvrent les lectures à tout rôle `authenticated` :
    un client muni d'un JWT Supabase verrait donc des données du CRM. Le Studio a
    sa propre authentification (hash PBKDF2 + jeton de session opaque), gérée
    exclusivement par l'Edge Function `studio` (service role).
  - Toutes les tables sont préfixées `studio_` et ne référencent le CRM que par
    `studio_workspaces.entreprise_id` (facultatif, ON DELETE SET NULL).
  - RLS : aucune politique pour `anon`. Côté CRM, seuls les managers
    (is_manager()) administrent les espaces. Les tables sensibles
    (identifiants, sessions, échecs de connexion) n'ont AUCUNE politique :
    service role uniquement.
*/

-- 1) Espaces (une entreprise cliente = un espace) ----------------------------
create table if not exists public.studio_workspaces (
  id                  uuid primary key default gen_random_uuid(),
  nom                 text not null,
  entreprise_id       uuid references public.entreprises(id) on delete set null,
  offre               text not null default 'essentiel' check (offre in ('essentiel', 'pro', 'sur_mesure')),
  secteur             text,
  taille              text,               -- « 1 », « 2-4 », « 5-9 », « 10-49 », « 50+ »
  -- Nombre d'accès inclus au contrat (refus de créer au-delà).
  max_utilisateurs    integer not null default 5,
  actif               boolean not null default true,
  -- Plafond mensuel de messages envoyés aux agents (null = illimité).
  quota_messages_mois integer default 300,
  -- Fiche d'identité injectée dans chaque agent : activité, cibles, ton, offres…
  contexte_entreprise text not null default '',
  -- Date de fin d'abonnement / d'essai (null = sans échéance).
  expire_le           date,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 2) Utilisateurs clients -------------------------------------------------------
create table if not exists public.studio_users (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.studio_workspaces(id) on delete cascade,
  email         text not null check (email = lower(email)),
  prenom        text,
  nom           text,
  role          text not null default 'membre' check (role in ('proprietaire', 'membre')),
  actif         boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);
create unique index if not exists uq_studio_users_email on public.studio_users (lower(email));
create index if not exists idx_studio_users_ws on public.studio_users(workspace_id);

-- Identifiants : séparés pour ne jamais exposer le hash, même aux managers.
create table if not exists public.studio_credentials (
  user_id       uuid primary key references public.studio_users(id) on delete cascade,
  password_hash text not null,
  doit_changer  boolean not null default true,
  updated_at    timestamptz not null default now()
);

-- Sessions : on ne stocke que le SHA-256 du jeton remis au navigateur.
create table if not exists public.studio_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.studio_users(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists idx_studio_sessions_user on public.studio_sessions(user_id);

-- Anti brute-force : échecs de connexion (fenêtre glissante dans l'Edge Function).
create table if not exists public.studio_login_echecs (
  id         bigserial primary key,
  email      text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_studio_echecs on public.studio_login_echecs(lower(email), created_at desc);

-- 3) Catalogue d'agents (commun, édité depuis le CRM) ------------------------
create table if not exists public.studio_agents (
  id              text primary key,                -- slug : 'lea', 'hugo', …
  prenom          text not null,
  metier          text not null,                   -- « Assistante générale »
  accroche        text not null default '',        -- 1re personne, une phrase
  description     text not null default '',
  prompt_systeme  text not null default '',
  -- Demandes prêtes à l'emploi affichées en boutons : [{titre, prompt}]
  demandes        jsonb not null default '[]'::jsonb,
  -- Super-pouvoirs : missions cadrées par un formulaire (le cœur de l'agent).
  -- [{id, titre, description, champs:[{nom, label, type:'texte'|'long'|'choix', options?, requis?, aide?}], gabarit}]
  -- `gabarit` (consigne détaillée avec {{nom}}) reste côté serveur.
  super_pouvoirs  jsonb not null default '[]'::jsonb,
  -- Valeur démontrée : minutes économisées estimées par réponse utile.
  minutes_par_tache integer not null default 15,
  couleur         text not null default '#f97316',
  offres          text[] not null default array['essentiel', 'pro', 'sur_mesure'],
  ordre           integer not null default 0,
  actif           boolean not null default true,
  updated_at      timestamptz not null default now()
);

-- Consignes spécifiques d'un espace pour un agent (facultatif) + désactivation.
create table if not exists public.studio_workspace_agents (
  workspace_id uuid not null references public.studio_workspaces(id) on delete cascade,
  agent_id     text not null references public.studio_agents(id) on delete cascade,
  actif        boolean not null default true,
  consignes    text not null default '',
  primary key (workspace_id, agent_id)
);

-- 4) Conversations, messages, base de connaissances ---------------------------
create table if not exists public.studio_conversations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.studio_workspaces(id) on delete cascade,
  user_id      uuid not null references public.studio_users(id) on delete cascade,
  agent_id     text not null references public.studio_agents(id) on delete cascade,
  titre        text not null default 'Nouvelle conversation',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_studio_conv on public.studio_conversations(workspace_id, user_id, updated_at desc);

create table if not exists public.studio_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.studio_conversations(id) on delete cascade,
  workspace_id    uuid not null references public.studio_workspaces(id) on delete cascade,
  agent_id        text references public.studio_agents(id) on delete set null,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null default '',
  -- Note de l'utilisateur sur la réponse (1 = utile, -1 = à revoir).
  retour          smallint check (retour in (-1, 1)),
  -- Réponse conservée dans « Mes créations ».
  epingle         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_studio_msg_conv on public.studio_messages(conversation_id, created_at);
create index if not exists idx_studio_msg_ws on public.studio_messages(workspace_id, created_at desc);

create table if not exists public.studio_documents (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.studio_workspaces(id) on delete cascade,
  titre        text not null,
  -- 'fichier' (texte extrait d'un fichier importé) ou 'note' (saisie libre).
  type         text not null default 'note' check (type in ('fichier', 'note')),
  format       text,                      -- pdf, txt, md, csv…
  taille       integer,                   -- octets du fichier d'origine
  contenu      text not null default '',
  -- Interrupteur « utilisé par les agents » (cf. Ressources dans l'app).
  actif        boolean not null default true,
  created_by   uuid references public.studio_users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_studio_docs_ws on public.studio_documents(workspace_id, created_at desc);
create index if not exists idx_studio_docs_fts on public.studio_documents using gin (
  to_tsvector('french', coalesce(titre, '') || ' ' || coalesce(contenu, ''))
);

-- updated_at automatiques
drop trigger if exists trg_studio_ws_updated on public.studio_workspaces;
create trigger trg_studio_ws_updated before update on public.studio_workspaces
  for each row execute function public.set_updated_at();
drop trigger if exists trg_studio_conv_updated on public.studio_conversations;
create trigger trg_studio_conv_updated before update on public.studio_conversations
  for each row execute function public.set_updated_at();
drop trigger if exists trg_studio_agents_updated on public.studio_agents;
create trigger trg_studio_agents_updated before update on public.studio_agents
  for each row execute function public.set_updated_at();

-- 5) RLS ------------------------------------------------------------------------
alter table public.studio_workspaces       enable row level security;
alter table public.studio_users            enable row level security;
alter table public.studio_credentials      enable row level security;
alter table public.studio_sessions         enable row level security;
alter table public.studio_login_echecs     enable row level security;
alter table public.studio_agents           enable row level security;
alter table public.studio_workspace_agents enable row level security;
alter table public.studio_conversations    enable row level security;
alter table public.studio_messages         enable row level security;
alter table public.studio_documents        enable row level security;

-- Administration depuis le CRM : managers uniquement.
drop policy if exists studio_ws_manager on public.studio_workspaces;
create policy studio_ws_manager on public.studio_workspaces for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists studio_users_manager on public.studio_users;
create policy studio_users_manager on public.studio_users for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists studio_agents_manager on public.studio_agents;
create policy studio_agents_manager on public.studio_agents for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists studio_wsa_manager on public.studio_workspace_agents;
create policy studio_wsa_manager on public.studio_workspace_agents for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists studio_docs_manager on public.studio_documents;
create policy studio_docs_manager on public.studio_documents for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- Conversations/messages : lecture seule côté CRM (suivi d'usage, support).
drop policy if exists studio_conv_manager on public.studio_conversations;
create policy studio_conv_manager on public.studio_conversations for select to authenticated
  using (public.is_manager());
drop policy if exists studio_msg_manager on public.studio_messages;
create policy studio_msg_manager on public.studio_messages for select to authenticated
  using (public.is_manager());

-- studio_credentials, studio_sessions, studio_login_echecs : aucune politique
-- (service role seulement, via l'Edge Function `studio`).

-- 6) Usage agrégé pour le CRM (messages du mois par espace) -------------------
create or replace view public.studio_usage_mois with (security_invoker = true) as
  select workspace_id,
         count(*) filter (where role = 'user')      as demandes,
         count(*) filter (where role = 'assistant') as reponses,
         max(created_at)                            as derniere_activite
  from public.studio_messages
  where created_at >= date_trunc('month', now())
  group by workspace_id;

-- Recherche plein texte dans la base de connaissances d'UN espace.
-- Réservée au service role (l'Edge Function passe l'espace de la session) :
-- exécutable par anon/authenticated, elle permettrait de lire un autre espace.
create or replace function public.studio_recherche_docs(p_workspace uuid, p_question text, p_limite int default 4)
returns table (id uuid, titre text, extrait text, rang real)
language sql stable security definer set search_path = public as $$
  -- Mots de la question reliés par OU : une question en langage naturel ne
  -- contient presque jamais TOUS ses mots dans un même document.
  with q as (
    select websearch_to_tsquery('french',
      regexp_replace(regexp_replace(left(p_question, 500), '[^[:alnum:][:space:]]', ' ', 'g'), '\s+', ' or ', 'g')) as tsq
  )
  select d.id, d.titre, left(d.contenu, 6000) as extrait,
         ts_rank(to_tsvector('french', coalesce(d.titre, '') || ' ' || coalesce(d.contenu, '')), q.tsq) as rang
  from public.studio_documents d, q
  where d.workspace_id = p_workspace
    and d.actif
    and to_tsvector('french', coalesce(d.titre, '') || ' ' || coalesce(d.contenu, '')) @@ q.tsq
  order by rang desc
  limit greatest(1, least(p_limite, 8));
$$;
revoke all on function public.studio_recherche_docs(uuid, text, int) from public, anon, authenticated;
grant execute on function public.studio_recherche_docs(uuid, text, int) to service_role;

-- 7) Catalogue initial (modifiable dans le CRM › Studio IA) -------------------
insert into public.studio_agents (id, prenom, metier, accroche, description, prompt_systeme, demandes, minutes_par_tache, couleur, ordre) values
('lea', 'Léa', 'Assistante générale',
 'Je suis votre bras droit : je rédige, j''organise et je réponds à vos questions du quotidien.',
 'E-mails, comptes rendus, to-do, synthèses de documents, préparation de rendez-vous.',
 'Tu es Léa, assistante générale d''un dirigeant de TPE/PME. Tu rédiges des e-mails, comptes rendus, synthèses et plans d''action clairs, prêts à l''emploi. Tu vas droit au but, tu proposes toujours une prochaine étape concrète.',
 '[{"titre":"Rédiger un e-mail de relance","prompt":"Rédige un e-mail de relance courtois pour un client qui n''a pas répondu à mon devis envoyé il y a 10 jours."},{"titre":"Préparer ma semaine","prompt":"Aide-moi à organiser ma semaine : je te liste mes tâches, tu les priorises (urgent/important) et tu proposes un planning."},{"titre":"Résumer un document","prompt":"Je vais te coller un document : fais-en une synthèse en 5 points et liste les actions à mener."}]'::jsonb,
 20, '#f97316', 10),
('hugo', 'Hugo', 'Marketing & réseaux sociaux',
 'Je crée vos publications et votre calendrier éditorial, de l''idée jusqu''au texte prêt à poster.',
 'Posts LinkedIn / Facebook / Instagram, calendrier éditorial, accroches, idées de visuels.',
 'Tu es Hugo, responsable marketing et réseaux sociaux. Tu écris des publications engageantes adaptées à chaque réseau (LinkedIn, Facebook, Instagram), avec accroche, corps, appel à l''action et hashtags pertinents. Quand on te le demande, tu proposes plusieurs variantes notées sur 10.',
 '[{"titre":"5 posts pour la semaine","prompt":"Propose 5 publications LinkedIn pour cette semaine sur mon activité, avec accroche, texte et hashtags."},{"titre":"Calendrier éditorial du mois","prompt":"Construis mon calendrier éditorial du mois prochain : 3 publications par semaine, thèmes, réseau et format."},{"titre":"Idées de visuels","prompt":"Donne-moi 5 idées de visuels (description précise pour un graphiste ou un générateur d''images) pour promouvoir mon offre principale."}]'::jsonb,
 30, '#ec4899', 20),
('sam', 'Sam', 'Commercial & prospection',
 'Je prépare votre prospection : messages, scripts d''appel et relances qui convertissent.',
 'Messages de prospection LinkedIn/e-mail, scripts d''appel, traitement des objections, propositions commerciales.',
 'Tu es Sam, commercial B2B expérimenté. Tu écris des messages de prospection courts et personnalisés, des scripts d''appel structurés (accroche, découverte, argumentaire, objections, closing) et des propositions commerciales. Tu restes factuel et respectueux, jamais agressif.',
 '[{"titre":"Séquence de prospection","prompt":"Écris une séquence de prospection en 3 messages LinkedIn pour ma cible principale."},{"titre":"Script d''appel","prompt":"Prépare un script d''appel de découverte de 5 minutes pour présenter mon offre à un prospect."},{"titre":"Répondre à une objection","prompt":"Un prospect me dit « c''est trop cher ». Propose 3 façons d''y répondre."}]'::jsonb,
 25, '#3b82f6', 30),
('ines', 'Inès', 'SEO & contenus web',
 'Je vous aide à être trouvé sur Google avec des contenus optimisés.',
 'Articles de blog optimisés, recherche de mots-clés, méta-descriptions, audit de page.',
 'Tu es Inès, experte SEO et rédaction web. Tu proposes des mots-clés pertinents (intention de recherche), des plans d''articles structurés (H1/H2/H3), rédiges des articles optimisés et des balises title/meta. Tu n''inventes jamais de volumes de recherche chiffrés : tu le dis quand une donnée nécessite un outil.',
 '[{"titre":"Article de blog","prompt":"Rédige un article de blog optimisé SEO (environ 900 mots) sur un sujet clé de mon activité, avec title et meta description."},{"titre":"Idées de mots-clés","prompt":"Propose 15 idées de mots-clés longue traîne pour mon activité, classées par intention de recherche."},{"titre":"Optimiser une page","prompt":"Je te colle le texte d''une page de mon site : propose des améliorations SEO concrètes."}]'::jsonb,
 45, '#10b981', 40),
('mael', 'Maël', 'Administratif & juridique',
 'Je rédige vos documents courants et vous aide à rester dans les clous.',
 'CGV, mentions légales, modèles de contrats, points RGPD, courriers administratifs.',
 'Tu es Maël, assistant administratif et juridique pour TPE/PME françaises. Tu rédiges des modèles de documents (CGV, contrats simples, courriers, mentions légales) et expliques les obligations courantes (RGPD, facturation). Tu précises toujours que tes modèles sont à faire valider par un professionnel du droit pour les enjeux importants.',
 '[{"titre":"Modèle de CGV","prompt":"Rédige un modèle de conditions générales de vente adapté à mon activité."},{"titre":"Check-list RGPD","prompt":"Donne-moi une check-list RGPD des actions prioritaires pour une petite entreprise comme la mienne."},{"titre":"Courrier de mise en demeure","prompt":"Rédige un courrier de relance avant mise en demeure pour une facture impayée."}]'::jsonb,
 40, '#8b5cf6', 50),
('nora', 'Nora', 'RH & formation',
 'Je vous accompagne pour recruter, intégrer et faire monter en compétences vos équipes.',
 'Fiches de poste, annonces, grilles d''entretien, plans de développement des compétences, financements formation.',
 'Tu es Nora, responsable RH et formation. Tu rédiges des fiches de poste, annonces, grilles d''entretien, parcours d''intégration et plans de développement des compétences. Tu connais les dispositifs de financement de la formation en France (OPCO, FAF dont AGEFICE, CPF) et orientes vers Aissociate, organisme de formation certifié Qualiopi, quand un besoin de formation apparaît.',
 '[{"titre":"Annonce de recrutement","prompt":"Rédige une annonce de recrutement attractive pour le poste que je vais te décrire."},{"titre":"Plan de formation","prompt":"Aide-moi à construire le plan de développement des compétences de mon équipe pour l''année."},{"titre":"Financer une formation","prompt":"Quels financements puis-je mobiliser pour former mes salariés ou moi-même en tant que dirigeant ?"}]'::jsonb,
 30, '#eab308', 60)
on conflict (id) do nothing;

-- 8) Super-pouvoirs initiaux : chaque agent remplit des cadres prédéterminés.
-- (Seulement si l'agent n'en a pas encore : ne pas écraser une édition faite dans le CRM.)
update public.studio_agents set super_pouvoirs = $j$[
 {"id":"email","titre":"Rédiger un e-mail","description":"Un e-mail prêt à envoyer, au bon ton.",
  "champs":[{"nom":"destinataire","label":"À qui ?","type":"texte","requis":true,"aide":"ex. un client, un fournisseur, mon équipe"},
            {"nom":"objectif","label":"Objectif de l'e-mail","type":"long","requis":true},
            {"nom":"ton","label":"Ton","type":"choix","options":["Cordial","Formel","Direct","Chaleureux"]}],
  "gabarit":"Rédige un e-mail destiné à : {{destinataire}}.\nObjectif : {{objectif}}\nTon : {{ton}}.\nLivre : 1) un objet percutant, 2) le corps de l'e-mail (moins de 180 mots), 3) une variante plus courte."},
 {"id":"synthese","titre":"Synthétiser un document","description":"5 points clés et les actions à mener.",
  "champs":[{"nom":"texte","label":"Collez le document","type":"long","requis":true},
            {"nom":"usage","label":"Pour quoi faire ?","type":"choix","options":["Décider","Informer mon équipe","Préparer un rendez-vous"]}],
  "gabarit":"Synthétise le document ci-dessous pour : {{usage}}.\nLivre : 1) l'essentiel en une phrase, 2) 5 points clés, 3) les actions à mener (qui / quoi / quand), 4) les points de vigilance.\n\nDocument :\n{{texte}}"},
 {"id":"semaine","titre":"Organiser ma semaine","description":"Priorisation et planning à partir de vos tâches.",
  "champs":[{"nom":"taches","label":"Vos tâches (une par ligne)","type":"long","requis":true},
            {"nom":"contraintes","label":"Contraintes (rendez-vous, échéances)","type":"long"}],
  "gabarit":"Voici mes tâches :\n{{taches}}\nContraintes : {{contraintes}}\nClasse-les en matrice urgent/important, puis propose un planning du lundi au vendredi sous forme de tableau (jour, créneau, tâche)."}
]$j$::jsonb where id = 'lea' and super_pouvoirs = '[]'::jsonb;

update public.studio_agents set super_pouvoirs = $j$[
 {"id":"post","titre":"Générer un post","description":"Un post prêt à publier sur le réseau de votre choix.",
  "champs":[{"nom":"sujet","label":"De quoi parle votre post ?","type":"long","requis":true},
            {"nom":"reseau","label":"Réseau","type":"choix","options":["LinkedIn","Facebook","Instagram"],"requis":true},
            {"nom":"longueur","label":"Longueur du texte","type":"choix","options":["Court","Standard","Détaillé"]},
            {"nom":"objectif","label":"Objectif","type":"choix","options":["Notoriété","Engagement","Générer des contacts","Recruter"]}],
  "gabarit":"Rédige un post {{reseau}} sur : {{sujet}}\nLongueur : {{longueur}}. Objectif : {{objectif}}.\nLivre 3 variantes notées sur 10 (accroche différente pour chacune), chacune avec appel à l'action et 3 à 5 hashtags pertinents, puis une idée de visuel (description précise) pour la meilleure."},
 {"id":"calendrier","titre":"Calendrier éditorial","description":"Un mois de publications planifiées.",
  "champs":[{"nom":"mois","label":"Mois concerné","type":"texte","requis":true},
            {"nom":"rythme","label":"Rythme","type":"choix","options":["2 posts / semaine","3 posts / semaine","1 post / jour ouvré"]},
            {"nom":"temps_forts","label":"Temps forts (lancements, événements)","type":"long"}],
  "gabarit":"Construis le calendrier éditorial de {{mois}} au rythme : {{rythme}}.\nTemps forts à intégrer : {{temps_forts}}\nTableau : date, réseau, thème, format (texte, carrousel, vidéo…), accroche. Équilibre les piliers : expertise, preuve sociale, coulisses, offre."},
 {"id":"visuel","titre":"Brief de visuel","description":"Un brief précis pour un graphiste ou un générateur d'images.",
  "champs":[{"nom":"message","label":"Message à faire passer","type":"long","requis":true},
            {"nom":"format","label":"Format","type":"choix","options":["Carré (1:1)","Paysage (16:9)","Portrait (4:5)","Story (9:16)"]}],
  "gabarit":"Rédige 3 briefs de visuel au format {{format}} pour le message : {{message}}\nPour chacun : concept, composition, couleurs, texte incrusté (6 mots max), et un prompt prêt à coller dans un générateur d'images."}
]$j$::jsonb where id = 'hugo' and super_pouvoirs = '[]'::jsonb;

update public.studio_agents set super_pouvoirs = $j$[
 {"id":"sequence","titre":"Séquence de prospection","description":"3 messages LinkedIn ou e-mail pour une cible.",
  "champs":[{"nom":"cible","label":"Cible (métier, secteur, taille)","type":"texte","requis":true},
            {"nom":"canal","label":"Canal","type":"choix","options":["LinkedIn","E-mail"],"requis":true},
            {"nom":"offre","label":"Offre à présenter","type":"long","requis":true}],
  "gabarit":"Écris une séquence de prospection {{canal}} en 3 messages (J0, J+4, J+10) pour la cible : {{cible}}.\nOffre : {{offre}}\nMessages courts (moins de 80 mots), personnalisables (champs entre crochets), sans jargon, chacun avec une question ouverte."},
 {"id":"script","titre":"Script d'appel","description":"Découverte, argumentaire, objections, closing.",
  "champs":[{"nom":"contexte","label":"Contexte de l'appel","type":"choix","options":["Appel à froid","Rappel d'un lead entrant","Relance de devis"],"requis":true},
            {"nom":"offre","label":"Offre","type":"long","requis":true}],
  "gabarit":"Prépare un script d'appel ({{contexte}}) pour l'offre : {{offre}}\nStructure : accroche (15 s), 5 questions de découverte, argumentaire en 3 bénéfices, réponses aux 4 objections les plus probables, closing avec prise de rendez-vous."},
 {"id":"objection","titre":"Traiter une objection","description":"3 réponses possibles à une objection client.",
  "champs":[{"nom":"objection","label":"Objection entendue","type":"texte","requis":true},
            {"nom":"contexte","label":"Contexte (facultatif)","type":"long"}],
  "gabarit":"Un prospect m'oppose : « {{objection}} ». Contexte : {{contexte}}\nPropose 3 réponses (empathie, reformulation, argument, question de relance), de la plus douce à la plus directe."}
]$j$::jsonb where id = 'sam' and super_pouvoirs = '[]'::jsonb;

update public.studio_agents set super_pouvoirs = $j$[
 {"id":"article","titre":"Article de blog SEO","description":"Article structuré avec title et meta.",
  "champs":[{"nom":"sujet","label":"Sujet","type":"texte","requis":true},
            {"nom":"mot_cle","label":"Mot-clé principal","type":"texte","requis":true},
            {"nom":"longueur","label":"Longueur","type":"choix","options":["600 mots","900 mots","1 500 mots"]}],
  "gabarit":"Rédige un article de blog d'environ {{longueur}} sur « {{sujet}} », optimisé pour le mot-clé « {{mot_cle}} ».\nLivre : balise title (60 caractères max), meta description (155 max), slug, puis l'article avec H1/H2/H3, introduction accrocheuse, FAQ de 3 questions et conclusion avec appel à l'action."},
 {"id":"mots_cles","titre":"Idées de mots-clés","description":"Mots-clés longue traîne classés par intention.",
  "champs":[{"nom":"theme","label":"Thème ou service","type":"texte","requis":true},
            {"nom":"zone","label":"Zone géographique","type":"texte"}],
  "gabarit":"Propose 20 mots-clés longue traîne pour : {{theme}} (zone : {{zone}}).\nTableau : mot-clé, intention (informationnelle, commerciale, transactionnelle, locale), type de contenu à créer. Ne donne aucun volume de recherche chiffré."},
 {"id":"audit_page","titre":"Optimiser une page","description":"Recommandations SEO concrètes pour un texte.",
  "champs":[{"nom":"texte","label":"Texte de la page","type":"long","requis":true},
            {"nom":"mot_cle","label":"Mot-clé visé","type":"texte"}],
  "gabarit":"Analyse ce texte de page pour le mot-clé « {{mot_cle}} » :\n{{texte}}\nLivre : note sur 10, 5 forces, 5 améliorations prioritaires, une proposition de title, meta et H1 réécrits."}
]$j$::jsonb where id = 'ines' and super_pouvoirs = '[]'::jsonb;

update public.studio_agents set super_pouvoirs = $j$[
 {"id":"cgv","titre":"Modèle de CGV","description":"Conditions générales de vente adaptées à votre activité.",
  "champs":[{"nom":"activite","label":"Activité et type de clients","type":"long","requis":true},
            {"nom":"clients","label":"Clients","type":"choix","options":["Professionnels (B2B)","Particuliers (B2C)","Les deux"],"requis":true}],
  "gabarit":"Rédige un modèle de CGV pour : {{activite}}. Clientèle : {{clients}}.\nArticles numérotés (objet, commandes, prix, paiement et pénalités, livraison/exécution, rétractation si B2C, responsabilité, données personnelles, litiges). Champs à compléter entre crochets. Rappelle en fin de document de faire valider par un juriste."},
 {"id":"relance_impaye","titre":"Relance d'impayé","description":"De la relance amiable à la mise en demeure.",
  "champs":[{"nom":"client","label":"Client","type":"texte","requis":true},
            {"nom":"facture","label":"Facture (n°, montant, échéance)","type":"texte","requis":true},
            {"nom":"niveau","label":"Niveau","type":"choix","options":["1re relance amiable","2e relance ferme","Mise en demeure"],"requis":true}],
  "gabarit":"Rédige un courrier « {{niveau}} » pour le client {{client}}, facture : {{facture}}.\nMentionne les pénalités de retard et l'indemnité forfaitaire de 40 € (B2B) quand c'est pertinent."},
 {"id":"rgpd","titre":"Check-list RGPD","description":"Les actions prioritaires pour votre entreprise.",
  "champs":[{"nom":"donnees","label":"Données que vous traitez (clients, salariés, prospects…)","type":"long","requis":true}],
  "gabarit":"Voici les données que nous traitons : {{donnees}}\nDresse une check-list RGPD priorisée (tableau : action, pourquoi, effort, priorité) et la liste des documents à tenir (registre, mentions d'information…)."}
]$j$::jsonb where id = 'mael' and super_pouvoirs = '[]'::jsonb;

update public.studio_agents set super_pouvoirs = $j$[
 {"id":"annonce","titre":"Annonce de recrutement","description":"Une annonce attractive et non discriminante.",
  "champs":[{"nom":"poste","label":"Poste","type":"texte","requis":true},
            {"nom":"contrat","label":"Contrat","type":"choix","options":["CDI","CDD","Alternance","Stage","Freelance"],"requis":true},
            {"nom":"details","label":"Missions, profil, avantages","type":"long","requis":true}],
  "gabarit":"Rédige une annonce de recrutement pour un poste de {{poste}} ({{contrat}}).\nÉléments : {{details}}\nStructure : accroche, l'entreprise, missions, profil, ce que nous offrons, process de recrutement. Langage inclusif et non discriminant."},
 {"id":"entretien","titre":"Grille d'entretien","description":"Questions et critères d'évaluation.",
  "champs":[{"nom":"poste","label":"Poste","type":"texte","requis":true},
            {"nom":"competences","label":"Compétences clés recherchées","type":"long","requis":true}],
  "gabarit":"Construis une grille d'entretien pour {{poste}} évaluant : {{competences}}\nTableau : compétence, 2 questions comportementales (méthode STAR), signaux positifs, signaux d'alerte, note sur 4."},
 {"id":"financement","titre":"Financer une formation","description":"Les dispositifs mobilisables selon votre situation.",
  "champs":[{"nom":"public","label":"Qui former ?","type":"choix","options":["Moi, dirigeant non salarié","Mes salariés","Un futur salarié"],"requis":true},
            {"nom":"besoin","label":"Besoin de formation","type":"long","requis":true}],
  "gabarit":"Public : {{public}}. Besoin : {{besoin}}\nExplique les dispositifs de financement adaptés (FAF dont AGEFICE, OPCO, CPF, FNE…), les démarches et délais, et propose un plan d'action. Signale qu'Aissociate, organisme certifié Qualiopi, peut monter le dossier."}
]$j$::jsonb where id = 'nora' and super_pouvoirs = '[]'::jsonb;

notify pgrst, 'reload schema';
