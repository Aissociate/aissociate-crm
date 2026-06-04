/*
  # Helper RPC : upsert d'un secret dans le vault (usage one-shot par edge function)
  SECURITY DEFINER pour contourner les restrictions de vault depuis un rôle non-superuser.
*/
create or replace function public.upsert_vault_secret(p_name text, p_value text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from vault.secrets where name = p_name) then
    update vault.secrets set secret = p_value where name = p_name;
  else
    perform vault.create_secret(p_value, p_name, p_name || ' (auto)');
  end if;
end;
$$;
-- Accessible uniquement aux authenticated (la fonction sera appelée avec le service_role)
revoke all on function public.upsert_vault_secret(text, text) from public, anon;
grant execute on function public.upsert_vault_secret(text, text) to service_role;
