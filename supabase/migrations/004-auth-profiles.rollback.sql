-- Rollback da migration 004 — Auth & Profiles (Story 5.2)
-- Remove o trigger, a funcao, as policies e a tabela profiles.
-- Nao remove usuarios do Supabase Auth (gerencie via painel / auth.admin).

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop policy if exists "profiles_self_update" on public.profiles;
drop policy if exists "profiles_self_select" on public.profiles;

drop table if exists public.profiles;
