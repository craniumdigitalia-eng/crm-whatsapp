-- Migration 005 (OPCIONAL) — RLS defense-in-depth nas tabelas de negocio (Story 5.2)
--
-- POR QUE E OPCIONAL:
-- O acesso de dados do CRM e feito SERVER-SIDE com a service_role key (src/db.ts),
-- que IGNORA RLS, sempre atras do gate de auth dos Route Handlers (lib/auth.ts).
-- Habilitar RLS aqui e defesa-em-profundidade: se algum dia um client usar a anon key
-- direto (ex.: Supabase JS no browser), ele NAO conseguira ler/gravar estas tabelas.
--
-- EFEITO: enable RLS + NENHUMA policy => anon/authenticated recebem ZERO linhas;
-- a service_role continua com acesso total (bypassa RLS). Nada no app atual quebra,
-- pois tudo passa pela service_role no servidor.
--
-- APLIQUE SO DEPOIS de confirmar que nenhum caminho do app le estas tabelas com a anon key.
-- (No momento, nenhum le — o unico uso da anon key e auth/sessao.)

alter table public.leads               enable row level security;
alter table public.messages            enable row level security;
alter table public.tags                enable row level security;
alter table public.lead_tags           enable row level security;
alter table public.checklist_items     enable row level security;
alter table public.integrations_config enable row level security;

-- Sem policies de propósito: bloqueia anon/authenticated por completo.
-- Se no futuro o portal passar a ler via anon key com sessao, adicione policies
-- `to authenticated using (...)` por tabela conforme o modelo de acesso.
