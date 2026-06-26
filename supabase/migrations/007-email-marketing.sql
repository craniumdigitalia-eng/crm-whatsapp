-- =====================================================================
-- Migration 007 — Email Marketing (v1)
-- Listas/contatos, templates, campanhas e eventos (open/click/bounce...).
-- Data: 2026-06-26
-- Rollback: 007-email-marketing.rollback.sql
-- =====================================================================
-- Pré-requisito: schema base (supabase/schema.sql) já aplicado.
-- A função set_updated_at() e a tabela leads devem existir.
-- =====================================================================

-- ------------------------------------------------------------------
-- Email dos leads (destinatários "base do CRM").
-- Os leads nascem do WhatsApp/Meta com telefone; o e-mail pode vir do
-- formulário instantâneo (form_data) ou ser preenchido manualmente.
-- Coluna opcional — não quebra leads pré-migration.
-- ------------------------------------------------------------------
alter table leads add column if not exists email text;
create index if not exists idx_leads_email on leads(email) where email is not null;

-- ------------------------------------------------------------------
-- Listas de contatos (público próprio importado, fora do funil do CRM).
-- ------------------------------------------------------------------
create table if not exists email_lists (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now()
);

-- Contatos de uma lista. (list_id, email) tem índice para dedupe/lookup.
create table if not exists email_contacts (
  id           uuid        primary key default gen_random_uuid(),
  list_id      uuid        not null references email_lists(id) on delete cascade,
  email        text        not null,
  name         text,
  unsubscribed boolean     not null default false,
  created_at   timestamptz not null default now()
);

-- Um e-mail aparece no máximo uma vez por lista (evita duplicata na importação CSV).
create unique index if not exists idx_email_contacts_list_email
  on email_contacts(list_id, lower(email));

-- ------------------------------------------------------------------
-- Templates reutilizáveis (assunto + HTML).
-- ------------------------------------------------------------------
create table if not exists email_templates (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  subject    text,
  html       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_email_templates_updated_at on email_templates;
create trigger trg_email_templates_updated_at
  before update on email_templates
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------
-- Campanhas. audience (jsonb) descreve o público:
--   { "type": "leads", "filters": { "status": ["novo"], "tags": ["<tag_id>"] } }
--   { "type": "list",  "list_id": "<uuid>" }
-- ------------------------------------------------------------------
create table if not exists email_campaigns (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  subject     text,
  template_id uuid        references email_templates(id) on delete set null,
  html        text,
  audience    jsonb,
  status      text        not null default 'rascunho'
                check (status in ('rascunho','enviando','enviada','erro')),
  sent_count  int         not null default 0,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create index if not exists idx_email_campaigns_status on email_campaigns(status);

-- ------------------------------------------------------------------
-- Eventos de envio/engajamento por campanha.
-- ------------------------------------------------------------------
create table if not exists email_events (
  id            uuid        primary key default gen_random_uuid(),
  campaign_id   uuid        not null references email_campaigns(id) on delete cascade,
  contact_email text        not null,
  type          text        not null
                  check (type in ('sent','open','click','bounce','unsubscribe')),
  meta          jsonb,
  created_at    timestamptz not null default now()
);

-- Índice para os stats da campanha (contagem por tipo).
create index if not exists idx_email_events_campaign_type
  on email_events(campaign_id, type);

-- ------------------------------------------------------------------
-- Supressão GLOBAL de descadastro (opt-out). Conformidade legal: um email
-- aqui NUNCA recebe campanha, independente da lista/origem. Alimentada pela
-- rota pública /api/email/unsubscribe (link assinado no rodapé do email).
-- email é a PK (normalizado em minúsculas).
-- ------------------------------------------------------------------
create table if not exists email_unsubscribes (
  email       text        primary key,
  campaign_id uuid        references email_campaigns(id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- RLS: as funções serverless (Vercel) acessam via service_role, que
-- ignora RLS. Habilitar policies só quando expor leitura direta ao
-- front-end autenticado. Os endpoints de tracking (open/click) gravam
-- via service_role atrás de /api/email/track/* (sem login).
-- =====================================================================
-- alter table email_lists     enable row level security;
-- alter table email_contacts  enable row level security;
-- alter table email_templates enable row level security;
-- alter table email_campaigns enable row level security;
-- alter table email_events    enable row level security;
-- alter table email_unsubscribes enable row level security;
