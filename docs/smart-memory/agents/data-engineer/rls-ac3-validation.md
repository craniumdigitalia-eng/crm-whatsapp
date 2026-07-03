---
title: Validação RLS AC3 — Story 5.2 (migrations 005 e 009)
type: reference
agent: data-engineer
updated: 2026-06-28
tags: [rls, security, migration, validation, story-5.2]
---

# Validação RLS AC3 — Story 5.2

Data: 2026-06-28. Scope: validação estática (read-only — sem tocar o banco).

---

## Veredicto

| Migration | Pronta para aplicar? | Resumo |
|---|---|---|
| **005-rls-business-tables.optional.sql** | **SIM** | Nomes de tabela batem com o schema real; nenhum caminho do app usa anon key nas tabelas de negócio; service_role continua com acesso total. |
| **009-profile-settings.sql** | **SIM** | Idempotente; coluna `avatar_url` e bucket `avatars` corretos; policies de pasta-própria implementadas corretamente via `storage.foldername`. |

---

## 1. Nomes de tabela — 005 vs schema real

As seis tabelas referenciadas em `supabase/migrations/005-rls-business-tables.optional.sql` foram conferidas contra `supabase/schema.sql` e as migrations formais (002, 003):

| Tabela na 005 | Origem no schema | Presente? |
|---|---|---|
| `public.leads` | `schema.sql` (tabela base) | OK |
| `public.messages` | `schema.sql` (tabela base) | OK |
| `public.tags` | `schema.sql` (migration 002) | OK |
| `public.lead_tags` | `schema.sql` (migration 002) | OK |
| `public.checklist_items` | `schema.sql` (migration 002) | OK |
| `public.integrations_config` | `schema.sql` (migration 003) | OK |

A tabela de mensagens chama-se exatamente `messages` — alinha com o texto do AC3.

---

## 2. Uso da anon key — verificação de caminhos do app

### Clientes com anon key encontrados

| Arquivo | Tipo de cliente | Uso real |
|---|---|---|
| `lib/supabase/client.ts` | `createBrowserClient` (browser, anon key) | auth/sessão + Storage |
| `lib/supabase/server.ts` | `createServerClient` (SSR, anon key) | auth/sessão + `profiles` |
| `lib/supabase/middleware.ts` | `createServerClient` (middleware, anon key) | refresh de sessão apenas |

### Tabelas acessadas via anon key (grep `supabase.from()` em `app/`, `components/`, `lib/`)

```
app/(portal)/layout.tsx      → profiles (select nome/email/role/avatar_url por id)
app/(portal)/page.tsx        → profiles (select)
app/(portal)/config/page.tsx → profiles (select)
app/(portal)/agente/page.tsx → profiles (select)
app/(portal)/email/page.tsx  → profiles (select)
app/api/profile/route.ts     → profiles (select + update)
lib/auth.ts                  → profiles (select role)
components/ConfigModule.tsx  → storage.from('avatars') APENAS (Storage, não tabela)
```

**Nenhum caminho do app acessa `leads`, `messages`, `tags`, `lead_tags`, `checklist_items` ou `integrations_config` via anon key.**

Todo acesso de dados de negócio passa por `src/db.ts` com `supabaseServiceRoleKey` (ignora RLS).

### Conclusão de risco

Aplicar a migration 005 **não quebra nenhuma rota do app**. O único efeito é bloquear anon/authenticated no PostgREST — que já não é usado para essas tabelas.

---

## 3. Validação da migration 009 (avatar_url + bucket avatars)

### Coluna `avatar_url`

```sql
alter table public.profiles add column if not exists avatar_url text;
```

- Idempotente (`IF NOT EXISTS`). Depende de `profiles` existir — migration 004 já aplicada.
- Coluna declarada em `PROFILE_COLS` em `app/api/profile/route.ts` e no SELECT do layout — consistente.

### Bucket `avatars`

```sql
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;
```

- Idempotente. Bucket público: correto — URLs de avatar não precisam de token.

### Policies de Storage

| Policy | Role | Operação | Check | Avaliação |
|---|---|---|---|---|
| `avatars_public_read` | `public` | SELECT | `bucket_id = 'avatars'` | Correto — leitura pública para servir imagens na sidebar |
| `avatars_insert_own` | `authenticated` | INSERT | `(storage.foldername(name))[1] = auth.uid()::text` | Correto — restringe upload à pasta `{uid}/` |
| `avatars_update_own` | `authenticated` | UPDATE | `using` + `with check` ambos com foldername = uid | Correto — dupla verificação previne mover arquivo de pasta alheia |
| `avatars_delete_own` | `authenticated` | DELETE | foldername = uid | Correto — usuário só apaga a própria pasta |

