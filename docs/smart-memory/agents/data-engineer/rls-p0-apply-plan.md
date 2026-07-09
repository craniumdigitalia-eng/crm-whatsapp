---
title: Plano de aplicacao RLS P0-2 — tabelas de negocio
type: reference
agent: data-engineer
created: 2026-07-09
tags: [rls, security, p0, migration, auditoria-robustez, saas]
related: ["[[agents/data-engineer/rls-ac3-validation]]", "[[agents/data-engineer/migration-apply-order]]", "[[agents/qa/auditoria-robustez-2026-07-09]]"]
---

# Plano de aplicacao RLS P0-2 — tabelas de negocio

Data: 2026-07-09. Escopo: analise de impacto + SQL pronto para o lead aplicar via SQL Editor.

---

## Veredicto

**SEGURO APLICAR. Nenhum caminho do app sera quebrado.**

Evidencias:

1. Todo acesso de dados de negocio (`leads`, `messages`, `tags`, `lead_tags`,
   `checklist_items`, `integrations_config`) passa por `src/db.ts` com `supabaseServiceRoleKey`,
   que bypassa RLS por design do Supabase.
2. Os clientes com `anon key` (`lib/supabase/client.ts` — browser, `lib/supabase/server.ts` — SSR,
   `lib/supabase/middleware.ts`) acessam **somente** `profiles` (auth/sessao) e Storage `avatars`.
   Nenhuma rota de `/api/leads`, `/api/messages`, `/api/tags`, etc. importa `lib/supabase/server`
   ou `lib/supabase/client` — todas importam `lib/auth.ts` (para gate de sessao) e depois acessam
   dados via service_role.
3. Grep em `app/`, `components/` e `lib/` confirma: zero `.from()` em tabelas de negocio via anon key.

Aplicar a migration 005 apenas fecha a brecha da Data API (PostgREST): hoje a anon key consegue
ler e inserir em `leads`/`messages` diretamente (comprovado pelo AC5 na auditoria). Pos-005,
anon e authenticated recebem zero linhas e zero permissao de escrita nessas tabelas.

---

## Tabelas cobertas pela migration 005

| Tabela | RLS habilitado? | Observacao |
|---|---|---|
| `public.leads` | Sim (005) | Core do CRM |
| `public.messages` | Sim (005) | Historico do atendimento |
| `public.tags` | Sim (005) | Etiquetas |
| `public.lead_tags` | Sim (005) | Relacao lead-tag |
| `public.checklist_items` | Sim (005) | Checklist por lead |
| `public.integrations_config` | Sim (005) | Segredos de integracao |

---

## Tabelas com RLS ja aplicado (migrations posteriores)

Estas tabelas ja chegaram com `enable row level security` no proprio SQL de criacao:

| Tabela | Migration | Sem policies (bloqueio total) |
|---|---|---|
| `public.fin_clients` | 011-finance.sql | Sim |
| `public.fin_revenue` | 011-finance.sql | Sim |
| `public.fin_expenses` | 011-finance.sql | Sim |
| `public.demands` | 012-demands.sql | Sim |
| `public.demand_pending` | 012-demands.sql | Sim |
| `public.group_messages` | 013-group-messages.sql | Sim |
| `public.agent_assets` | 014-agent-assets.sql | Sim |

---

## Tabelas SEM RLS — lacunas identificadas

As tabelas abaixo sao exclusivamente server-side via service_role hoje. Sem risco imediato.
Porem, para completar o hardening P0-2, a migration complementar 016 as cobre.

| Tabela | Migration origem | Por que colocar RLS |
|---|---|---|
| `public.email_lists` | 007-email-marketing.sql | Dados internos de marketing (listas importadas) |
| `public.email_contacts` | 007-email-marketing.sql | PII (email, nome) de contatos importados |
| `public.email_templates` | 007-email-marketing.sql | Conteudo de campanhas |
| `public.email_campaigns` | 007-email-marketing.sql | Campanhas com status e contagem de envios |
| `public.email_events` | 007-email-marketing.sql | Rastreamento de opens/clicks (dados de engajamento) |
| `public.email_unsubscribes` | 007-email-marketing.sql | Lista de supressao legal — PII senssivel |
| `public.follow_up_schedule` | 008-followup-schedule.sql | Agenda de follow-up por lead |

A migration 007 incluiu as linhas de `enable row level security` COMENTADAS com um aviso
"habilitar so quando expor leitura direta ao front-end". A 008 nao incluiu o `enable`.
Padrao defensivo correto seria habilitar agora e adicionar policies depois se precisar.
A 016 faz isso.

---

## Pontos de risco

Nenhum risco de quebra de app foi identificado. Os riscos residuais sao:

| # | Tipo | Detalhe | Mitigacao |
|---|---|---|---|
| Risco A | Futura regressao | Se um desenvolvedor adicionar `.from('leads')` num Server Component com `createClient()` (anon), vai receber 0 linhas e pode se confundir. | O comentario em `lib/supabase/server.ts` ja avisa: "acesso de DADOS do CRM continua via service_role em src/db.ts". Reforcar em CLAUDE.md se necessario. |
| Risco B | Realtime client-side | Se o portal implementar subscricoes Realtime em `leads` no browser, vai precisar de policies `to authenticated using (...)`. | Nao ha uso de Realtime hoje. |
| Risco C | `follow_up_schedule` sem RLS (parcial) | A 008 nao habilitou RLS. Acesso atual e somente server-side, mas sem a 016 a porta da Data API fica aberta. | Aplicar 016. |

---

## SQL exato para o SQL Editor

### Passo 1: migration 006 (role-lock no trigger de profiles) — se ainda nao aplicada

Cole o conteudo de `supabase/migrations/006-profiles-role-lock.sql`.

Smoke-check pos-006:
```sql
select proname from pg_proc where proname = 'prevent_role_self_escalation';
-- esperado: 1 linha

select tgname, tgenabled from pg_trigger where tgname = 'profiles_role_lock';
-- esperado: 1 linha, tgenabled = 'O'
```

### Passo 2: migration 005 (RLS core — tabelas de negocio)

```sql
-- Migration 005 — RLS defense-in-depth nas tabelas de negocio (Story 5.2, P0-2)
alter table public.leads               enable row level security;
alter table public.messages            enable row level security;
alter table public.tags                enable row level security;
alter table public.lead_tags           enable row level security;
alter table public.checklist_items     enable row level security;
alter table public.integrations_config enable row level security;
```

Smoke-checks pos-005:
```sql
-- RLS ativo nas 6 tabelas (deve retornar 6 linhas com rowsecurity = 't'):
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('leads','messages','tags','lead_tags','checklist_items','integrations_config')
order by tablename;

-- Nenhuma policy nessas tabelas (deve retornar 0 linhas):
select tablename, count(*) as qtd_policies
from pg_policies
where schemaname = 'public'
  and tablename in ('leads','messages','tags','lead_tags','checklist_items','integrations_config')
group by tablename;
```

Rollback rapido (se algo falhar):
```sql
alter table public.leads               disable row level security;
alter table public.messages            disable row level security;
alter table public.tags                disable row level security;
alter table public.lead_tags           disable row level security;
alter table public.checklist_items     disable row level security;
alter table public.integrations_config disable row level security;
```

### Passo 3: migration 016 (RLS tabelas de email + follow_up_schedule) — recomendado

Cole o conteudo de `supabase/migrations/016-rls-email-followup.sql` (criado neste plano).

Smoke-check pos-016:
```sql
-- Deve retornar 7 linhas com rowsecurity = 't':
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'email_lists','email_contacts','email_templates',
    'email_campaigns','email_events','email_unsubscribes',
    'follow_up_schedule'
  )
order by tablename;
```

### Passo 4: migration 009 (avatar_url + bucket avatars) — se ainda nao aplicada

Cole o conteudo de `supabase/migrations/009-profile-settings.sql`.

---

## Validacao pos-apply com o runner e2e

Apos aplicar 005 (e opcionalmente 006), rodar:

```bash
# 1. Subir o dev server
npm run dev

# 2. Em outro terminal, com as variaveis do .env carregadas:
STRICT_RLS=1 node scripts/test/ac5-negative.mjs
```

Resultado esperado:
- R1: `anon select leads(sentinela) -> 0 linhas [bloqueado]` — PASS
- R2: `anon select messages(sentinela) -> 0 linhas [bloqueado]` — PASS
- R3: `anon insert leads -> negado [bloqueado]` — PASS
- R4: `atendente PATCH role=admin -> 403 ou 42501 [trigger 006 OK]` — PASS (requer 006)

Exit code 0 com STRICT_RLS=1 = P0-2 fechado.

---

## Resumo executivo

| Item | Status |
|---|---|
| Seguro aplicar 005? | **SIM** — nenhum caminho do app usa anon key nas tabelas de negocio |
| Tabelas cobertas pela 005 | 6 (leads, messages, tags, lead_tags, checklist_items, integrations_config) |
| Tabelas ja com RLS (011/012/013/014) | 7 (fin_clients, fin_revenue, fin_expenses, demands, demand_pending, group_messages, agent_assets) |
| Tabelas faltantes (sem RLS) | 7 (email_lists, email_contacts, email_templates, email_campaigns, email_events, email_unsubscribes, follow_up_schedule) |
| Migration complementar criada | `supabase/migrations/016-rls-email-followup.sql` + rollback |
| Ordem de aplicacao | 006 (se pendente) -> 005 -> 016 -> 009 (se pendente) |
| Runner de validacao | `STRICT_RLS=1 node scripts/test/ac5-negative.mjs` (R1-R3 esperados PASS) |
