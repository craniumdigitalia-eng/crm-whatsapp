-- ============================================================
-- SCHEMA COMPLETO — CRM Cranium (provisionamento de cliente novo)
-- Rode ESTE arquivo INTEIRO no SQL Editor do Supabase do cliente.
-- Consolida schema.sql + migrations 002 a 014 (idempotente).
-- ============================================================


-- >>>>>>>>>> schema.sql <<<<<<<<<<

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

-- =====================================================================
-- Migration 007 — Email Marketing (v1)
-- Listas/contatos, templates, campanhas e eventos — 2026-06-26
-- Arquivo formal: supabase/migrations/007-email-marketing.sql
-- =====================================================================

-- E-mail do lead (destinatário "base do CRM"). Opcional — pode vir do
-- form_data do Meta Lead Ads ou ser preenchido manualmente.
alter table leads add column if not exists email text;
create index if not exists idx_leads_email on leads(email) where email is not null;

-- Listas de contatos (público importado, fora do funil).
create table if not exists email_lists (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now()
);

create table if not exists email_contacts (
  id           uuid        primary key default gen_random_uuid(),
  list_id      uuid        not null references email_lists(id) on delete cascade,
  email        text        not null,
  name         text,
  unsubscribed boolean     not null default false,
  created_at   timestamptz not null default now()
);

create unique index if not exists idx_email_contacts_list_email
  on email_contacts(list_id, lower(email));

-- Templates reutilizáveis (assunto + HTML).
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

-- Campanhas. audience (jsonb): {type:'leads',filters:{status,tags}} ou {type:'list',list_id}.
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

