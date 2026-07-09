---
title: Smart Memory Index
type: index
updated: 2026-07-08
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
- [[project/roadmap-saas]] — **roadmap de virar SaaS** (fases, decisões pendentes, riscos)
- [[project/overview]] — contexto e objetivo
- [[project/tech-stack]] — stack
- [[project/architecture]] — padrão arquitetural
- [[project/modules]] — mapa de módulos
- [[project/conventions]] — convenções de código
- `docs/design/kv/` — KV / design system da Cranium (tokens roxo/violeta, Geist, componentes)
- `docs/design/app-handoff/` — KV do **app mobile** (Claude Design): telas login/chat/leads/funil/perfil claro+escuro, tokens, `App Design System.dc.html`

## Stories
- [[stories/BACKLOG]] — backlog (stories pendentes) · **Epics 6–10 = virar SaaS** (17 stories, ver [[project/roadmap-saas]])
- `stories/active/` — em desenvolvimento
- `stories/in-review/` — aguardando QA · [[stories/in-review/5.7-modulo-agendamento]]
- `stories/done/` — concluídas
- Epics SaaS: **6** Fundação comercial · **7** Confiabilidade & escala · **8** Jurídico & compliance · **9** Produto self-serve · **10** Multi-tenant DB (futuro). **Forma do produto SaaS confirmada (2026-07-08):** plano único R$997/mês, BYOK OpenAI por tenant, Cranium não é tenant, protocolo de plano de saúde pré-carregado ([[stories/backlog/6.5-protocolo-plano-saude]]), wizard de 5 passos ([[stories/backlog/9.3-wizard-setup-in-app]]), control-plane em schema separado. Decisões de canal/gateway já resolvidas (ADRs 006/007/008/009).

## Decisões Arquiteturais (ADRs)
- [[decisions/ADR-001-serverless-vercel]] — serverless na Vercel (funções `/api`)
- [[decisions/ADR-002-webhook-processing]] — webhook síncrono (maxDuration 60s)
- [[decisions/ADR-003-portal-nextjs]] — front em Next.js App Router (epic 5)
- [[decisions/ADR-004-canal-whatsapp-qr-vs-make]] — canal WhatsApp Evolution + aquisição Meta Lead Ads
- [[decisions/ADR-005-ia-openai-vs-anthropic]] — IA do agente migrada de Claude para OpenAI (GPT)
- [[decisions/ADR-006-canal-whatsapp-em-escala]] — manter Evolution com gatilho de migração (30 clientes ou 1º ban) para Cloud API; supersede parcial o ADR-004
- [[decisions/ADR-007-gateway-pagamento-br]] — gateway de pagamento BR = Asaas (PIX/boleto fixo, NFS-e nativa, suspensão automática)
- [[decisions/ADR-008-plano-de-controle-central]] — control-plane central em **schema separado no Supabase atual** (não projeto novo) para tenants/billing/super-admin; ponte para a Fase 5
- [[decisions/ADR-009-byok-openai-por-tenant]] — no SaaS, a chave OpenAI é por tenant (BYOK, fornecida pelo corretor); só OpenAI, complementa o ADR-005

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
- [[agents/data-engineer/rls-p0-apply-plan]] — plano de apply P0-2: veredicto, tabelas cobertas/faltantes, SQL pronto, migration 016
- [[agents/qa/results]] — histórico de veredictos (inclui a leva de features 29-30/jun)
- [[agents/qa/review-2026-06-26]] — review das features do portal (CRM, integrações, login)
- [[agents/qa/review-5.2-ac5-e-config]] — matriz de gates por endpoint + AC5 + review config/dashboard
- [[agents/qa/auditoria-robustez-2026-07-09]] — auditoria de robustez da plataforma inteira (P0×3, P1×6, P2×6; timeouts, RLS, rate limit)
- [[agents/ux/components]] — specs de componentes
- `agents/research/` — research reports
  - [[agents/research/saas-decisoes-canal-e-pagamento]] — Canal WhatsApp (Evolution vs Cloud API) e Gateway de Pagamento (Asaas vs Pagar.me vs Iugu) para escala SaaS

## Status
- [[shared-context]] — status board em tempo real
