---
title: Overview do Projeto
type: overview
status: active
created: 2026-06-25
updated: 2026-06-25
tags: [project, overview]
related: ["[[modules]]", "[[architecture]]", "[[tech-stack]]", "[[conventions]]", "[[../agents/data-engineer/schema]]", "[[../agents/ux/components]]", "[[../stories/BACKLOG]]"]
---

# crm-whatsapp (CRM ATENDIMENTO) — Overview

> Síntese da fase de descoberta (bootstrap) — 2026-06-25. Time: crm-architect, crm-analyst, crm-data, crm-ux.
> Fonte: `github.com/craniumdigitalia-eng/crm-whatsapp` (branch `main`).

## O que é

CRM de WhatsApp que **substitui o SDR** da agência (Cranium Digital):
- **Primeiro atendimento automático** de leads via WhatsApp, feito por um **agente de IA da Claude** (`claude-opus-4-8`).
- **Qualifica** o lead (serviço, objetivo, orçamento) e registra no funil.
- **Follow-up automático** — até **30 retomadas** por lead — até responder ou virar atendimento humano.
- **Dashboard** com pipeline kanban + conversas em tempo real (assumir / devolver p/ IA).

## Estado atual

**Protótipo funcional** Node.js + TypeScript (Express + SQLite), ~12 arquivos em `src/`, já compila e roda.
É a **referência de lógica de negócio** — a migração de produção troca a infra preservando os contratos de função.

## Stack

| Camada | Protótipo (hoje) | Produção (alvo) |
|---|---|---|
| Linguagem | TypeScript (Node 22.5+, `node:sqlite`) | idem |
| Banco | SQLite local (`db.ts`) | **Supabase / Postgres** (service_role no server) |
| Hospedagem | Express, processo longo | **Vercel** (serverless) |
| Canal WhatsApp | Evolution API direta | **Make.com** como ponte (entrada+saída) |
| Follow-up | `node-cron` em memória | **Vercel Cron** → `/api/cron/followup` (`CRON_SECRET`) |
| IA | Claude API `claude-opus-4-8` (fallback `sonnet-4-6`) | idem |

Detalhe completo de deps e env vars em [[tech-stack]]. Convenções (PT-BR no código, regras do agente) em [[conventions]].

## Arquitetura (resumo)

Monolito Express em camadas → fluxo **receber → IA → responder → persistir → follow-up**.
Gate `AUTO_STATUSES` (`novo`, `em_atendimento`, `qualificado`) pausa a IA quando humano assume.
Diagrama, fluxo serverless e contrato do Make em [[architecture]].

## Módulos principais

`handler.ts` (orquestrador) · `agent/` (IA + tools) · `crm/leads.ts` (repositório) · `db.ts` (persistência) · `whatsapp/evolution.ts` (canal) · `followup/scheduler.ts` (retomadas) · `routes/` (webhook + API) · `public/` (dashboard). Mapa completo em [[modules]].

### ⚡ God Nodes (mudança aqui = alto impacto → exigem QA formal)
`src/types.ts` · `src/db.ts` · `src/crm/leads.ts` · `src/handler.ts` · `src/config.ts`

## Banco de dados

Funil de **7 estágios**: `novo → em_atendimento → qualificado → proposta → fechado/perdido` + `humano`.
Schema Postgres de produção: UUID, TIMESTAMPTZ, ENUM `lead_status`, trigger `updated_at`, índice parcial p/ follow-up. Detalhe e ER em [[../agents/data-engineer/schema]].

## Dashboard

SPA vanilla JS/CSS/HTML (sem framework), dark theme, kanban de 7 colunas + drawer de conversa, polling 15s. Catálogo e gaps em [[../agents/ux/components]].

## 🚨 Riscos / pré-requisitos para a migração (consolidado)

1. **Idempotência inexistente** — sem dedupe por msg id, reentrega do Make duplica resposta. `messages` precisa de `external_id` único. **Pré-requisito antes de ligar o canal real.**
2. **`Lead.id: number` → UUID** — `types.ts` incompatível com Supabase; precisa virar `string` antes de reescrever `leads.ts` (toca God Node).
3. **Webhook fire-and-forget morre em serverless** — processar síncrono (dentro do timeout) ou enfileirar.
4. **`node-cron` não roda na Vercel** — vira Vercel Cron + rota protegida.
5. **Corrida no follow-up** — `follow_up_count`/`last_direction` exigem update atômico no Postgres.
6. **Dashboard 100% público** — sem auth; mensagens `out` não distinguem IA vs humano; a11y do drawer.

## ADRs pendentes
Modelo LLM por etapa · processamento do webhook (síncrono vs fila) · mecanismo de dedupe · memória/contexto do agente. + formalizar as decisões já fixadas no CLAUDE.md (Make, Supabase, Vercel Cron).

## Próximo ciclo
**Migração protótipo → produção** (objetivo definido pelo usuário). Ver plano em [[../shared-context]].
