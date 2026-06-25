---
title: Smart Memory Index
type: index
updated: 2026-06-25
tags: [index]
---

# crm-whatsapp (CRM ATENDIMENTO) — Smart Memory

MOC raiz. Todo arquivo novo em `docs/smart-memory/` deve ser referenciado aqui.

## Projeto
- [[project/overview]] — contexto e objetivo
- [[project/tech-stack]] — stack (fonte: dev-analyst)
- [[project/architecture]] — padrão arquitetural (fonte: dev-architect)
- [[project/modules]] — mapa de módulos (fonte: dev-architect)
- [[project/conventions]] — convenções de código (fonte: dev-analyst)

## Stories
- [[stories/BACKLOG]] — stories pendentes
- `stories/active/` — em desenvolvimento
- `stories/done/` — concluídas

## Decisões Arquiteturais
- `decisions/` — ADRs numerados
- [[decisions/ADR-001-serverless-vercel]] — abordagem serverless na Vercel (funções `/api` nativas; gate da 3.2)
- [[decisions/ADR-002-webhook-processing]] — webhook síncrono vs fila (decidido: síncrono, maxDuration 60s; gate da 3.3)

## Operações
- [[ops/delegation-log]] — histórico de delegações do lead
- [[ops/teams-log]] — times formados e seus objetivos

## Agentes
- [[agents/data-engineer/schema]] — schema atual (leads, messages, funil, gaps/riscos)
- [[agents/data-engineer/migrations-log]] — log de migrations aplicadas e planejadas
- [[agents/qa/results]] — histórico de veredictos
- [[agents/ux/components]] — specs de componentes
- `agents/research/` — research reports

## Status
- [[shared-context]] — status board em tempo real
