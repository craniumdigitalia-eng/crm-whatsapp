-- Rollback da migration 016 — desabilita RLS em email_* e follow_up_schedule
-- Usar no SQL Editor do Supabase se o smoke-check pos-016 falhar.
-- Prerequisito: a migration 016 ter sido aplicada.

alter table public.email_lists        disable row level security;
alter table public.email_contacts     disable row level security;
alter table public.email_templates    disable row level security;
alter table public.email_campaigns    disable row level security;
alter table public.email_events       disable row level security;
alter table public.email_unsubscribes disable row level security;
alter table public.follow_up_schedule disable row level security;
