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
| Supabase (URL + service_role + anon) | ✅ ligado · migrations 002/003/004 aplicadas |
| Anthropic (IA) | ✅ ligada e validada (claude-opus-4-8) |
| Login admin | ✅ `craniumdigital.ia@gmail.com` (senha temp `CraniumAdmin@2026` — trocar) |
| WhatsApp/Evolution | ⬜ montar (Railway) |
| Facebook via Make | ⬜ cenário no Make + adaptar `/api/leadgen` |
| Deploy Vercel | ⬜ |

## 🔧 EM ANDAMENTO / FILA
- **Hardening 5.2 (S1+S2):** trigger anti-escalonamento de role (migration 006) + `requireAdmin()` nos endpoints de credencial. (em execução)
- **Motion neural** na tela de login (rede neural viva + cérebro com glow). (em execução)
- **Bugs do QA (CRM):** escape duplo no Kanban; otimismo não-revertido em erro; MOCK oculta CRM vazio; IDOR tags/checklist sem escopo de dono. (a corrigir)
- **Facebook via Make:** adaptar o card + endpoint pro fluxo Make (lead do form → POST → CRM → IA atende). (a fazer)
- **Integrações restantes:** Evolution + QR; Google Calendar OAuth real.
- **Deploy Vercel** (com envs) — só depois da auth/segurança fechada.

## 🗂️ Decisões (ADRs em `decisions/`)
- ADR-001 serverless (funções /api) · ADR-002 webhook síncrono 60s · **ADR-003 Next.js** · **ADR-004 Evolution + Meta Lead Ads (Make)**.

## 🧭 Modelo de trabalho
Lead (team-os) orquestra; agentes `feat-*` (general-purpose) implementam features com fronteiras de arquivo; pre-flight em coisas críticas; QA independente revisa; lead verifica (build/test/smoke) + aplica migrations + abre no navegador antes de avisar o usuário.

> Relatórios de QA: `agents/qa/review-2026-06-26.md`. Stories: `stories/` (epic Portal = 5.x).
