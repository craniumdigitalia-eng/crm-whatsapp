---
title: Log de Migrations — CRM WhatsApp
type: reference
agent: data-engineer
updated: 2026-06-25
tags: [migrations, banco, supabase, log]
---

# Log de Migrations

Relacionado: [[agents/data-engineer/schema]]

## SQLite (protótipo) — aplicadas via `src/db.ts`

As migrações do protótipo são incrementais e aplicadas automaticamente no startup.

| Wave | Story | Descrição | Mecanismo | Status |
|------|-------|-----------|-----------|--------|
| 0 | 1.1 | `external_id TEXT` em `messages` + índice único parcial | `CREATE TABLE` inclui coluna; `CREATE UNIQUE INDEX IF NOT EXISTS` | ✅ em `src/db.ts` |
| 0 | 1.2 | PKs de INTEGER AUTOINCREMENT → TEXT (UUID) | Detecção via `PRAGMA table_info` + backup `crm.db.backup-<ts>` + DROP + recreate | ✅ em `src/db.ts` |
| 0 | cleanup | Removido ALTER TABLE morto; DROP agora precedido de backup de arquivo | Hardening pós-QA | ✅ em `src/db.ts` |

## Supabase (produção) — migrations formais

| # | Arquivo | Aplicada em | Descrição | Rollback |
|---|---------|-------------|-----------|----------|
| — | `supabase/schema.sql` | pendente | Schema base: tabelas `leads` e `messages`, ENUM `lead_status`, índices e trigger `updated_at` | N/A — schema inicial |

> Schema base em `supabase/schema.sql`. Rodar no SQL Editor do Supabase ou via `supabase db push` na criação do projeto de produção.

## Próximas migrations Supabase planejadas

| Prioridade | Descrição | Motivo | Story |
|------------|-----------|--------|-------|
| Alta | Adicionar `external_id TEXT` em `messages` + `UNIQUE INDEX` parcial + `ON CONFLICT DO NOTHING` | Idempotência de webhooks (Make pode reenviar) | 2.1 |
| Média | Habilitar RLS em `leads` e `messages` + policies iniciais | Segurança do dashboard com Supabase Auth | 4.2 |
| Baixa | Adicionar `model`, `input_tokens`, `output_tokens` em `messages` | Observabilidade de custo por conversa | 4.5 |

> `Lead.id`/`Message.id` → UUID: já resolvido no `supabase/schema.sql` (usa `uuid` PK com `gen_random_uuid()`). Não requer migration adicional.
