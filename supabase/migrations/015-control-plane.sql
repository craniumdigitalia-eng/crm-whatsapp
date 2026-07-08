-- 015-control-plane.sql — Schema control_plane: plano de controle central do SaaS.
-- Cria o schema separado `control_plane` dentro do Supabase atual da Cranium (ao lado
-- do schema `public` operacional), conforme ADR-008. Registra tenants (corretores),
-- billing (plans/subscriptions/invoices), idempotencia de webhook Asaas, super-admin
-- e auditoria de acoes administrativas.
--
-- IMPORTANTE: a instancia/CRM da Cranium NAO e um tenant do SaaS e NAO entra na
-- tabela `tenants`. O schema `public` (CRM interno) continua isolado; este schema
-- registra apenas os corretores clientes do SaaS.
--
-- Acesso exclusivamente server-side via service_role (que ignora RLS).
-- Nenhuma policy permissiva para anon/authenticated e criada: fechado por padrao.
-- O Data API publico do Supabase NAO deve expor este schema (configurar em
-- Settings > API > Exposed schemas se necessario).
--
-- Rollback em 015-control-plane.rollback.sql.
-- Aplique com: psql $DATABASE_URL -f supabase/migrations/015-control-plane.sql

-- ============================================================
-- Schema separado
-- ============================================================
create schema if not exists control_plane;