-- Eventos de envio/engajamento por campanha.
create table if not exists email_events (
  id            uuid        primary key default gen_random_uuid(),
  campaign_id   uuid        not null references email_campaigns(id) on delete cascade,
  contact_email text        not null,
  type          text        not null
                  check (type in ('sent','open','click','bounce','unsubscribe')),
  meta          jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_email_events_campaign_type
  on email_events(campaign_id, type);

-- Supressão global de descadastro (opt-out) — um email aqui nunca recebe campanha.
create table if not exists email_unsubscribes (
  email       text        primary key,
  campaign_id uuid        references email_campaigns(id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);

-- RLS (comentado — acesso via service_role):
-- alter table email_lists     enable row level security;
-- alter table email_contacts  enable row level security;
-- alter table email_templates enable row level security;
-- alter table email_campaigns enable row level security;
-- alter table email_events    enable row level security;
-- alter table email_unsubscribes enable row level security;

-- =====================================================================
-- Follow-up agendado por lead (migration 008).
-- Programa um follow-up especifico ("lembrar o lead X em 2 dias com esta
-- mensagem"). Complementa o follow-up automatico (leads.follow_up_count).
-- =====================================================================
create table if not exists follow_up_schedule (
  id           uuid        primary key default gen_random_uuid(),
  lead_id      uuid        not null references leads(id) on delete cascade,
  scheduled_at timestamptz not null,
  message      text        not null,
  status       text        not null default 'pendente'
                 check (status in ('pendente','enviado','cancelado','erro')),
  created_by   uuid,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);

create index if not exists idx_follow_up_schedule_due
  on follow_up_schedule(status, scheduled_at);
create index if not exists idx_follow_up_schedule_lead
  on follow_up_schedule(lead_id);

-- >>>>>>>>>> 002-tags-checklists.sql <<<<<<<<<<

-- =====================================================================
-- Migration 002 — Etiquetas (tags) e Checklists
-- Stories 5.12 e 5.13
-- Data: 2026-06-25
-- Rollback: 002-tags-checklists.rollback.sql
-- =====================================================================
-- Pré-requisito: schema base (supabase/schema.sql) já aplicado.
-- A função set_updated_at() e a tabela leads devem existir.
-- =====================================================================

-- ------------------------------------------------------------------
-- Story 5.12 — Etiquetas (tags) nos leads
-- ------------------------------------------------------------------

-- Catálogo de etiquetas disponíveis na conta.
create table if not exists tags (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null unique,
  color      text        not null default '#7C3AED',
  created_at timestamptz not null default now()
);

-- Relação many-to-many: um lead pode ter N etiquetas; uma etiqueta N leads.
create table if not exists lead_tags (
  lead_id uuid not null references leads(id) on delete cascade,
  tag_id  uuid not null references tags(id)  on delete cascade,
  primary key (lead_id, tag_id)
);

-- Índice para filtrar leads por etiqueta (query de board filtrado).
create index if not exists idx_lead_tags_tag_id on lead_tags(tag_id);

-- ------------------------------------------------------------------
-- Story 5.13 — Checklists dentro do lead
-- ------------------------------------------------------------------

-- Itens de checklist vinculados a um lead.
create table if not exists checklist_items (
  id         uuid        primary key default gen_random_uuid(),
  lead_id    uuid        not null references leads(id) on delete cascade,
  text       text        not null,
  done       boolean     not null default false,
  position   int         not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índice para buscar e ordenar itens de um lead eficientemente.
create index if not exists idx_checklist_items_lead_position
  on checklist_items(lead_id, position);

-- Trigger de updated_at — reutiliza set_updated_at() já existente no schema base.
drop trigger if exists trg_checklist_items_updated_at on checklist_items;
create trigger trg_checklist_items_updated_at
  before update on checklist_items
  for each row execute function set_updated_at();

-- =====================================================================
-- RLS: comentado por ora; habilitar junto com leads/messages quando o
-- dashboard fizer queries diretas via Supabase Auth.
-- =====================================================================
-- alter table tags            enable row level security;
-- alter table lead_tags       enable row level security;
-- alter table checklist_items enable row level security;

-- >>>>>>>>>> 003-lead-attribution.sql <<<<<<<<<<

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

-- >>>>>>>>>> 004-auth-profiles.sql <<<<<<<<<<

-- Migration 004 — Auth & Profiles (Story 5.2)
-- Cria a tabela `profiles` (1:1 com auth.users), o papel (role) para RBAC leve,
-- e um trigger que cria o profile automaticamente a cada novo usuario do Supabase Auth.
--
-- Contexto de seguranca: o portal agora exige login (Supabase Auth). O acesso de DADOS
-- do CRM continua server-side via service_role (que IGNORA RLS), sempre atras do gate de
-- auth nos Route Handlers (lib/auth.ts). A RLS abaixo protege a propria tabela profiles.
-- RLS nas tabelas de negocio (leads/tags/...) e tratada separadamente em 005 (opcional).

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nome       text,
  role       text not null default 'atendente' check (role in ('admin', 'atendente')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil do usuario do portal (1:1 com auth.users). role = admin | atendente (RBAC leve, Story 5.2).';

-- RLS: cada usuario le e atualiza apenas o proprio perfil.
-- Importante: o `role` NUNCA deve ser autoeditavel para escalar privilegio — por isso
-- o UPDATE abaixo permite o usuario editar o proprio registro, mas a troca de role e
-- feita server-side via service_role (script de admin / futura tela de gestao).
alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Cria o profile automaticamente quando um usuario e criado no Supabase Auth.
-- SECURITY DEFINER e necessario porque o trigger roda no contexto do Auth (sem auth.uid()).
-- search_path fixo evita sequestro de schema.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- >>>>>>>>>> 005-rls-business-tables.optional.sql <<<<<<<<<<

-- Migration 005 (OPCIONAL) — RLS defense-in-depth nas tabelas de negocio (Story 5.2)
--
-- POR QUE E OPCIONAL:
-- O acesso de dados do CRM e feito SERVER-SIDE com a service_role key (src/db.ts),
-- que IGNORA RLS, sempre atras do gate de auth dos Route Handlers (lib/auth.ts).
-- Habilitar RLS aqui e defesa-em-profundidade: se algum dia um client usar a anon key
-- direto (ex.: Supabase JS no browser), ele NAO conseguira ler/gravar estas tabelas.
--
-- EFEITO: enable RLS + NENHUMA policy => anon/authenticated recebem ZERO linhas;
-- a service_role continua com acesso total (bypassa RLS). Nada no app atual quebra,
-- pois tudo passa pela service_role no servidor.
--
-- APLIQUE SO DEPOIS de confirmar que nenhum caminho do app le estas tabelas com a anon key.
-- (No momento, nenhum le — o unico uso da anon key e auth/sessao.)

alter table public.leads               enable row level security;
alter table public.messages            enable row level security;
alter table public.tags                enable row level security;
alter table public.lead_tags           enable row level security;
alter table public.checklist_items     enable row level security;
alter table public.integrations_config enable row level security;

-- Sem policies de propósito: bloqueia anon/authenticated por completo.
-- Se no futuro o portal passar a ler via anon key com sessao, adicione policies
-- `to authenticated using (...)` por tabela conforme o modelo de acesso.

-- >>>>>>>>>> 006-profiles-role-lock.sql <<<<<<<<<<

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

-- >>>>>>>>>> 007-email-marketing.sql <<<<<<<<<<

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

-- >>>>>>>>>> 008-followup-schedule.sql <<<<<<<<<<

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

-- >>>>>>>>>> 009-profile-settings.sql <<<<<<<<<<

-- Migration 009 — Perfil: foto (avatar) + bucket de Storage (Story 5.2, tela /config)
--
-- Adiciona a coluna `avatar_url` em profiles e cria o bucket público `avatars`
-- no Supabase Storage, com policies que deixam cada usuário gerenciar APENAS a
-- própria pasta (`{user_id}/...`). A leitura é pública (a foto aparece na sidebar
-- e no portal sem precisar de sessão para servir a imagem).
--
-- Restrições do bucket:
--   - Tamanho máximo por arquivo: 2 MB (2097152 bytes). Bloqueia uploads abusivos.
--   - MIME types permitidos: image/jpeg, image/png, image/webp. Rejeita qualquer outro
--     formato (PDF, executável, SVG com scripts, etc.) diretamente no Storage.
--
-- Aplique no SQL Editor do Supabase. Idempotente (pode rodar de novo sem erro).

-- 1) Coluna da foto no perfil ---------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'URL pública da foto de perfil (bucket Storage `avatars`). Editável pelo próprio usuário em /config.';

-- 2) Bucket de avatares (público para leitura, com limites de tamanho e MIME) -----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,                                              -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3) Policies de Storage --------------------------------------------------------
-- Leitura pública das imagens do bucket.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

-- Upload: só na própria pasta (primeiro segmento do path = uid do usuário).
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Update (upsert) da própria pasta.
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Delete da própria pasta (trocar/remover foto).
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- >>>>>>>>>> 010-lead-photo.sql <<<<<<<<<<

-- Migration 010 — Foto do lead (foto de perfil do WhatsApp)
--
-- Adiciona a coluna `photo_url` em leads, preenchida com a URL da foto de perfil
-- do contato no WhatsApp (buscada via Evolution fetchProfilePictureUrl). A foto
-- aparece no avatar das Conversas, do kanban e da ficha do lead.
--
-- Aplique no SQL Editor do Supabase. Idempotente.

alter table public.leads
  add column if not exists photo_url text;

comment on column public.leads.photo_url is
  'URL da foto de perfil do WhatsApp do lead (Evolution fetchProfilePictureUrl). Pode ser nula.';

-- >>>>>>>>>> 011-finance.sql <<<<<<<<<<

-- 011-finance.sql — Módulo Financeiro da Cranium (gestão do próprio negócio).
-- Painel de fluxo financeiro: clientes pagantes (MRR), receitas avulsas e
-- despesas (fixas/variáveis), base do DRE por período. Entrada manual.
-- Aplicar no SQL editor do Supabase. Rollback em 011-finance.rollback.sql.

-- ============================================================
-- Clientes pagantes da Cranium (recorrência = MRR).
-- ============================================================
create table if not exists public.fin_clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  monthly_value numeric(12,2) not null default 0,     -- mensalidade (contribui pro MRR)
  billing_day   int check (billing_day between 1 and 31),
  status        text not null default 'ativo'
                check (status in ('ativo','atrasado','cancelado')),
  started_at    date not null default current_date,   -- início do contrato
  canceled_at   date,                                  -- data do churn (quando cancelado)
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists fin_clients_status_idx on public.fin_clients (status);
create index if not exists fin_clients_started_idx on public.fin_clients (started_at);

-- ============================================================
-- Receitas avulsas / pontuais (projetos, setup, extras).
-- A recorrência NÃO fica aqui: ela é derivada de fin_clients.
-- ============================================================
create table if not exists public.fin_revenue (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.fin_clients (id) on delete set null,
  description  text not null,
  amount       numeric(12,2) not null,
  received_on  date not null default current_date,     -- competência/data do recebimento
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists fin_revenue_received_idx on public.fin_revenue (received_on);

-- ============================================================
-- Despesas (fixas recorrentes ou variáveis avulsas).
-- Recorrente: conta todo mês entre start_date e end_date (null = ativa).
-- Avulsa: conta uma vez em start_date.
-- ============================================================
create table if not exists public.fin_expenses (
  id           uuid primary key default gen_random_uuid(),
  description  text not null,
  category     text not null default 'outros',         -- infra, ferramentas, salarios, impostos, marketing, outros
  amount       numeric(12,2) not null,
  recurring    boolean not null default false,         -- fixa mensal?
  start_date   date not null default current_date,      -- início (recorrente) ou data (avulsa)
  end_date     date,                                     -- fim da recorrente (null = ativa)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists fin_expenses_start_idx on public.fin_expenses (start_date);
create index if not exists fin_expenses_recurring_idx on public.fin_expenses (recurring);

-- ============================================================
-- RLS: habilitada sem policies públicas. Todo acesso é server-side
-- via service_role (que ignora RLS) nas rotas /api protegidas por login.
-- anon/authenticated não acessam diretamente (defesa em profundidade).
-- ============================================================
alter table public.fin_clients  enable row level security;
alter table public.fin_revenue  enable row level security;
alter table public.fin_expenses enable row level security;

-- >>>>>>>>>> 012-demands.sql <<<<<<<<<<

-- 012-demands.sql — Quadro de Demandas dos grupos de WhatsApp.
-- Clientes postam demandas nos grupos (gatilho "demanda"); a IA resume e
-- classifica, e vira card num kanban (aba Demandas). Aplicar no SQL editor.

-- Demandas (cards do quadro).
create table if not exists public.demands (
  id            uuid primary key default gen_random_uuid(),
  external_id   text,                        -- key.id do webhook (dedupe de reentrega)
  group_jid     text not null,               -- id do grupo (...@g.us)
  group_name    text,                        -- nome/assunto do grupo (best-effort)
  sender_phone  text,                        -- quem pediu (participante do grupo)
  sender_name   text,
  category      text not null default 'Outro',
  summary       text not null,               -- resumo da IA
  original_text text,                         -- o que foi dito
  status        text not null default 'aberta'
                check (status in ('aberta','andamento','concluida')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists demands_status_idx on public.demands (status);
create index if not exists demands_created_idx on public.demands (created_at);
-- Dedupe: nao cria dois cards para a mesma mensagem reentregue pela Evolution.
create unique index if not exists demands_external_uidx
  on public.demands (external_id) where external_id is not null;

-- Estado transitorio: sender que acionou "demanda" sem descrever ainda.
-- A proxima mensagem dele naquele grupo vira a demanda.
create table if not exists public.demand_pending (
  group_jid    text not null,
  sender_phone text not null,
  created_at   timestamptz not null default now(),
  primary key (group_jid, sender_phone)
);

alter table public.demands        enable row level security;
alter table public.demand_pending enable row level security;

-- >>>>>>>>>> 013-group-messages.sql <<<<<<<<<<

-- 013-group-messages.sql — Histórico de mensagens dos GRUPOS de WhatsApp, para
-- a aba Grupos funcionar como um inbox (igual Conversas, mas de grupos).
-- Guardamos daqui pra frente (a Evolution não persiste histórico de grupo).

create table if not exists public.group_messages (
  id           uuid primary key default gen_random_uuid(),
  external_id  text,                    -- key.id (dedupe de reentrega/eco)
  group_jid    text not null,           -- id do grupo (...@g.us)
  direction    text not null default 'in' check (direction in ('in','out')),
  sender_phone text,                    -- participante que enviou
  sender_name  text,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists group_messages_jid_idx on public.group_messages (group_jid, created_at);
create unique index if not exists group_messages_external_uidx
  on public.group_messages (external_id) where external_id is not null;

alter table public.group_messages enable row level security;

-- >>>>>>>>>> 014-agent-assets.sql <<<<<<<<<<

-- 014-agent-assets.sql — Materiais/provas que o agente de IA envia ao lead
-- (prints de campanha, resultados de clientes, "como o lead chega"). As imagens
-- ficam no bucket público 'agent-assets' (Storage); a metadata fica aqui.

create table if not exists public.agent_assets (
  id         uuid primary key default gen_random_uuid(),
  category   text not null default 'outro'
             check (category in ('campanha','resultado','como_chega','depoimento','outro')),
  label      text not null,                 -- nome interno (ex.: "Campanha plano PME jun")
  caption    text,                          -- legenda enviada junto da imagem no WhatsApp
  url        text not null,                 -- URL pública da imagem
  path       text not null,                 -- caminho no Storage (para deletar)
  active     boolean not null default true, -- se a IA pode enviar
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists agent_assets_cat_idx on public.agent_assets (category, active);

alter table public.agent_assets enable row level security;
