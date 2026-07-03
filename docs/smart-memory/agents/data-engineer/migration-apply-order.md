---
title: Ordem canônica de aplicação — migrations pendentes (Story 5.2, AC3)
type: reference
agent: data-engineer
updated: 2026-06-28
tags: [migration, rls, security, story-5.2, apply-order]
---

# Ordem de aplicação — migrations pendentes (Story 5.2)

> Pré-condição: migrations 002, 003 e 004 já aplicadas e confirmadas no shared-context.
> Aplique sempre no **SQL Editor do Supabase** (Dashboard → SQL Editor → New query).
> NÃO use o CLI `supabase db push` — as migrations são aplicadas manualmente.

---

## Ordem: 006 → 005 → 009

| Passo | Arquivo | Dependência |
|---|---|---|
| 1 | `006-profiles-role-lock.sql` | Requer `profiles` (004) |
| 2 | `005-rls-business-tables.optional.sql` | Requer tabelas de negócio (002/003) |
| 3 | `009-profile-settings.sql` | Requer `profiles` (004) + bucket Storage |

### Por que 006 antes de 005?

006 e 005 são tecnicamente independentes (atuam em objetos distintos), mas a ordem
006 → 005 é a correta pelo raciocínio de hardening: feche primeiro o vetor de
auto-escalonamento de role (006), depois habilite o RLS nas tabelas de negócio (005).
Assim, se uma janela de tempo existir entre as aplicações, o usuário não pode se
autopromover a admin e então tentar explorar alguma brecha de RLS num estado
intermediário. 009 é independente e pode ser aplicada em qualquer ponto, mas vai
por último para manter o agrupamento lógico de "auth hardening" (006+005) seguido
de "feature de perfil" (009).

---

## Migration 006 — `006-profiles-role-lock.sql`

### O que faz

Cria a função `prevent_role_self_escalation()` e o trigger `profiles_role_lock`
(BEFORE UPDATE em `public.profiles`). O trigger rejeita qualquer tentativa de
alterar a coluna `role` quando o chamador não é `service_role`. Sem isso, qualquer
usuário autenticado poderia fazer `PATCH /rest/v1/profiles?id=eq.<seu_id>` com
`{ "role": "admin" }` via anon key + sessão e se autopromover.

### Onde aplicar

SQL Editor do Supabase → cole o conteúdo de `supabase/migrations/006-profiles-role-lock.sql`.

### Efeito esperado

- Função `prevent_role_self_escalation` criada em `public`.
- Trigger `profiles_role_lock` ativo em `public.profiles`.
- Qualquer UPDATE em `role` por chamador não-service_role lança `42501 insufficient_privilege`.

### Smoke-check pós-aplicação

```sql
-- Confirmar que a função existe:
select proname, prosrc
from pg_proc
where proname = 'prevent_role_self_escalation';
-- deve retornar 1 linha

-- Confirmar que o trigger está ativo:
select tgname, tgenabled
from pg_trigger
where tgname = 'profiles_role_lock';
-- deve retornar 1 linha com tgenabled = 'O' (origin)
```

### Rollback

Disponível em `supabase/migrations/006-profiles-role-lock.rollback.sql`:

```sql
drop trigger if exists profiles_role_lock on public.profiles;
drop function if exists public.prevent_role_self_escalation();
```

### Riscos

- Conexões diretas via `psql` (DBA) também são bloqueadas pelo trigger (o GUC
  `request.jwt.claims` é NULL fora do PostgREST). Para alterar `role` via psql,
  desabilite o trigger pontualmente: `alter table profiles disable trigger profiles_role_lock;`
  e reabilite após: `alter table profiles enable trigger profiles_role_lock;`.

---

## Migration 005 — `005-rls-business-tables.optional.sql`

### O que faz

Habilita Row Level Security (RLS) nas seis tabelas de negócio do CRM sem criar
nenhuma policy. O efeito é: `anon` e `authenticated` recebem **zero linhas** via
PostgREST/Data API. A `service_role` continua com acesso total (bypassa RLS por
design do Supabase). É defesa-em-profundidade: o app já não usa anon key nessas
tabelas, então nada quebra.

Tabelas afetadas: `leads`, `messages`, `tags`, `lead_tags`, `checklist_items`,
`integrations_config`.

### Onde aplicar

SQL Editor do Supabase → cole o conteúdo de
`supabase/migrations/005-rls-business-tables.optional.sql`.

### Efeito esperado

RLS ativo nas 6 tabelas; nenhuma policy criada (acesso via anon/authenticated = zero).

### Smoke-check pós-aplicação

```sql
-- Confirmar RLS ativo nas 6 tabelas:
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('leads','messages','tags','lead_tags','checklist_items','integrations_config')
order by tablename;
-- rowsecurity deve ser 't' para todas (6 linhas)

-- Confirmar ausência de policies nessas tabelas (zero = bloqueio total de anon):
select tablename, count(*) as qtd_policies
from pg_policies
where schemaname = 'public'
  and tablename in ('leads','messages','tags','lead_tags','checklist_items','integrations_config')
group by tablename;
-- deve retornar 0 linhas (nenhuma policy = acesso zerado para anon/authenticated)
```

