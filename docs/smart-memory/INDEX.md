---
title: Smart Memory Index
type: index
updated: 2026-07-03
tags: [index]
---

# crm-whatsapp (CRM ATENDIMENTO) — Smart Memory

MOC raiz (Map of Content). Todo arquivo novo em `docs/smart-memory/` deve ser referenciado aqui.

> Como abrir no Obsidian: abra a pasta `docs/smart-memory/` como **vault**. Os links `[[...]]` conectam tudo no grafo. Cada arquivo tem frontmatter (`title`, `type`, `tags`).

## 🧭 Comece por aqui
- [[shared-context]] — **status board do projeto (estado real, sempre atualizado)**
- [[project/visao-e-requisitos]] — visão, requisitos e preferências (segundo cérebro)
- [[changelog/2026-07-03-sessao-features]] — **sessão mais recente (1-3/jul)**: IA OpenAI, Financeiro, Metas, Demandas, Grupos, site-lead, incidente Evolution
- [[changelog/2026-06-29-sessao-features]] — o que foi construído na sessão de 29-30/jun

## Projeto
- [[project/overview]] — contexto e objetivo
- [[project/tech-stack]] — stack
- [[project/architecture]] — padrão arquitetural
- [[project/modules]] — mapa de módulos
- [[project/conventions]] — convenções de código
- `docs/design/kv/` — KV / design system da Cranium (tokens roxo/violeta, Geist, componentes)

## Stories
- [[stories/BACKLOG]] — backlog (stories pendentes)
- `stories/active/` — em desenvolvimento
- `stories/in-review/` — aguardando QA · [[stories/in-review/5.7-modulo-agendamento]]
- `stories/done/` — concluídas

## Decisões Arquiteturais (ADRs)
- [[decisions/ADR-001-serverless-vercel]] — serverless na Vercel (funções `/api`)
- [[decisions/ADR-002-webhook-processing]] — webhook síncrono (maxDuration 60s)
- [[decisions/ADR-003-portal-nextjs]] — front em Next.js App Router (epic 5)
- [[decisions/ADR-004-canal-whatsapp-qr-vs-make]] — canal WhatsApp Evolution + aquisição Meta Lead Ads
- [[decisions/ADR-005-ia-openai-vs-anthropic]] — IA do agente migrada de Claude para OpenAI (GPT)

## Operações
- [[ops/setup-e-infra]] — setup, credenciais e infraestrutura
- [[ops/teams-log]] — times formados e seus objetivos
- [[ops/delegation-log]] — histórico de delegações do lead
- [[changelog/2026-07-03-sessao-features]] — changelog 1-3/jul (IA OpenAI, Financeiro/Metas, Demandas, Grupos, incidente chave Evolution)
- [[changelog/2026-06-29-sessao-features]] — changelog da sessão de features (Agenda, topbar, Novo Lead, interruptor IA, handoff)

## Agentes
- [[agents/data-engineer/schema]] — schema atual (leads, messages, funil, gaps/riscos)
- [[agents/data-engineer/migrations-log]] — log de migrations aplicadas e planejadas
- [[agents/data-engineer/rls-ac3-validation]] — validação estática das migrations 005 e 009
- [[agents/data-engineer/migration-apply-order]] — ordem canônica 006→005→009 (smoke-checks e rollback)
- [[agents/qa/results]] — histórico de veredictos (inclui a leva de features 29-30/jun)
- [[agents/qa/review-2026-06-26]] — review das features do portal (CRM, integrações, login)
- [[agents/qa/review-5.2-ac5-e-config]] — matriz de gates por endpoint + AC5 + review config/dashboard
- [[agents/ux/components]] — specs de componentes
- `agents/research/` — research reports

## Status
- [[shared-context]] — status board em tempo real
