-- =====================================================================
-- CRM WhatsApp — schema Supabase (Postgres)
-- Base do banco para a versao de producao (Supabase + Vercel).
-- Rode no SQL Editor do Supabase ou via `supabase db push`.
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
  follow_up_count  int not null default 0,        -- ate FOLLOWUP_MAX (ex: 30)
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
  created_at  timestamptz not null default now()
);

create index if not exists idx_messages_lead on messages(lead_id);
create index if not exists idx_leads_status on leads(status);
-- Indice que ajuda o motor de follow-up a achar leads pendentes.
create index if not exists idx_leads_followup
  on leads(status, last_direction, last_message_at)
  where last_direction = 'out';

-- updated_at automatico.
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at before update on leads
  for each row execute function set_updated_at();

-- =====================================================================
-- RLS: as funcoes serverless (Vercel) acessam via service_role, que
-- ignora RLS. Habilite RLS e crie policies so quando expor leitura
-- direta ao front-end autenticado (dashboard com Supabase Auth).
-- =====================================================================
-- alter table leads enable row level security;
-- alter table messages enable row level security;
