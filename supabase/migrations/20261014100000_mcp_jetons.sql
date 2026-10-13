-- Jetons personnels du serveur MCP distant (Edge Function `mcp`).
--
-- Le jeton en clair (`crm_mcp_…`) n'est JAMAIS stocké : seule son empreinte
-- SHA-256 (hex) l'est. Il est généré côté base par `creer_jeton_mcp`, renvoyé
-- une seule fois à son propriétaire, puis introuvable.
--
-- RLS : chaque utilisateur ne voit que ses jetons. Aucune policy d'écriture :
-- création et révocation passent par les RPC ci-dessous (security definer),
-- qui fixent elles-mêmes user_id = auth.uid().
create table if not exists public.mcp_jetons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  libelle text not null check (length(btrim(libelle)) between 1 and 80),
  empreinte text not null unique check (empreinte ~ '^[0-9a-f]{64}$'),
  prefixe text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists mcp_jetons_user_idx on public.mcp_jetons(user_id);

alter table public.mcp_jetons enable row level security;

drop policy if exists mcp_jetons_select_own on public.mcp_jetons;
create policy mcp_jetons_select_own on public.mcp_jetons
  for select to authenticated using (user_id = auth.uid());

revoke all on public.mcp_jetons from anon;
revoke insert, update, delete on public.mcp_jetons from authenticated;
grant select on public.mcp_jetons to authenticated;

-- Création : renvoie { id, jeton, prefixe, expires_at }. Le jeton en clair
-- n'existe que dans cette réponse.
create or replace function public.creer_jeton_mcp(p_libelle text, p_jours integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_jeton text;
  v_id uuid;
  v_expire timestamptz;
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  if p_libelle is null or length(btrim(p_libelle)) not between 1 and 80 then
    raise exception 'Libellé requis (80 caractères max)';
  end if;
  if p_jours is not null and (p_jours < 1 or p_jours > 3650) then
    raise exception 'Durée de validité invalide';
  end if;
  if (select count(*) from mcp_jetons
       where user_id = v_uid and revoked_at is null
         and (expires_at is null or expires_at > now())) >= 10 then
    raise exception 'Maximum 10 jetons actifs : révoquez-en un d''abord';
  end if;

  -- 32 octets aléatoires en base64url, sans remplissage (43 caractères).
  v_jeton := 'crm_mcp_' || rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_expire := case when p_jours is null then null else now() + make_interval(days => p_jours) end;

  insert into mcp_jetons (user_id, libelle, empreinte, prefixe, expires_at)
  values (v_uid, btrim(p_libelle), encode(digest(v_jeton, 'sha256'), 'hex'), left(v_jeton, 12), v_expire)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'jeton', v_jeton, 'prefixe', left(v_jeton, 12), 'expires_at', v_expire);
end;
$$;

create or replace function public.revoquer_jeton_mcp(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;
  update mcp_jetons set revoked_at = now()
   where id = p_id and user_id = auth.uid() and revoked_at is null;
  if not found then
    raise exception 'Jeton introuvable ou déjà révoqué';
  end if;
end;
$$;

revoke all on function public.creer_jeton_mcp(text, integer) from public, anon;
revoke all on function public.revoquer_jeton_mcp(uuid) from public, anon;
grant execute on function public.creer_jeton_mcp(text, integer) to authenticated;
grant execute on function public.revoquer_jeton_mcp(uuid) to authenticated;
