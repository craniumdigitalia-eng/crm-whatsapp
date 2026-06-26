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
