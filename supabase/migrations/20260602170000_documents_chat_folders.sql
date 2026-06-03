/*
  # Documents : activation par chatbot + rangement par dossiers

  - `chat_direction` / `chat_conseiller` : le document alimente (ou non) le
    contexte de l'assistant IA pour chaque chat. Opt-in par l'admin ; un document
    non coché n'est utilisé par aucun chat.
  - `dossier` : nom de dossier (rangement de l'espace documentaire) pour une
    gestion par dossiers.
*/

alter table public.documents add column if not exists chat_direction  boolean not null default false;
alter table public.documents add column if not exists chat_conseiller boolean not null default false;
alter table public.documents add column if not exists dossier text;

create index if not exists idx_documents_dossier on public.documents(dossier);
create index if not exists idx_documents_chat on public.documents(chat_direction, chat_conseiller);
