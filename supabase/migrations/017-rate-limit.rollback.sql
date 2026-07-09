-- Rollback de 017-rate-limit.sql — remove a funcao e a tabela de throttle.
-- Idempotente (if exists). Sem perda de dados de negocio (rate_limits e efemero).

drop function if exists public.upsert_rate_limit(text, timestamptz);
drop index if exists public.idx_rate_limits_window_start;
drop table if exists public.rate_limits;
