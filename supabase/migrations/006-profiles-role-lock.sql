-- Migration 006 — Trava o role contra auto-escalonamento (Story 5.2 hardening, S1)
--
-- PROBLEMA: a policy `profiles_self_update` (004) permite o usuario atualizar a PROPRIA
-- linha, mas nao restringe a COLUNA `role`. Um autenticado poderia fazer
--   PATCH /rest/v1/profiles?id=eq.<seu_id>  { "role": "admin" }
-- via anon key + sessao e se autopromover.
--
-- SOLUCAO: trigger BEFORE UPDATE que REJEITA qualquer mudanca de `role` cuja chamada
-- NAO seja service_role. Assim o role continua mutavel apenas server-side (service_role:
-- script de admin / futura tela de gestao), nunca pelo proprio usuario via Data API.
--
-- Como funciona a deteccao: o PostgREST injeta os claims do JWT no GUC
-- `request.jwt.claims`. Para chamadas com a service_role key, claims.role = 'service_role'.
-- Para usuarios logados, claims.role = 'authenticated'. Em conexao direta (psql/DBA) o
-- GUC fica ausente (NULL) — tambem bloqueado; um DBA que precise mexer no role deve usar
-- a service_role ou desabilitar o trigger pontualmente.

create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
begin
  if new.role is distinct from old.role and coalesce(jwt_role, '') <> 'service_role' then
    raise exception 'role so pode ser alterado pela service_role (admin server-side)'
      using errcode = '42501'; -- insufficient_privilege
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_lock on public.profiles;
create trigger profiles_role_lock
  before update on public.profiles
  for each row
  execute function public.prevent_role_self_escalation();
