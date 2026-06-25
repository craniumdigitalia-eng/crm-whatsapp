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

## Wave 1 — aplicadas (2026-06-25)

| Story | Mudança | Arquivo | Status |
|-------|---------|---------|--------|
| 2.2 | `external_id TEXT` em `messages` + índice único parcial | `supabase/schema.sql` | pendente credenciais (2.1) |
| 2.2 | `constraint chk_followup CHECK (follow_up_count >= 0)` em `leads` | `supabase/schema.sql` | pendente credenciais (2.1) |

> Schema base em `supabase/schema.sql` inclui Wave 0 + Wave 1. Rodar no SQL Editor do Supabase assim que credenciais forem configuradas.

## Próximas migrations Supabase planejadas

| Prioridade | Descrição | Motivo | Story |
|------------|-----------|--------|-------|
| Média | Habilitar RLS em `leads` e `messages` + policies iniciais | Segurança do dashboard com Supabase Auth | 4.2 |
| Baixa | Adicionar `model`, `input_tokens`, `output_tokens` em `messages` | Observabilidade de custo por conversa | 4.5 |
