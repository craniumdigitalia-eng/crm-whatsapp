# CLAUDE.md — Briefing do projeto (handoff para o time/agentes)

> Este arquivo é lido pelo Claude Code ao abrir o projeto. Ele orienta os agentes e os devs a continuarem a construção na stack de produção. **Leia antes de mexer.**

## Objetivo do produto

Um CRM de WhatsApp que **substitui o SDR** da agência (Cranium Digital):
- Faz o **primeiro atendimento** automático de leads via WhatsApp (agente de IA da Claude).
- **Qualifica** o lead (serviço desejado, objetivo, orçamento) e registra no funil.
- Faz **follow-up automático** — até **30 retomadas por lead** — até o lead responder ou virar atendimento humano.
- Mostra tudo num **dashboard** com pipeline (kanban) e conversas.

## Estado atual (o que já existe neste repo)

Um **protótipo funcional** em Node.js + TypeScript (Express + SQLite local), já compilando e rodando:
- Agente de IA: [src/agent/agent.ts](src/agent/agent.ts) + [src/agent/prompt.ts](src/agent/prompt.ts) — loop com ferramentas `atualizar_lead` e `transferir_para_humano`. Modelo padrão `claude-opus-4-8`.
- WhatsApp (Evolution API): [src/whatsapp/evolution.ts](src/whatsapp/evolution.ts).
- Funil/CRM: [src/crm/leads.ts](src/crm/leads.ts), tipos em [src/types.ts](src/types.ts).
- Follow-up (até 30 retomadas): [src/followup/scheduler.ts](src/followup/scheduler.ts) (hoje via `node-cron`).
- Orquestração receber→IA→responder: [src/handler.ts](src/handler.ts).
- API + webhook: [src/routes/](src/routes/). Dashboard: [public/](public/).

Trate o protótipo como **referência de lógica de negócio**. A versão de produção muda a infra (abaixo).

## Stack de produção (alvo)

| Camada | Decisão |
|--------|---------|
| Banco | **Supabase** (Postgres). Schema base pronto em [supabase/schema.sql](supabase/schema.sql). |
| Hospedagem | **Vercel** (funções serverless + Vercel Cron). |
| IA | **Claude API** (`claude-opus-4-8`; trocar para `claude-sonnet-4-6` se precisar baratear no volume). |
| WhatsApp | **Evolution API** auto-hospedada (Railway) — QR de pareamento exibido no portal; Vercel↔Evolution direto. |
| Aquisição | **Meta Lead Ads** (formulário instantâneo) → webhook `leadgen` → opener outbound automático. |
| Agendamento | **Google Calendar API** direto (sem Make). |
| Front | **Next.js App Router** — portal multi-módulo da equipe interna (Supabase Auth SSR + RBAC). |

## Implicações de arquitetura (importante)

1. **Serverless não tem processo longo** → o `node-cron` do protótipo **não roda na Vercel**. Trocar por **Vercel Cron** chamando uma rota `/api/cron/followup` protegida por `CRON_SECRET`.
2. **Persistência** → trocar [src/db.ts](src/db.ts) (SQLite) por `@supabase/supabase-js` usando a **service_role key** no servidor (ignora RLS). Reescrever [src/crm/leads.ts](src/crm/leads.ts) com as mesmas funções, mas batendo no Supabase.
3. **Webhook idempotente** → Make/Evolution podem reenviar; deduplicar por id da mensagem.

## Canal WhatsApp + Aquisição — DECIDIDO: Evolution + Meta Lead Ads (ADR-004)

**Make foi descartado.** Decisão final (ver `docs/smart-memory/decisions/ADR-004`):

- **Canal = Evolution API auto-hospedada** (Railway). A Vercel fala **direto** com a Evolution.
  - **Saída:** `src/whatsapp/evolution.ts` envia direto na Evolution.
  - **Entrada (respostas do lead):** webhook da Evolution → `POST {VERCEL_URL}/api/webhook` → `handleInbound` → agente. Dedupe por `external_id = key.id` (id nativo da mensagem).
  - **QR:** o portal mostra o QR de pareamento, proxied por uma função `/api` autenticada (nunca client→Evolution direto).
