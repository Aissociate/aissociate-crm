/*
  Assistant IA agentique (Edge Function `agent`)

  1. `ai_conversations` / `ai_messages` : fils de discussion persistés par
     utilisateur (reprise de conversation + traçabilité des échanges).
  2. `ai_actions` : actions d'écriture PROPOSÉES par l'IA. L'IA n'écrit jamais
     directement : elle crée une ligne `proposee`, l'utilisateur valide dans le
     chat, et l'Edge Function exécute alors l'action avec le JWT de
     l'utilisateur (RLS) puis journalise via log_audit().
  3. Index full-text français sur la base documentaire (recherche ciblée à la
     demande, au lieu du déversement intégral dans le prompt).

  Sécurité : RLS stricte « chacun voit ses conversations » (user_id = auth.uid()).
*/

-- 1) Conversations ------------------------------------------------------------
create table if not exists public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  titre      text not null default 'Nouvelle conversation',
  -- Entité ouverte au moment du lancement (fiche contact / dossier) : {type, id, label}
  contexte   jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ai_conversations_user on public.ai_conversations(user_id, updated_at desc);

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null default '',
  -- Trace compacte des outils appelés pendant ce tour : [{outil, label}]
  etapes          jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ai_messages_conv on public.ai_messages(conversation_id, created_at);

-- 2) Actions proposées (validation systématique avant toute écriture) ---------
create table if not exists public.ai_actions (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  outil           text not null,
  args            jsonb not null default '{}'::jsonb,
  description     text not null,
  statut          text not null default 'proposee'
                  check (statut in ('proposee', 'executee', 'annulee', 'erreur')),
  resultat        jsonb,
  created_at      timestamptz not null default now(),
  executed_at     timestamptz
);
create index if not exists idx_ai_actions_user on public.ai_actions(user_id, created_at desc);

-- updated_at automatique sur les conversations
drop trigger if exists trg_ai_conversations_updated on public.ai_conversations;
create trigger trg_ai_conversations_updated
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- RLS : propriétaire uniquement -----------------------------------------------
alter table public.ai_conversations enable row level security;
alter table public.ai_messages      enable row level security;
alter table public.ai_actions       enable row level security;

drop policy if exists ai_conv_own on public.ai_conversations;
create policy ai_conv_own on public.ai_conversations
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ai_msg_own on public.ai_messages;
create policy ai_msg_own on public.ai_messages
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ai_action_own on public.ai_actions;
create policy ai_action_own on public.ai_actions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3) Recherche full-text française sur la base documentaire -------------------
create index if not exists idx_documents_fts on public.documents using gin (
  to_tsvector('french',
    coalesce(titre, '') || ' ' || coalesce(description, '') || ' ' || coalesce(contenu_texte, ''))
);
