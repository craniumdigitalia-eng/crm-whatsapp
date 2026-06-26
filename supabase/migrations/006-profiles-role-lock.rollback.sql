-- Rollback da migration 006 — remove a trava de role.
drop trigger if exists profiles_role_lock on public.profiles;
drop function if exists public.prevent_role_self_escalation();
