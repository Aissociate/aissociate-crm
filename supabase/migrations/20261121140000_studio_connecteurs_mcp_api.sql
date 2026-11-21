-- Plusieurs serveurs MCP (« mcp:<nom> », PR #39) et plusieurs API (« api:<nom> », PR #40) par espace :
-- la contrainte n'acceptait que les types fixes et « app:<nom> ».
alter table public.studio_connecteurs drop constraint if exists studio_connecteurs_type_check;
alter table public.studio_connecteurs add constraint studio_connecteurs_type_check check (
  type = any (array['google', 'outlook', 'smtp', 'facebook', 'instagram', 'linkedin', 'tiktok', 'mcp'])
  or type ~ '^app:[a-z0-9][a-z0-9._-]{0,79}$'
  or type ~ '^(mcp|api):[a-z0-9][a-z0-9-]{0,39}$'
);
