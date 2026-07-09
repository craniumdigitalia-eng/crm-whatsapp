-- Migration 016 — RLS defense-in-depth: tabelas de email marketing + follow_up_schedule
--
-- Por que: a migration 007 criou as tabelas de email com o bloco de `enable row level
-- security` COMENTADO ("habilitar so quando expor leitura direta ao front-end"). A 008
-- criou follow_up_schedule sem RLS. Ambos os modulos acessam via service_role (que ignora
-- RLS), entao habilitar aqui nao quebra nenhum caminho do app — so fecha a brecha da
-- anon key na Data API (PostgREST).
--
-- Efeito: enable RLS sem policies => anon/authenticated recebem ZERO linhas via PostgREST.
-- service_role continua com acesso total (bypassa RLS por design do Supabase).
--
-- Precondicion: migrations 007 (email_*) e 008 (follow_up_schedule) ja aplicadas.
-- Rollback: 016-rls-email-followup.rollback.sql
-- Data: 2026-07-09

alter table public.email_lists        enable row level security;
alter table public.email_contacts     enable row level security;
alter table public.email_templates    enable row level security;
alter table public.email_campaigns    enable row level security;
alter table public.email_events       enable row level security;
alter table public.email_unsubscribes enable row level security;
alter table public.follow_up_schedule enable row level security;

-- Sem policies de proposito: bloqueio total de anon/authenticated.
-- Se no futuro o portal passar a ler campanhas/templates via sessao autenticada,
-- adicionar policies `to authenticated using (...)` por tabela conforme o modelo de acesso.
