---
title: "ADR-003: Arquitetura do Portal — migrar front para Next.js App Router"
type: decision
status: proposed
agent: crm-architect
created: 2026-06-25
updated: 2026-06-25
tags: [architecture, decision, ux]
related: ["[[ADR-001-serverless-vercel]]", "[[ADR-004-canal-whatsapp-qr-vs-make]]", "[[../project/architecture]]", "[[../agents/ux/components]]", "[[../stories/backlog/5.1-portal-nextjs-shell]]", "[[../stories/backlog/5.2-auth-rbac-interno]]"]
---

# ADR-003: Arquitetura do Portal — migrar front para Next.js App Router

## Status
**Proposed** — aguarda confirmação do lead antes do dispatch do epic Portal.

## Contexto

O usuário redirecionou o produto: de um dashboard CRM para um **portal multi-módulo da equipe interna** da Cranium. O backend já construído (Supabase + funções serverless + agente IA + WhatsApp) vira **fundação**; o CRM/kanban passa a ser **um módulo** entre vários:
1. CRM/kanban (existe), 2. Métricas & BI, 3. Agendamento, 4. Conectar WhatsApp (QR), 5. Aba rica de leads.

Requisitos novos que o front precisa suportar: **login interno + navegação entre telas + layout compartilhado branded (KV virá do usuário) + RBAC por papel + BI com gráficos + múltiplas rotas**.

O front atual ([[../agents/ux/components]]) é uma **SPA vanilla** (HTML/CSS/JS, sem framework, sem roteamento, rota única `/`, sem auth, mobile quebrado). O [[ADR-001-serverless-vercel|ADR-001]] já deixou registrado o gatilho: *"promover apenas o dashboard para Next.js (Opção C) na Wave 3 se precisar de auth middleware + server components RLS-aware + real-time rico"*. Um portal interno com login, navegação, BI e múltiplas telas **é exatamente esse gatilho**.

## Opções consideradas

### A — Manter SPA estática + crescer à mão (vanilla + router caseiro)
- **Prós:** zero migração imediata; reaproveita o que existe.
- **Contras:** roteamento, code-splitting, auth-guard, layout compartilhado, data-fetching e estado teriam que ser reimplementados na mão; sem ecossistema de UI/charts; manter design branded e múltiplos módulos em vanilla escala mal e vira dívida. Inviável para o escopo do portal.

### B — Next.js App Router (recomendada)
Front vira app Next.js na Vercel: **app shell** (sidebar + topbar + layout branded), **Supabase Auth via SSR** (`@supabase/ssr` + middleware), **nested layouts** por módulo, **RBAC** por papel, route-based navigation. Cada módulo é um segmento de rota (`/crm`, `/leads`, `/bi`, `/agenda`, `/whatsapp`).
- **Prós:** middleware de auth RLS-aware nativo; layouts aninhados e navegação prontos; server components para listas/BI pesados; ecossistema maduro (charts, calendar, tabelas); favorece UI branded a partir do KV; é o caminho já pré-aprovado no ADR-001; coexiste com as funções `/api` da Wave 2.
- **Contras:** porta o front vanilla (esforço real, mas o front é pequeno — 263 linhas); introduz build/framework. Mitigado por migração incremental.

### C — Outro framework SPA (Vite + React Router, etc.)
- **Prós:** SPA moderna sem o peso de SSR.
- **Contras:** auth SSR RLS-aware e middleware ficam manuais; perde a integração madura Supabase+Vercel+Next; sem vantagem sobre B no nosso stack. Descartada por não somar frente a B.

## Decisão

**Opção B — Next.js App Router como shell do portal**, na Vercel, com Supabase Auth (SSR) e RBAC por papel.

Aciona explicitamente o gatilho registrado no ADR-001. A migração A→B é o caminho já previsto, agora justificado por requisito de produto (multi-módulo + login + branded UI).

## Plano de migração incremental

1. **Shell primeiro (Story 5.1):** subir o app Next na Vercel com layout/navegação placeholder; o portal passa a ser o entrypoint do front. As funções `/api` da Wave 2 **continuam intactas**.
2. **Auth + RBAC (5.2):** middleware Next + Supabase Auth (SSR); RLS por usuário/papel no Supabase (absorve e amplia a antiga Story 4.2).
3. **Design system branded (5.3):** tokens + componentes a partir do KV do usuário.
4. **Portar o CRM (5.4):** kanban + drawer viram módulo `/crm`, consumindo os mesmos endpoints de leads.
5. **Módulos novos** (BI, agenda, whatsapp-connect, leads-view) entram como segmentos de rota.

**O que se reaproveita da Wave 2:**
- Domínio em `src/` (`crm/leads.ts`, `handler.ts`, `agent/`) — **intacto**.
- Funções de integração externa (`/api/webhook`, `/api/cron/followup`) — permanecem como **Vercel functions** (são endpoints de máquina, não UI); coexistem com o app Next.
- Os endpoints de leitura/CRUD do dashboard (`/api/leads*`) podem **virar route handlers** do App Router (`app/api/...`) ou permanecer como estão, migrando sob demanda.
- Decisões de banco (Supabase), canal e cron (Vercel Cron) **não mudam** por este ADR.

## Consequências

**Positivas:** base sólida para os 5 módulos; auth/RBAC/branding de primeira classe; reaproveita 100% do backend; navegação e code-splitting de graça.

**Negativas / mitigações:** introduz framework e build (mitigado: front pequeno, migração incremental, backend não é tocado); curva de Next App Router para quem não conhece (mitigado: padrão de mercado, docs Supabase+Vercel maduras).

**Re-escopo de stories da Wave 3 original:** 4.1 (dashboard estático na Vercel) é **superseded** por 5.1; 4.2 (auth+RLS) é absorvida por 5.2; 4.4 (a11y do drawer) passa a viver dentro de 5.3/5.4; 4.3 (distinguir IA vs humano) permanece (concern de dados, alimenta 5.4/5.5). Recomendo ao lead marcar 4.1/4.2/4.4 como reescopadas para evitar trabalho duplicado.

## Dependência
Branding depende do **KV do usuário** (bloqueia 5.3, não 5.1/5.2). Ver [[ADR-004-canal-whatsapp-qr-vs-make]] para o módulo 4.
