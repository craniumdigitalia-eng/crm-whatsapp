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
