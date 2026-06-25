# Shared Context — crm-whatsapp (CRM ATENDIMENTO)

> Fonte de verdade compartilhada do time. Atualizada pelo lead a cada evento.

## Projeto
- **Repo:** github.com/craniumdigitalia-eng/crm-whatsapp (branch `main`)
- **O que é:** CRM de WhatsApp que substitui o SDR — agente de IA (Claude) faz primeiro atendimento, qualifica leads e faz follow-up (até 30 retomadas). Dashboard com kanban + conversas.
- **Estado:** protótipo Node.js+TS (Express + SQLite) em migração para produção (Supabase + Vercel + Make).

## Team ativo: crm-atendimento-migracao
Fase: **MIGRAÇÃO → produção** · Meta: "CRM mais top do mercado". Backlog: 14 stories / 4 waves ([[stories/BACKLOG]]).

### Wave 0 — Hardening (EM ANDAMENTO)
| Story | Task | Owner | Status |
|---|---|---|---|
| 1.1 idempotência external_id | #4 | crm-data | ✅ DONE — QA CONCERNS (aprovada, não-bloqueante) |
| 1.2 Lead.id→UUID | #5 | crm-data | ✅ DONE — QA CONCERNS (aprovada) |
| 1.3 follow-up atômico | #6 | crm-data | ◐ in-review — QA CONCERNS; aplicando fix #12 |
| cleanup db.ts (backup-não-DROP + remove ALTER morto) | #10 | crm-data | ✅ DONE — verificado pelo lead |
| fix janela concorrência 1.3 (last_message_at no claim) + remove incrementFollowUp | #12 | crm-data | 🟡 em execução |

**QA Wave 0:** 1.1 CONCERNS✅ · 1.2 CONCERNS✅ · 1.3 CONCERNS✅ (todas não-bloqueantes). Fix #12 fecha a janela de concorrência sequencial antes do PR.
**Dívida carregada (follow-ups):** (a) testes automatizados de regressão (AC4-1.1/AC5-1.2/AC5-1.3) — recomendar story de testing; (b) — #12 resolve o item de concorrência.
**Falta:** #12 + re-check QA → fecha Wave 0 → propor PR `feat/migracao-producao`.

Gate: **crm-qa** (god-node → QA obrigatório). Execução sequencial (god-nodes compartilhados).
**Push:** SEGURADO — acumular Wave 0 e propor branch/PR ao usuário ao fim da wave (repo está em `main`, não commitar/pushar sem OK).
Decisão lead: Wave 0 fica no protótipo (mudanças de tipo/contrato/lógica são persistentes p/ rewrite Supabase).
Follow-ups de QA registrados no fim do [[stories/BACKLOG]] (teste de regressão idempotência; NIT do catch em db.ts).

### Discovery (ENCERRADA ✅) — 2026-06-25
crm-architect (modules/architecture) · crm-analyst (tech-stack/conventions) · crm-data (schema) · crm-ux (components). 7 docs produzidos, sintetizados em [[project/overview]].

## 🔭 NOVA DIREÇÃO (usuário, 2026-06-25): CRM → PORTAL interno
Transformar de CRM/kanban em **portal multi-módulo para a equipe interna** da Cranium. Backend atual = fundação; CRM vira um módulo.
**Módulos:** 1) CRM/kanban (existe) · 2) Métricas & BI · 3) Agendamento de reuniões · 4) Conectar WhatsApp via **QR code** · 5) Aba rica de visualização de leads. Público: **equipe interna**.
**Planejamento em curso (crm-architect):** ADR-003 (Next.js para o portal?) · ADR-004 (QR/Evolution vs Make — o QR reabre a decisão de canal) · Epic de stories.
**Pendência usuário:** enviar o **KV / identidade visual** (design system branded) — ver story [[stories/backlog/4.6-redesign-visual-dashboard]] (será absorvida no epic do portal).

### Wave 2 — Serverless Vercel + Make (CONCLUÍDA ✅ — QA PASS, hardened)
3.1✅ 3.2✅ 3.3✅(+ fail-closed) 3.4✅. PR `feat/wave2-serverless` em consolidação (crm-devops). Go-live pendente: envs Vercel + setup Vercel + mapear wamid no Make.

### Wave 2 — detalhe
| Item | Task | Owner | Status |
|---|---|---|---|
| ADR abordagem serverless (gate da 3.2) | #20 | crm-architect | 🟡 decidindo (A funções /api · B Express-fn · C Next.js) |
| 3.1 adapter canal Evolution→Make | #21 | crm-integrations | ✅ DONE — QA PASS |
| 3.2 scaffold serverless | #22 | crm-backend | ◐ in-review — QA rodando (#26) |
| 4.4 a11y do drawer | #23 | crm-frontend | ✅ DONE (lead verify) |
| 3.3 webhook idempotente | #27 | crm-integrations | 🟡 implementando (ADR-002 síncrono 60s) |
| 3.4 cron Vercel | #28 | crm-backend | 🟡 implementando |

Canal: **Make.com**. ADRs 001/002 accepted.
🚨 **REQUISITO p/ usuário (escalado pelo QA da 3.1):** mapear `message.id` (wamid) como `id` no cenário do Make — sem isso o dedupe de webhook é fraco (hash por segundo não pega retry tardio). Tratar como requisito, não opcional.
Pendência runtime: `MAKE_SEND_URL`, `MAKE_WEBHOOK_SECRET`, `CRON_SECRET` + setup Vercel (deploy).

### Wave 1 — Persistência Supabase (CONCLUÍDA ✅)
| Story | Task | Owner | Status |
|---|---|---|---|
| 2.1 projeto Supabase + schema | #14 | lead/crm-data | ✅ DONE — schema aplicado (via pg direto), tabelas+UUID validados, creds no .env |
| 2.2 rewrite db.ts/leads.ts → Supabase | #15/#16 | crm-data | ✅ DONE — QA PASS; 2 nits de error-handling aplicados (#18) |

**Wave 1 COMPLETA.** PR empilhado (`feat/wave1-supabase` sobre `feat/wave0-hardening`) em criação pelo crm-devops.
Supabase vivo e validado e2e (29/29 + HTTP). App agora roda 100% no Postgres.

Supabase: projeto `iiahpfvhrfuznszytbod` · URL+service_role no `.env` (gitignored). Schema = `supabase/schema.sql`.
⚠️ Senha do banco foi compartilhada no chat — usuário pode resetar após a migração concluir.

---

## Objetivo do 1º ciclo (DEFINIDO pelo usuário em 2026-06-25)
**Migração protótipo → produção.** Escopo derivado do roadmap do CLAUDE.md:
1. Criar projeto Supabase + rodar `supabase/schema.sql`.
2. `db.ts`/`leads.ts` (SQLite) → `@supabase/supabase-js` (service_role no server).
3. Rotas Express → funções serverless `/api` na Vercel (ou Next.js App Router).
4. `/api/webhook` idempotente (entrada de mensagens, dedup por id) → agente → resposta via Make.
5. `/api/cron/followup` + Vercel Cron (substitui node-cron), protegido por `CRON_SECRET`.
6. Dashboard na Vercel; opcional Supabase Auth + RLS.
7. Observabilidade + rate limiting.

## Próximo
Após retornos do discovery: lead sintetiza `project/overview.md` + INDEX.md, encerra fase discovery, e dispara `*plan "migração protótipo → produção"` no crm-architect para quebrar em stories no backlog. Depois `*dispatch` com wave analysis (Supabase/persistência é base → outras dependem dela).