- **Aquisição = Meta Lead Ads (formulário instantâneo)** — fluxo **outbound-first**:
  - Lead preenche o form no Meta → webhook `leadgen` → `POST {VERCEL_URL}/api/leadgen` → busca dados via Graph API → cria o lead → **dispara mensagem de abertura (outbound)** via Evolution → lead responde → cai no `/api/webhook` → agente assume.
  - Dois ingressos distintos: `/api/leadgen` (novos leads do Meta) e `/api/webhook` (respostas do WhatsApp).
  - O **opener livre exige Evolution** (a Cloud API oficial pediria template aprovado).
- **Agendamento:** Google Calendar API direto (sem Make).

## Roadmap — migração FEITA, agora vira PORTAL

**Migração protótipo → produção: CONCLUÍDA (PRs #1-#3).**
- [x] **Wave 0 — Hardening:** idempotência (`external_id`), UUID, follow-up atômico.
- [x] **Wave 1 — Supabase:** `db.ts`/`leads.ts` reescritos para `@supabase/supabase-js`; schema aplicado.
- [x] **Wave 2 — Serverless:** rotas → funções `/api`; `/api/webhook`; `/api/cron/followup` + Vercel Cron (`CRON_SECRET`); webhook fail-closed.

**Próximo — Epic 5: Portal interno (Next.js).** Ver `docs/smart-memory/stories/backlog/5.*` + ADR-003/004.
- [ ] P0: shell Next.js · auth Supabase + RBAC · design system (KV em `docs/design/kv/`).
- [ ] P1: módulo CRM/kanban · aba rica de leads.
- [ ] P2: Métricas & BI · Agendamento (Google Calendar direto) · Evolution self-hosted + QR · Meta Lead Ads (form → opener) · guia de setup.
- [ ] Observabilidade + rate limiting.

> Nota: a Wave 2 entregou a borda do canal via Make; o ADR-004 re-rota para **Evolution direto** (encapsulado nas stories 5.8/5.10 + ajuste do `/api/webhook`). Domínio intacto.

## Variáveis de ambiente (produção)

```
ANTHROPIC_API_KEY=...
AGENT_MODEL=claude-opus-4-8
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
# Canal Evolution (auto-hospedada)
EVOLUTION_URL=...           # URL da instância Evolution (Railway)
EVOLUTION_INSTANCE=...
EVOLUTION_API_KEY=...
# Meta Lead Ads (formulário instantâneo)
META_APP_SECRET=...         # validar assinatura X-Hub-Signature-256 do webhook leadgen
META_VERIFY_TOKEN=...       # handshake do webhook
META_PAGE_ACCESS_TOKEN=...  # buscar dados do lead via Graph API
# Cron + agenda
CRON_SECRET=...             # protege /api/cron/followup
GOOGLE_CALENDAR_CREDENTIALS=... # service account / OAuth para agendamento
COMPANY_NAME=Cranium Digital
FOLLOWUP_MAX=30
FOLLOWUP_INTERVAL=24
FOLLOWUP_UNIT=hours
```

## Convenções

- TypeScript, código e comentários em português, nomes de função descritivos.
- O agente **nunca** inventa preço/prazo; usa ferramentas para registrar qualificação e transferir para humano.
- Mensagens do agente: curtas, tom de WhatsApp brasileiro, 1 pergunta por vez.
- Não commitar segredos. `.env` e `.claude/settings.local.json` estão no `.gitignore`.

## Permissões / bypass

- `.claude/settings.json` (versionado): allow-list de comandos de dev (npm, git, supabase, vercel…) para o time.
- `.claude/settings.local.json` (não versionado): `defaultMode: bypassPermissions` — roda sem pedir autorização. Ajuste por dev. Alternativa no terminal: `claude --dangerously-skip-permissions`.