-- ============================================================
-- control_plane.tenants
-- Os corretores/clientes do SaaS. Cada linha e um deploy independente
-- (Supabase + Vercel + Evolution proprios do corretor).
-- Guarda apenas referencias/URLs do data-plane; NUNCA service-role key
-- nem segredo em texto simples (segredos ficam em env server-side).
-- ============================================================
create table if not exists control_plane.tenants (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  contact_email       text not null,
  contact_phone       text,                              -- E.164 recomendado
  status              text not null default 'provisioning'
                      check (status in ('provisioning','active','suspended','canceled')),

  -- Referencias do data-plane do corretor (URLs e identificadores, sem segredos)
  supabase_url        text,                              -- URL do projeto Supabase do corretor
  vercel_url          text,                              -- URL do deploy Vercel do corretor
  evolution_instance  text,                              -- nome da instancia Evolution do corretor

  -- Estado de provisionamento (6.2): rastreia etapas e permite retry idempotente
  provisioning_state  jsonb not null default '{}'::jsonb,
  -- Estrutura sugerida de provisioning_state:
  -- { "step": "supabase|vercel|evolution|done|error",
  --   "idempotency_key": "...",
  --   "error": null,
  --   "completed_steps": ["supabase", "vercel"] }

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists cp_tenants_status_idx        on control_plane.tenants (status);
create index if not exists cp_tenants_contact_email_idx on control_plane.tenants (contact_email);

alter table control_plane.tenants enable row level security;
-- Sem policies: acesso exclusivo via service_role server-side (ver cabecalho).

-- ============================================================
-- control_plane.plans
-- Planos de assinatura do SaaS. Hoje existe um unico plano ativo.
-- A tabela desacopla preco/cotas do codigo e permite ajuste futuro
-- sem deploy (alterar a linha ativa ou inserir nova).
-- ============================================================
create table if not exists control_plane.plans (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  price_cents           int not null check (price_cents >= 0),   -- preco em centavos
  quota_leads_mes       int not null default 500,                -- leads qualificados/mes
  quota_mensagens_mes   int not null default 10000,              -- mensagens de agente/mes
  quota_usuarios        int not null default 3,                  -- usuarios no portal do corretor
  trial_days            int not null default 7,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

create index if not exists cp_plans_active_idx on control_plane.plans (active);

alter table control_plane.plans enable row level security;
-- Sem policies: acesso exclusivo via service_role server-side.

-- Seed: plano unico R$997/mes (99700 centavos).
-- Cotas do plano unico: 500 leads/mes, 10000 mensagens/mes, 3 usuarios.
-- Ajuste as cotas conforme produto evoluir; NAO altere esta migration apos aplicada
-- (crie nova migration para mudar cotas de plano em producao).
insert into control_plane.plans
  (name, price_cents, quota_leads_mes, quota_mensagens_mes, quota_usuarios, trial_days, active)
select 'Plano unico', 99700, 500, 10000, 3, 7, true
where not exists (select 1 from control_plane.plans where name = 'Plano unico');

-- ============================================================
-- control_plane.subscriptions
-- Assinatura de um tenant a um plano. Um tenant ativo tem no maximo
-- uma assinatura em status trialing, active ou past_due por vez.
-- ============================================================
create table if not exists control_plane.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references control_plane.tenants (id) on delete restrict,
  plan_id                 uuid not null references control_plane.plans (id) on delete restrict,
  status                  text not null default 'trialing'
                          check (status in ('trialing','active','past_due','canceled','suspended')),
  asaas_customer_id       text,                          -- ID do cliente no Asaas
  asaas_subscription_id   text,                          -- ID da assinatura no Asaas
  trial_ends_at           timestamptz,                   -- fim do periodo de trial
  current_period_end      timestamptz,                   -- fim do periodo de cobranca atual
  started_at              timestamptz not null default now(),
  canceled_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists cp_subscriptions_tenant_idx          on control_plane.subscriptions (tenant_id);
create index if not exists cp_subscriptions_status_idx          on control_plane.subscriptions (status);
create index if not exists cp_subscriptions_period_end_idx      on control_plane.subscriptions (current_period_end);
create index if not exists cp_subscriptions_asaas_customer_idx  on control_plane.subscriptions (asaas_customer_id);

alter table control_plane.subscriptions enable row level security;
-- Sem policies: acesso exclusivo via service_role server-side.

-- ============================================================
-- control_plane.subscription_events
-- Log imutavel de transicoes de status da assinatura (AC2 da 6.1).
-- Cada mudanca de status gera uma linha aqui: quem mudou, de onde, para onde e por que.
-- ============================================================
create table if not exists control_plane.subscription_events (
  id                uuid primary key default gen_random_uuid(),
  subscription_id   uuid not null references control_plane.subscriptions (id) on delete restrict,
  from_status       text,                                -- null = criacao da assinatura
  to_status         text not null,
  reason            text,                                -- descricao humana da mudanca
  source            text not null default 'webhook'
                    check (source in ('webhook','cron','admin')),
  created_at        timestamptz not null default now()
);

create index if not exists cp_sub_events_subscription_idx on control_plane.subscription_events (subscription_id);
create index if not exists cp_sub_events_created_idx      on control_plane.subscription_events (created_at);

alter table control_plane.subscription_events enable row level security;
-- Sem policies: acesso exclusivo via service_role server-side.

-- ============================================================
-- control_plane.invoices
-- Faturas geradas pelo Asaas. Indice unico em asaas_invoice_id garante
-- idempotencia: reenvio do mesmo webhook nao duplica fatura (AC3 da 6.1).
-- ============================================================
create table if not exists control_plane.invoices (
  id                uuid primary key default gen_random_uuid(),
  subscription_id   uuid not null references control_plane.subscriptions (id) on delete restrict,
  asaas_invoice_id  text not null,                       -- ID unico da cobranca no Asaas (dedupe)
  amount_cents      int not null check (amount_cents >= 0),
  status            text not null default 'pending'
                    check (status in ('pending','paid','overdue','canceled')),
  due_date          date,
  paid_at           timestamptz,
  receipt_url       text,                                -- link do comprovante no Asaas
  needs_nf          boolean not null default true,       -- gancho para emissao de NF (story 8.2)
  created_at        timestamptz not null default now()
);

create unique index if not exists cp_invoices_asaas_id_idx  on control_plane.invoices (asaas_invoice_id);
create index if not exists cp_invoices_subscription_idx     on control_plane.invoices (subscription_id);
create index if not exists cp_invoices_status_idx           on control_plane.invoices (status);
create index if not exists cp_invoices_due_date_idx         on control_plane.invoices (due_date);

alter table control_plane.invoices enable row level security;
-- Sem policies: acesso exclusivo via service_role server-side.

-- ============================================================
-- control_plane.webhook_events
-- Dedupe de eventos recebidos do Asaas (AC3 da 6.1).
-- Antes de processar qualquer webhook, inserir aqui com ON CONFLICT DO NOTHING.
-- Se a insercao retornar 0 linhas, o evento ja foi processado: ignorar.
-- external_id e o ID nativo do evento no gateway (campo "id" do payload Asaas).
-- ============================================================
create table if not exists control_plane.webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null default 'asaas',
  external_id   text not null,                           -- ID do evento no gateway (dedupe)
  payload       jsonb not null default '{}'::jsonb,      -- payload completo para auditoria/replay
  processed_at  timestamptz,                             -- null = recebido mas nao processado ainda
  created_at    timestamptz not null default now(),
  constraint cp_webhook_events_provider_external_id_key unique (provider, external_id)
);

create index if not exists cp_webhook_events_created_idx on control_plane.webhook_events (created_at);

alter table control_plane.webhook_events enable row level security;
-- Sem policies: acesso exclusivo via service_role server-side.

-- ============================================================
-- control_plane.admins
-- Super-admins do SaaS (papel acima de admin/atendente da story 5.2).
-- Referencia auth.users (Supabase Auth); um usuario autenticado pode ter
-- papel super-admin sem ser tenant.
-- ============================================================
create table if not exists control_plane.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table control_plane.admins enable row level security;
-- Sem policies: acesso exclusivo via service_role server-side.
-- O middleware do painel super-admin verifica a presenca do user_id aqui
-- antes de dar acesso (server-side, nunca client-side).

-- ============================================================
-- control_plane.admin_actions
-- Auditoria de acoes administrativas sensíveis: suspender/reativar tenant,
-- alterar plano, etc. (AC4 da 6.3). Log imutavel: nunca delete linhas aqui.
-- ============================================================
create table if not exists control_plane.admin_actions (
  id              uuid primary key default gen_random_uuid(),
  admin_user_id   uuid not null references auth.users (id) on delete restrict,
  tenant_id       uuid references control_plane.tenants (id) on delete restrict,
  action          text not null,                         -- ex.: 'suspend', 'reactivate', 'cancel'
  detail          jsonb not null default '{}'::jsonb,    -- contexto adicional da acao
  created_at      timestamptz not null default now()
);

create index if not exists cp_admin_actions_admin_idx   on control_plane.admin_actions (admin_user_id);
create index if not exists cp_admin_actions_tenant_idx  on control_plane.admin_actions (tenant_id);
create index if not exists cp_admin_actions_created_idx on control_plane.admin_actions (created_at);

alter table control_plane.admin_actions enable row level security;
-- Sem policies: acesso exclusivo via service_role server-side.
