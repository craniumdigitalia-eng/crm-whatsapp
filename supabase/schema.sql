-- =====================================================================
-- CRM WhatsApp — schema Supabase (Postgres)
-- Base do banco para a versao de producao (Supabase + Vercel).
-- Rode no SQL Editor do Supabase ou via `supabase db push`.
--
-- Incorpora ajustes da Wave 0:
--   • messages.external_id + indice unico parcial (Story 1.1 — idempotencia de webhook)
--   • chk_followup CHECK (follow_up_count >= 0)  (gap #7 do schema)
-- =====================================================================

-- Estagios do funil (espelha src/types.ts do prototipo).
do $$ begin
  create type lead_status as enum (
    'novo', 'em_atendimento', 'qualificado', 'proposta', 'fechado', 'perdido', 'humano'
  );
exception when duplicate_object then null; end $$;

create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),
  phone            text unique not null,
  name             text,
  status           lead_status not null default 'novo',
  service_interest text,
  budget           text,
  notes            text,
  follow_up_count  int not null default 0 constraint chk_followup check (follow_up_count >= 0),
  last_direction   text check (last_direction in ('in','out')),
  last_message_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  direction   text not null check (direction in ('in','out')),
  body        text not null,
  external_id text,                    -- ID externo (Evolution/Make) para deduplicacao de reentregas
  created_at  timestamptz not null default now()
);

create index if not exists idx_messages_lead on messages(lead_id);
create index if not exists idx_leads_status on leads(status);
-- Indice que ajuda o motor de follow-up a achar leads pendentes.
create index if not exists idx_leads_followup
  on leads(status, last_direction, last_message_at)
  where last_direction = 'out';

-- Indice unico parcial para deduplicacao de mensagens recebidas (Story 1.1).
-- external_id NULL (mensagens 'out' internas) nao participa do constraint.
-- Uso: INSERT INTO messages (..., external_id) VALUES (..., $n) ON CONFLICT (external_id) DO NOTHING;
create unique index if not exists idx_messages_external_id
  on messages(external_id)
  where external_id is not null;

-- updated_at automatico.
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at before update on leads
  for each row execute function set_updated_at();

-- =====================================================================
-- Migration 002 — Etiquetas (tags) e Checklists
-- Stories 5.12 e 5.13 — 2026-06-25
-- Arquivo formal: supabase/migrations/002-tags-checklists.sql
-- =====================================================================

-- Catalogo de etiquetas disponíveis.
create table if not exists tags (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null unique,
  color      text        not null default '#7C3AED',
  created_at timestamptz not null default now()
);

-- Relacao many-to-many: lead pode ter N etiquetas; etiqueta pode estar em N leads.
create table if not exists lead_tags (
  lead_id uuid not null references leads(id) on delete cascade,
  tag_id  uuid not null references tags(id)  on delete cascade,
  primary key (lead_id, tag_id)
);

-- Indice para filtrar leads por etiqueta (board filtrado por cor/etiqueta).
create index if not exists idx_lead_tags_tag_id on lead_tags(tag_id);

-- Itens de checklist por lead.
create table if not exists checklist_items (
  id         uuid        primary key default gen_random_uuid(),
  lead_id    uuid        not null references leads(id) on delete cascade,
  text       text        not null,
  done       boolean     not null default false,
  position   int         not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indice para buscar e ordenar itens por lead.
create index if not exists idx_checklist_items_lead_position
  on checklist_items(lead_id, position);

-- Trigger de updated_at — reutiliza set_updated_at() definido acima.
drop trigger if exists trg_checklist_items_updated_at on checklist_items;
create trigger trg_checklist_items_updated_at
  before update on checklist_items
  for each row execute function set_updated_at();

-- =====================================================================
-- Migration 003 — Atribuição de leads (Facebook Ads / Meta Lead Ads)
-- Story 5.14 — 2026-06-25
-- Arquivo formal: supabase/migrations/003-lead-attribution.sql
-- =====================================================================

-- Campos de origem/atribuição e respostas do formulário instantâneo.
alter table leads add column if not exists source      text;
alter table leads add column if not exists form_id     text;
alter table leads add column if not exists leadgen_id  text;
alter table leads add column if not exists ad_id       text;
alter table leads add column if not exists campaign_id text;
alter table leads add column if not exists form_data   jsonb;

-- Dedupe de leads do Meta por leadgen_id (índice único parcial).
create unique index if not exists idx_leads_leadgen_id
  on leads(leadgen_id)
  where leadgen_id is not null;

create index if not exists idx_leads_source on leads(source);

-- Configuração das integrações (key/value) gravada pela aba "Integrações".
-- Acessada só via service_role — nunca exposta ao client.
create table if not exists integrations_config (
  key        text        primary key,
  value      text,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_integrations_config_updated_at on integrations_config;
create trigger trg_integrations_config_updated_at
  before update on integrations_config
  for each row execute function set_updated_at();

-- =====================================================================
-- RLS: as funcoes serverless (Vercel) acessam via service_role, que
-- ignora RLS. Habilite RLS e crie policies so quando expor leitura
-- direta ao front-end autenticado (dashboard com Supabase Auth).
-- =====================================================================
-- alter table leads               enable row level security;
-- alter table messages            enable row level security;
-- alter table tags                enable row level security;
-- alter table lead_tags           enable row level security;
-- alter table checklist_items     enable row level security;
-- alter table integrations_config enable row level security;