### Rollback

Disponível em `supabase/migrations/005-rls-business-tables.rollback.sql`:

```sql
alter table public.leads               disable row level security;
alter table public.messages            disable row level security;
alter table public.tags                disable row level security;
alter table public.lead_tags           disable row level security;
alter table public.checklist_items     disable row level security;
alter table public.integrations_config disable row level security;
```

### Riscos

- Se no futuro algum módulo do portal passar a usar anon key + sessão para ler dados
  de negócio diretamente (ex.: Supabase Realtime client-side), será necessário criar
  policies `to authenticated using (...)` por tabela antes de habilitar esse uso.
- As tabelas `email_lists`, `email_contacts`, `email_templates`, `email_campaigns`,
  `email_events`, `email_unsubscribes` e `follow_up_schedule` NÃO têm RLS. Sem risco
  imediato (acesso server-side via service_role), mas registrar para roadmap.

---

## Migration 009 — `009-profile-settings.sql`

### O que faz

1. Adiciona a coluna `avatar_url text` em `public.profiles` (idempotente via `IF NOT EXISTS`).
2. Cria (ou atualiza, se já existir) o bucket `avatars` no Supabase Storage com:
   - Leitura pública (`public = true`) — URLs de avatar servidas sem token.
   - Limite de tamanho: **2 MB** por arquivo (`file_size_limit = 2097152`).
   - MIME types permitidos: `image/jpeg`, `image/png`, `image/webp`.
   O `on conflict (id) do update set` garante que re-executar a migration atualiza
   os campos `public`, `file_size_limit` e `allowed_mime_types` via `excluded.*`.
3. Cria 4 policies em `storage.objects` para o bucket `avatars`:
   - `avatars_public_read`: leitura pública.
   - `avatars_insert_own`: upload restrito à pasta `{uid}/`.
   - `avatars_update_own`: update com USING + WITH CHECK (previne mover para pasta alheia).
   - `avatars_delete_own`: delete restrito à própria pasta.

### Onde aplicar

SQL Editor do Supabase → cole o conteúdo de
`supabase/migrations/009-profile-settings.sql`.

### Efeito esperado

- Coluna `avatar_url` presente em `profiles`.
- Bucket `avatars` com `public = true`, `file_size_limit = 2097152`,
  `allowed_mime_types = {image/jpeg,image/png,image/webp}`.
- 4 policies ativas em `storage.objects` para o bucket `avatars`.

### Smoke-check pós-aplicação

```sql
-- Confirmar coluna:
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name = 'avatar_url';
-- deve retornar 1 linha, data_type = 'text'

-- Confirmar bucket com limites:
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'avatars';
-- deve retornar: public=true, file_size_limit=2097152,
--                allowed_mime_types={image/jpeg,image/png,image/webp}

-- Confirmar 4 policies:
select policyname, cmd
from storage.policies
where bucket_id = 'avatars'
order by policyname;
-- deve retornar: avatars_delete_own, avatars_insert_own,
--                avatars_public_read, avatars_update_own
```

### Rollback

Disponível em `supabase/migrations/009-profile-settings.rollback.sql`.

**Atenção:** o rollback dropa as 4 policies e a coluna `avatar_url`, mas NÃO apaga
o bucket nem os objetos por padrão (as linhas de delete estão comentadas para evitar
perda acidental de fotos). Se quiser rollback completo do Storage, descomente as
duas linhas de `delete from storage.objects/buckets` antes de executar.

### Riscos

- O bucket `avatars` é público. Qualquer URL gerada por `getPublicUrl()` é acessível
  sem autenticação. Isso é intencional (fotos de perfil na sidebar), mas significa que
  uma URL vazada expõe a imagem mesmo após remoção do usuário do sistema.
  Mitigação: ao deletar um usuário, deletar também os objetos em `avatars/{uid}/`.
- O limite de 2 MB e o filtro de MIME são aplicados pelo Supabase Storage no momento
  do upload. O componente de upload no frontend (`ConfigModule.tsx`) deve validar
  client-side também (tamanho + extensão) para UX, mas a proteção definitiva está no
  servidor.

---

## Checklist de aplicação resumido

```
[ ] 1. Abrir SQL Editor do Supabase (projeto iiahpfvhrfuznszytbod)
[ ] 2. Colar + rodar 006-profiles-role-lock.sql
[ ]    Smoke: função prevent_role_self_escalation existe, trigger profiles_role_lock ativo
[ ] 3. Colar + rodar 005-rls-business-tables.optional.sql
[ ]    Smoke: rowsecurity = 't' nas 6 tabelas; 0 policies nessas tabelas
[ ] 4. Colar + rodar 009-profile-settings.sql
[ ]    Smoke: coluna avatar_url em profiles; bucket avatars com limites; 4 policies
[ ] 5. Atualizar migrations-log.md com data de aplicação
```
