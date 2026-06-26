-- =====================================================================
-- Migration 008 — Follow-up agendado por lead
-- Permite programar um follow-up especifico para um lead: "lembrar o lead X
-- em 2 dias com esta mensagem". Complementa o follow-up AUTOMATICO generico
-- (src/followup/scheduler.ts, colunas leads.follow_up_count) — NAO o substitui.
-- Data: 2026-06-26
-- Rollback: 008-followup-schedule.rollback.sql
-- =====================================================================
-- Pre-requisito: schema base (supabase/schema.sql) ja aplicado (tabela leads).
-- Idempotente: usa IF NOT EXISTS.
-- Aplicar no SQL Editor do Supabase ou via `supabase db push`.
-- =====================================================================

create table if not exists follow_up_schedule (
  id           uuid        primary key default gen_random_uuid(),
  lead_id      uuid        not null references leads(id) on delete cascade,
  scheduled_at timestamptz not null,                 -- quando disparar
  message      text        not null,                 -- mensagem a enviar
  status       text        not null default 'pendente'
                 check (status in ('pendente','enviado','cancelado','erro')),
  created_by   uuid,                                 -- usuario que agendou (auth.users.id) — opcional
  created_at   timestamptz not null default now(),
  sent_at      timestamptz                           -- preenchido quando o cron envia
);

-- O cron busca os vencidos: WHERE status='pendente' AND scheduled_at <= now().
create index if not exists idx_follow_up_schedule_due
  on follow_up_schedule(status, scheduled_at);

-- Listagem dos follow-ups de um lead (aba do lead).
create index if not exists idx_follow_up_schedule_lead
  on follow_up_schedule(lead_id);
