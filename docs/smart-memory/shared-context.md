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
