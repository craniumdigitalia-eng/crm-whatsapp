-- =====================================================================
-- Migration 003 — Atribuição de leads (Facebook Ads / Meta Lead Ads)
-- Story 5.14 — Importação de leads do formulário instantâneo do Meta — 2026-06-25
--
-- Adiciona em `leads` os campos de origem/atribuição e as respostas do
-- formulário (form_data). Cria a tabela `integrations_config` (key/value)
-- para a aba "Integrações" salvar credenciais sem expor no client.
--
-- Idempotente: usa IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- Aplicar no SQL Editor do Supabase ou via `supabase db push`.
-- =====================================================================

-- --- Campos de atribuição em leads ----------------------------------
alter table leads add column if not exists source      text;            -- ex: 'meta_lead_ads', 'whatsapp'
alter table leads add column if not exists form_id     text;            -- ID do formulário instantâneo (Meta)
alter table leads add column if not exists leadgen_id  text;            -- ID do lead na Graph API (dedupe)
alter table leads add column if not exists ad_id       text;            -- anúncio que gerou o lead
alter table leads add column if not exists campaign_id text;            -- campanha de origem
alter table leads add column if not exists form_data   jsonb;           -- todas as respostas { pergunta: resposta }

-- Dedupe de leads do Meta: um leadgen_id nunca entra duas vezes.
-- Índice único parcial — leads sem leadgen_id (WhatsApp etc.) não participam.
create unique index if not exists idx_leads_leadgen_id
  on leads(leadgen_id)
  where leadgen_id is not null;

-- Busca rápida por origem (relatórios "de onde vêm os leads").
create index if not exists idx_leads_source on leads(source);

-- --- Configuração das integrações (key/value) -----------------------
-- A aba "Integrações" grava aqui (page token, verify token, form id…).
-- O backend lê de env PRIMEIRO; esta tabela é o override salvo pela UI.
-- Acessada só via service_role (server-side) — nunca exposta ao client.
create table if not exists integrations_config (
  key        text        primary key,   -- ex: 'meta_page_access_token'
  value      text,                       -- valor (segredo) — sem RLS, só service_role
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_integrations_config_updated_at on integrations_config;
create trigger trg_integrations_config_updated_at
  before update on integrations_config
  for each row execute function set_updated_at();
