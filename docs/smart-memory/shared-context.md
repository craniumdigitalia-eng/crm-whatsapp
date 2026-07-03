# Shared Context — CRM ATENDIMENTO → Portal Cranium

> Fonte de verdade do projeto. Snapshot consolidado em 2026-06-26.

## 📍 Onde o projeto vive
- **Repo local (real):** `/Users/brunocastro/Desktop/Projeto/CRM ATENDIMENTO` (git, branch `main`)
- **GitHub:** github.com/craniumdigitalia-eng/crm-whatsapp
- ⚠️ Houve um diretório-fantasma antigo em `/Users/brunocastro/Desktop/CRM ATENDIMENTO` (restos) — ignorar.

## O que é
**Portal interno da Cranium Digital** (marketing/IA p/ planos de saúde). Começou como CRM de WhatsApp que substitui o SDR (IA da Claude atende, qualifica e faz follow-up) e **virou um portal multi-módulo** (decisão do usuário, 2026-06-25). Identidade: roxo/violeta + Geist (KV em `docs/design/kv/`).

## 🧱 Stack
- **Front:** Next.js 15 App Router (ADR-003), design system do KV em `styles/globals.css`.
- **Backend:** funções `/api` (route handlers Next + Vercel Functions), domínio em `src/`.
- **Banco:** Supabase/Postgres (service_role server-side). Projeto `iiahpfvhrfuznszytbod`.
- **IA:** Claude API `claude-opus-4-8` (chave ligada e validada).
- **Canal WhatsApp:** Evolution auto-hospedada (a montar). **Aquisição:** Meta Lead Ads (formulário) **via Make** → `/api/leadgen` → IA atende. **Agenda:** Google Calendar direto. (ADR-004)

## ✅ FEITO

### Migração protótipo → produção (Waves 0-2) — no GitHub (PRs #1, #2, #3)
- **Wave 0 Hardening:** idempotência (`external_id`), UUID, follow-up atômico. (QA PASS)
- **Wave 1 Supabase:** persistência migrada de SQLite → `@supabase/supabase-js`. (QA PASS)
- **Wave 2 Serverless:** rotas → `/api`, webhook idempotente, cron Vercel, webhook fail-closed. (QA PASS)

### Portal (Epic 5) — construído, AINDA NÃO commitado no git
- **5.1 Shell Next.js + 5.3 Design system** — portal navegável na marca Cranium (sidebar/topbar/rotas).
- **5.4 CRM/kanban funcional** — botões reais (assumir/devolver/mover/responder/editar) + drawer de conversa, persistindo no Supabase. (QA CONCERNS)
- **5.12 Etiquetas + 5.13 Checklists** no lead — schema (migration 002, aplicada) + API + UI no drawer. (QA PASS c/ ressalvas)
- **Filtros do CRM** — busca por nome/telefone + filtro por etiqueta; removida a "origem" fake. (QA PASS)
- **Resumo da IA nas notas** — agente reescreve resumo de qualificação em `notes`. (QA PASS)
- **Aba Integrações + Meta Lead Ads + 5.14** — cards (Google Calendar, Facebook, WhatsApp); import via Graph API; webhook `/api/leadgen`; seção Origem/Formulário no lead. Migration 003 (atribuição) aplicada. (QA CONCERNS → migrar p/ fluxo **Make**, pendente)
- **5.2 Login + proteção de API** — Supabase Auth SSR + middleware + `requireUser()` em 22 rotas + route group `(portal)` + tela de login branded. Migration 004 (profiles+role) aplicada. **Login testado e funcionando.** (QA: PASS com concerns)
- **Polimento visual** — sidebar e grid de Integrações corrigidos.

## 🔑 Setup / credenciais (estado)
| Peça | Status |
|---|---|
| Supabase (URL + service_role + anon) | ✅ ligado · migrations 002/003/004/006/009 aplicadas · **005 (RLS) NÃO aplicada** (blindagem extra pendente) |
| Anthropic (IA) | ✅ ligada e validada (claude-opus-4-8) |
| Login admin | ✅ `craniumdigital.ia@gmail.com` (senha temp `CraniumAdmin@2026` — trocar) |
| WhatsApp/Evolution | ✅ **conectado** (+55 21 97253-2773) |
| Google Calendar | ✅ **conectado e testado** (auto-agendamento ativo) |
| E-mail (Gmail SMTP) | ✅ confirmação de reunião + Google Meet |
| Facebook / Meta Lead Ads | ✅ **conectado via Make** (webhook `/api/leadgen` + `x-make-secret`) |
| Deploy Vercel | ✅ **NO AR** em `crm-cranium.vercel.app` (deploy via `vercel --prod` CLI, projeto `crm-cranium`) |

