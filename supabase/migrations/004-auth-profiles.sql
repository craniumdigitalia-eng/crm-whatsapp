-- Migration 004 — Auth & Profiles (Story 5.2)
-- Cria a tabela `profiles` (1:1 com auth.users), o papel (role) para RBAC leve,
-- e um trigger que cria o profile automaticamente a cada novo usuario do Supabase Auth.
--
-- Contexto de seguranca: o portal agora exige login (Supabase Auth). O acesso de DADOS
-- do CRM continua server-side via service_role (que IGNORA RLS), sempre atras do gate de
-- auth nos Route Handlers (lib/auth.ts). A RLS abaixo protege a propria tabela profiles.
-- RLS nas tabelas de negocio (leads/tags/...) e tratada separadamente em 005 (opcional).

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nome       text,
  role       text not null default 'atendente' check (role in ('admin', 'atendente')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil do usuario do portal (1:1 com auth.users). role = admin | atendente (RBAC leve, Story 5.2).';

-- RLS: cada usuario le e atualiza apenas o proprio perfil.
-- Importante: o `role` NUNCA deve ser autoeditavel para escalar privilegio — por isso
-- o UPDATE abaixo permite o usuario editar o proprio registro, mas a troca de role e
-- feita server-side via service_role (script de admin / futura tela de gestao).
alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Cria o profile automaticamente quando um usuario e criado no Supabase Auth.
-- SECURITY DEFINER e necessario porque o trigger roda no contexto do Auth (sem auth.uid()).
-- search_path fixo evita sequestro de schema.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
