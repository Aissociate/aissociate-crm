/*
  # Documents : activation par chatbot + rangement par dossiers

  - chat_direction / chat_conseiller : le document alimente (ou non) le
    contexte de l'assistant IA pour chaque chat.
  - dossier : nom de dossier pour le rangement de l'espace documentaire.
*/

alter table public.documents add column if not exists chat_direction  boolean not null default false;
alter table public.documents add column if not exists chat_conseiller boolean not null default false;
alter table public.documents add column if not exists dossier text;

create index if not exists idx_documents_dossier on public.documents(dossier);
create index if not exists idx_documents_chat on public.documents(chat_direction, chat_conseiller);