`storage.foldername(name)` retorna array de segmentos do path. `[1]` (Postgres 1-indexed) é o primeiro segmento — o `{user_id}` no path `{user_id}/avatar-{ts}.{ext}`. Implementação correta e idiomática do Supabase Storage.

### Rollback 009

`009-profile-settings.rollback.sql` cobre drop das 4 policies e `DROP COLUMN IF EXISTS avatar_url`.

**Atenção:** o rollback não apaga o bucket nem os objetos por padrão (está comentado). Se quiser rollback completo de Storage, descomente as duas linhas antes de executar.

---

## 4. Checklist de aplicação no SQL Editor (ordem correta)

Pré-condição: migrations 002, 003 e 004 já aplicadas (confirmado em shared-context).

### Passo 1 — Migration 006 (role-lock) — se ainda não aplicada

```
supabase/migrations/006-profiles-role-lock.sql
```

Fecha a janela de auto-escalonamento de role antes de expandir RLS. Sem dependência nas tabelas de negócio.

Smoke-test após 006:
```sql
select proname from pg_proc where proname = 'prevent_role_self_escalation';
-- deve retornar 1 linha
```

### Passo 2 — Migration 005 (RLS business tables)

```
supabase/migrations/005-rls-business-tables.optional.sql
```

Smoke-tests:
```sql
-- Confirmar RLS ativo nas 6 tabelas:
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('leads','messages','tags','lead_tags','checklist_items','integrations_config');
-- rowsecurity deve ser 't' para todas

-- Confirmar que não há policies nessas tabelas (bloqueia anon/authenticated):
select tablename, count(*) as policies
from pg_policies
where schemaname = 'public'
  and tablename in ('leads','messages','tags','lead_tags','checklist_items','integrations_config')
group by tablename;
-- deve retornar 0 linhas (sem policies = ZERO acesso via anon/authenticated)
```

Rollback disponível: `005-rls-business-tables.rollback.sql`

### Passo 3 — Migration 009 (avatar_url + bucket)

```
supabase/migrations/009-profile-settings.sql
```

Smoke-tests:
```sql
-- Confirmar coluna:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar_url';
-- deve retornar 1 linha, data_type = 'text'

-- Confirmar bucket:
select id, name, public from storage.buckets where id = 'avatars';
-- deve retornar 1 linha, public = true

-- Confirmar 4 policies no bucket:
select policyname, cmd from storage.policies where bucket_id = 'avatars';
-- deve retornar avatars_public_read, avatars_insert_own, avatars_update_own, avatars_delete_own
```

Rollback disponível: `009-profile-settings.rollback.sql` (ver nota sobre bucket acima).

---

## 5. Riscos e observações

| # | Risco | Severidade | Detalhe |
|---|---|---|---|
| R1 | 006 não aplicada antes de 005 | Baixa | 005 e 006 são independentes, mas 006 deve ser aplicada para completar o hardening de auth (auto-escalação de role). Não há bloqueio técnico, mas 006 deve preceder qualquer merge de 5.2 como concluída. |
| R2 | Rollback 009 não destrói o bucket | Baixa | Objetos de Storage permanecem se o rollback for executado sem descomentar as linhas de delete. Intencional — evita perda de fotos por acidente. |
| R3 | Tabelas de email marketing sem RLS | Média (futura) | `email_lists`, `email_contacts`, `email_templates`, `email_campaigns`, `email_events`, `email_unsubscribes` e `follow_up_schedule` não têm RLS. Todo acesso hoje é server-side via service_role — sem risco imediato. Se o módulo de email ganhar algum acesso client-side no futuro, habilitar RLS antes. |
| R4 | `profiles` via anon key em route handlers | Info | `app/api/profile/route.ts` acessa `profiles` via anon key + sessão. Correto por design: RLS de `profiles` (004) permite o usuário ler/editar apenas a própria linha. |

---

## Nota de rollback rápido

Caso qualquer smoke-test falhe após aplicar 005:
```sql
-- 005 rollback:
alter table public.leads               disable row level security;
alter table public.messages            disable row level security;
alter table public.tags                disable row level security;
alter table public.lead_tags           disable row level security;
alter table public.checklist_items     disable row level security;
alter table public.integrations_config disable row level security;
```
(conteúdo de `005-rls-business-tables.rollback.sql` — pode colar direto no SQL Editor)

Caso smoke-test de 009 falhe:
```sql
-- 009 rollback parcial (mantém bucket e imagens):
drop policy if exists "avatars_public_read"  on storage.objects;
drop policy if exists "avatars_insert_own"   on storage.objects;
drop policy if exists "avatars_update_own"   on storage.objects;
drop policy if exists "avatars_delete_own"   on storage.objects;
alter table public.profiles drop column if exists avatar_url;
```
