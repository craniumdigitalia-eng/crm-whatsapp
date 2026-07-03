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
