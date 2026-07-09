-- 017-rate-limit.sql — Tabela de throttle por janela fixa para ingress publicos.
--
-- Contexto (P0-3 da auditoria de robustez 2026-07-09):
--   Os endpoints /api/webhook, /api/leadgen e /api/site-lead sao publicos (autenticados
--   apenas por token/secret fixo). Sem rate limit, um atacante ou bug de loop pode
--   inundar o webhook e disparar centenas de chamadas OpenAI (custo financeiro),
--   alem de saturar as invocacoes da Vercel e o banco.
--
-- Solucao: janela fixa com UPSERT atomico. Sem Redis, funciona em serverless stateless.
--   A funcao upsert_rate_limit(key, window_start) incrementa o contador ou insere 1
--   se for nova janela. O chamador compara o retorno com o limite configurado.
--
-- Limpeza: o cron de limpeza (DELETE WHERE window_start < now() - interval '2 hours')
--   pode ser chamado pelo job de follow-up ou por um cron separado. A tabela e pequena
--   (poucas dezenas de linhas de chaves ativas) e o custo de limpeza e baixo.
--
-- Rollback: 017-rate-limit.rollback.sql
-- Aplique com: psql $DATABASE_URL -f supabase/migrations/017-rate-limit.sql

-- Tabela de janelas de rate limit.
-- key = identificador da chave (ex: "webhook:1.2.3.4" ou "site-lead:1.2.3.4")
-- window_start = inicio da janela (timestamp arredondado para o multiplo do periodo)
-- count = numero de requests nesta janela
create table if not exists public.rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  count        integer     not null default 1 check (count >= 0),
  primary key (key, window_start)
);

-- Indice de TTL para limpeza eficiente de janelas antigas.
create index if not exists idx_rate_limits_window_start on public.rate_limits (window_start);

-- RLS habilitado mas fechado por padrao: acesso apenas via service_role (server-side).
alter table public.rate_limits enable row level security;

-- Sem policies permissivas para anon/authenticated. O servico usa service_role
-- que ignora RLS — nenhuma linha e exposta ao front-end ou a outros contextos.

-- Funcao atomica de UPSERT: incrementa o count se a linha ja existe, insere 1 se nova.
-- Retorna o count pos-incremento. Chamada unica por request (sem race condition).
--
-- SECURITY DEFINER roda com os privilegios do owner (postgres), necessario para
-- que o service_role possa chamar via RPC sem restricao de RLS.
create or replace function public.upsert_rate_limit(
  p_key          text,
  p_window_start timestamptz
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, p_window_start, 1)
  on conflict (key, window_start) do update
    set count = rate_limits.count + 1
  returning count into v_count;

  return v_count;
end;
$$;

-- Seguranca: por padrao o Postgres concede EXECUTE a PUBLIC (anon/authenticated herdam).
-- Como esta funcao e SECURITY DEFINER e escreve na tabela de rate limit, deixa-la
-- chamavel por anon/authenticated permitiria inflar contadores via RPC e furar o proprio
-- throttle. Revogamos de PUBLIC e liberamos apenas para service_role (uso server-side).
revoke execute on function public.upsert_rate_limit(text, timestamptz) from public;
revoke execute on function public.upsert_rate_limit(text, timestamptz) from anon, authenticated;
grant execute on function public.upsert_rate_limit(text, timestamptz) to service_role;
