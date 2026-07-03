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