## 🔧 EM ANDAMENTO / FILA
- **Topbar + Novo Lead + Interruptor IA (2026-06-29 — NO AR):**
  - **Novo Lead:** `POST /api/leads` (`1e62428`) + modal NovoLeadModal no kanban, botões "Novo Lead" e "Adicionar" por coluna funcionais (`99d9265`).
  - **Topbar 4 botões funcionais** (`38e22b9`): avatar→menu (Perfil/Sair), busca→leads (`/crm?lead=`), sino→próximas reuniões + leads novos, filtro→`/crm?stage=`. KanbanBoard lê `?lead`/`?stage` (Suspense no crm/page.tsx).
  - **Interruptor liga/desliga da IA:** flag `agent_enabled` em integrations_config + trava no `src/handler.ts` (desligada = registra lead, não responde) + `GET/POST /api/agente/status` (`a7bf4d0`); `components/AiToggle.tsx` (switch na sidebar) (`b562788`). Tudo deploy+push OK.
- **Agenda / Story 5.7 (2026-06-29 — NO AR):** módulo Agendamento completo. Backend `src/crm/calendar.ts` (listEvents/updateEvent/deleteEvent + AgendaEvent) + rotas `/api/agenda/events` (GET/POST/PATCH/DELETE). Frontend `components/AgendaModule.tsx` (calendário mês/semana roxo, CRUD, seletor de lead, Meet). Google Calendar = fonte da verdade (sync bidirecional ao abrir/escrever). Vínculo lead via `extendedProperties.private.leadId`. Commits `a1cd001`+`6f59938`, deploy prod OK.
  - **Melhorias 2026-06-29 (NO AR):** (1) **11 cores** do Google por evento (`colorId`, sincroniza nos 2 lados) — `00df5aa`+`f0e279d`; (2) **eventos sobrepostos lado-a-lado** (column packing, visão semana) — `2da4333`; (3) **arrastar para remarcar** (drag-to-reschedule, pointer events, otimista+revert) — `01b739f`. Build+deploy OK.
  - **Lição de orquestração:** evitar 2 agentes no MESMO arquivo em paralelo (crm-frontend-2 e -3 colidiram em AgendaModule.tsx; resolvido redirecionando o -3 só p/ a feature que faltava). Para mudanças no mesmo arquivo, serializar ou mandar tudo a UM agente. **Pendente: QA (crm-qa) — story em in-review.**
- **Perfil & Config (2026-06-29 — NO AR):** tela `/config` (nome + foto via Storage), dashboard home, foto na sidebar. Migration 009 aplicada (coluna `avatar_url` + bucket `avatars` + policy `avatars_own_folder` pasta-própria). Commit `116db31` + deploy prod OK.
- **Blindagem RLS (migration 005):** ⬜ pendente de aplicação no Supabase. QA provou que anon key lê/insere nas tabelas de negócio. Hoje só o gate server-side + service_role protege. Aplicar `005-rls-business-tables.optional.sql` → re-rodar `scripts/test/ac5-negative.mjs` com `STRICT_RLS=1`.
- **Trocar senha temp do admin** (`CraniumAdmin@2026`).
- **Bugs do QA (CRM):** escape duplo no Kanban; otimismo não-revertido em erro; MOCK oculta CRM vazio; IDOR tags/checklist sem escopo de dono. (a corrigir)

## 🗂️ Decisões (ADRs em `decisions/`)
- ADR-001 serverless (funções /api) · ADR-002 webhook síncrono 60s · **ADR-003 Next.js** · **ADR-004 Evolution + Meta Lead Ads (Make)**.

## 🧭 Modelo de trabalho
Lead (team-os) orquestra; agentes `feat-*` (general-purpose) implementam features com fronteiras de arquivo; pre-flight em coisas críticas; QA independente revisa; lead verifica (build/test/smoke) + aplica migrations + abre no navegador antes de avisar o usuário.

> Relatórios de QA: `agents/qa/review-2026-06-26.md`. Stories: `stories/` (epic Portal = 5.x).
