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
