---
title: Smart Memory Index
type: index
updated: 2026-06-25
tags: [index]
---

# crm-whatsapp (CRM ATENDIMENTO) — Smart Memory

MOC raiz. Todo arquivo novo em `docs/smart-memory/` deve ser referenciado aqui.

## Projeto
- 🧠 [[project/visao-e-requisitos]] — **VISÃO, REQUISITOS E PREFERÊNCIAS (segundo cérebro — comece por aqui)**
- [[project/overview]] — contexto e objetivo
- [[project/tech-stack]] — stack
- [[project/architecture]] — padrão arquitetural
- [[project/modules]] — mapa de módulos
- [[project/conventions]] — convenções de código
- `docs/design/kv/` — KV / design system da Cranium (tokens roxo/violeta, Geist, componentes)

## Stories
- [[stories/BACKLOG]] — stories pendentes
- `stories/active/` — em desenvolvimento
- `stories/done/` — concluídas

## Decisões Arquiteturais
- `decisions/` — ADRs numerados
- [[decisions/ADR-001-serverless-vercel]] — abordagem serverless na Vercel (funções `/api` nativas; gate da 3.2)
- [[decisions/ADR-002-webhook-processing]] — webhook síncrono vs fila (decidido: síncrono, maxDuration 60s; gate da 3.3)
- [[decisions/ADR-003-portal-nextjs]] — front → Next.js App Router para o portal (accepted; epic 5)
- [[decisions/ADR-004-canal-whatsapp-qr-vs-make]] — canal WhatsApp: FINAL Evolution auto-hospedada; Make dropado; Google Calendar direto; aquisição Meta Lead Ads (form) outbound-first (accepted; epic 5)

## Operações
- [[ops/delegation-log]] — histórico de delegações do lead
- [[ops/teams-log]] — times formados e seus objetivos

## Agentes
- [[agents/data-engineer/schema]] — schema atual (leads, messages, funil, gaps/riscos)
- [[agents/data-engineer/migrations-log]] — log de migrations aplicadas e planejadas
- [[agents/qa/results]] — histórico de veredictos
- [[agents/qa/review-2026-06-26]] — review das features do portal (CRM, integrações, login) + veredicto de segurança
- [[agents/ux/components]] — specs de componentes
- `agents/research/` — research reports

## Status
- [[shared-context]] — status board em tempo real
