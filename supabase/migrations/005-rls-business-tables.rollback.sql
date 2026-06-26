-- Rollback da migration 005 (OPCIONAL) — desabilita a RLS das tabelas de negocio.
alter table public.leads               disable row level security;
alter table public.messages            disable row level security;
alter table public.tags                disable row level security;
alter table public.lead_tags           disable row level security;
alter table public.checklist_items     disable row level security;
alter table public.integrations_config disable row level security;
