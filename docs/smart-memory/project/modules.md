---
title: Mapa de Módulos
type: modules
status: active
agent: crm-architect
created: 2026-06-25
updated: 2026-07-06
tags: [project, modules, architecture]
related: ["[[overview]]", "[[architecture]]", "[[tech-stack]]"]
---

# Mapa de Módulos — crm-whatsapp

Protótipo Node.js + TypeScript (Express + SQLite), ~12 arquivos em `src/`.
Trate o protótipo como **referência de lógica de negócio**; a migração de produção
(Supabase + Vercel + Make) preserva os contratos de função, troca a infra. Ver [[architecture]].

> Convenção: nomes de função e comentários em português; o agente nunca inventa preço/prazo.

> ⚠️ A seção **"Módulos do protótipo"** lá embaixo é referência HISTÓRICA (Express/SQLite/Make).
> O estado real hoje é o **portal de produção** mapeado abaixo (Next.js + Supabase + OpenAI + Evolution).

---

## Módulos de PRODUÇÃO (portal — estado atual, jul/2026)

Stack: Next.js 15 App Router, Supabase (service_role), OpenAI (gpt-4o-mini), Evolution (Railway), Vercel. Domínio em `src/`, borda HTTP em `app/api/`, UI em `app/(portal)/` + `components/`.

### Domínio / dados (`src/`)
- `src/config.ts` — env (OpenAI, Supabase, Evolution, Google, e-mail, `SITE_LEAD_SECRET`, `CRON_SECRET`). **God node**.
- `src/db.ts` — client Supabase service_role. **God node** (toda persistência passa aqui).
- `src/types.ts` — `Lead`, `Message`, `LeadStatus`, `AUTO_STATUSES`, `STATUS_LABELS`. **God node**.
- `src/crm/leads.ts` — repositório de leads: `getOrCreateLead`, `updateLeadFields` (dispara a lista automática de e-mail), `setStatus` (automação por etapa + notificação), `addMessage`, `deleteLead`, atribuição. **God node**.
- `src/handler.ts` — orquestrador: `handleInbound` (recebe→IA→responde em partes com timing humano) + `iniciarAtendimento` (opener outbound Meta/site). **God node**.

### IA do agente (`src/agent/`)
- `agent/agent.ts` — loop **OpenAI Chat Completions + function calling**. Ferramentas: `atualizar_lead`, `transferir_para_humano`, `agendar_reuniao`, **`enviar_material`** (envia imagem/prova). Guarda anti-vácuo.
- `agent/prompt.ts` — system prompt dinâmico: SPIN selling, atendimento impecável (dúvidas/provas/agendamento), injeta materiais e contexto do lead.
- `agent/config.ts` — persona/tom/abordagem (em `integrations_config`).
- `agent/assets.ts` — materiais/provas (bucket `agent-assets`): categorias, upload, `assetsSummaryForPrompt`.

### Canal WhatsApp (`src/whatsapp/`)
- `whatsapp/evolution.ts` — `sendText` (delay/"digitando"), **`sendMedia`**, `parseWebhook` (1:1), `parseGroupWebhook` (grupos), `fetchAllGroups` (lento→cache), `getEvolutionState`, `fetchGroupSubject`.

### Módulos de produto (`src/crm/`)
- `finance.ts` — **Financeiro**: clientes/MRR, receitas avulsas, despesas, DRE por período, churn, inadimplência; **Metas** (`getGoals/setGoals`).
- `demands.ts` — **Demandas**: `handleGroupMessage` (gatilho "demanda"), classifica+resume via IA, CRUD, contagem por grupo.
- `groupchat.ts` — **Grupos**: histórico de mensagens de grupo (`group_messages`) + **cache** da lista de grupos (`groups_cache`).
- `email.ts` / `email-content.ts` (pílulas via OpenAI) / `email-automation.ts` / `email-provider.ts` — **Email marketing** + **lista automática** (`email_auto_list_id`).
- `notify.ts` — notificações ao operador (WhatsApp best-effort). `health.ts` — **alerta de queda da Evolution** por e-mail.
- `meta.ts` — Meta Lead Ads (`upsertMetaLead`/`upsertMakeLead`, extrai e-mail do form). `calendar.ts` + `meeting-email.ts` — Google Calendar + confirmação.
- `integrations.ts` — config das integrações (`getEvolutionConfig` etc.) via `integrations_config` (banco > env).
- `followup/scheduler.ts` + `followup/cadence.ts` — follow-up (via Vercel Cron).

### Borda HTTP (`app/api/`)
`webhook` · `leadgen` · `site-lead` · `cron/{followup,evolution-health}` · `leads/*` (+ status/reply/tags/checklist/edit/takeover/release/DELETE) · `finance/*` · `demands/*` · `groups/*` (+ messages, refresh) · `agente/{config,preview,status,assets}` · `email/*` · `agenda/*` · `integrations/*` · `profile` · `notify` · `tags` · `bi/metrics` · `health`.

### UI (`app/(portal)/` + `components/`)
Dashboard · **CRM** (`KanbanBoard`, drag-and-drop) · **Conversas** (`ConversasInbox`) · **Grupos** (`GruposInbox`) · **Demandas** (`DemandasBoard`) · Follow-up · **Agente IA** (`AgentConfigModule` + `AgentAssets`) · **Financeiro** (`FinanceDashboard`) · **Metas** (`MetasDashboard`) · **BI** (`BiDashboard` + `BiLeadsTable`) · Agenda (`AgendaModule`) · Email (`EmailModule`) · WhatsApp · Integrações · Config. Sidebar/Topbar em `components/`.

### Banco (migrations `supabase/migrations/`)
001 schema · 002 tags/checklists · 003 atribuição · 004 auth/profiles · 005 RLS (opcional) · 006 role-lock · 007 email · 008 followup-schedule · 009 profile-settings · 010 lead-photo · **011 finance** · **012 demands** · **013 group-messages** · **014 agent-assets**. Buckets Storage: `avatars`, **`agent-assets`** (público).

---

## Módulos do protótipo (referência histórica)

### Bootstrap / Servidor
- **Responsabilidade:** sobe o Express, registra rotas, serve o dashboard estático e inicia o motor de follow-up.
- **Arquivos:** `src/index.ts`
- **Depende de:** [[config]] (`src/config.ts`), [[db]] (`src/db.ts`, import por efeito colateral para criar tabelas), `src/routes/webhook.ts`, `src/routes/api.ts`, `src/followup/scheduler.ts`.
- **Quem usa:** ponto de entrada (`npm run dev` / `npm start`). Ninguém o importa.
- **Migração:** na Vercel some o `app.listen` + `startFollowUpEngine`; cada rota vira função serverless e o cron vira Vercel Cron. Ponto crítico — ver [[architecture]].

### Configuração
- **Responsabilidade:** carrega `.env` (dotenv), normaliza variáveis (modelo, chaves, parâmetros de follow-up, intervalo em ms).
- **Arquivos:** `src/config.ts`
- **Depende de:** `dotenv`, `process.env`.
- **Quem usa:** quase todos — `index.ts`, `agent/agent.ts`, `agent/prompt.ts`, `whatsapp/evolution.ts`, `followup/scheduler.ts`.
- **Nota:** `required()` apenas avisa (warn) se faltar variável; não falha rápido.

### Tipos / Domínio
- **Responsabilidade:** define o modelo de domínio: `LeadStatus` (estágios do funil), `Lead`, `Message`, `STATUS_LABELS`, e `AUTO_STATUSES` (estágios em que a IA responde: `novo`, `em_atendimento`, `qualificado`).
- **Arquivos:** `src/types.ts`
- **Depende de:** nada (folha do grafo).
- **Quem usa:** `handler.ts`, `crm/leads.ts`, `agent/agent.ts`, `followup/scheduler.ts`, `routes/api.ts`. **God node** — ver abaixo.

### Persistência (DB)
- **Responsabilidade:** abre o SQLite (`node:sqlite`, sem deps nativas), cria as tabelas `leads` e `messages` + índice. Exporta o handle `db`.
- **Arquivos:** `src/db.ts`
- **Depende de:** `node:sqlite`, `fs`, `path`.
- **Quem usa:** `crm/leads.ts` e `followup/scheduler.ts` (query direta). **God node**.
- **Migração:** substituir por `@supabase/supabase-js` (service_role no servidor). Schema é autoridade da crm-data; este módulo é só o acesso.

### CRM / Leads (camada de dados de domínio)
- **Responsabilidade:** todas as operações sobre leads e mensagens: `getOrCreateLead`, `getLead`, `findLeadByPhone`, `listLeads`, `getMessages`, `addMessage`, `resetFollowUp`, `incrementFollowUp`, `updateLeadFields`, `setStatus`.
- **Arquivos:** `src/crm/leads.ts`
- **Depende de:** [[db]], [[types]].
- **Quem usa:** `handler.ts`, `agent/agent.ts` (`updateLeadFields`), `routes/api.ts`, `followup/scheduler.ts`. **God node** — é o repositório.
- **Migração:** reescrever as mesmas funções batendo no Supabase. Manter as assinaturas para isolar o resto.

### Agente de IA (cluster IA)
- **Responsabilidade:** loop agentic com a Claude API. Mapeia histórico → mensagens, expõe as tools `atualizar_lead` e `transferir_para_humano`, executa o loop (até 5 iterações) e devolve `{ reply, handoff }`.
- **Arquivos:** `src/agent/agent.ts`, `src/agent/prompt.ts`
- **Depende de:** `@anthropic-ai/sdk`, [[config]], [[types]], `crm/leads.ts` (`updateLeadFields`), `prompt.ts`.
- **Quem usa:** `handler.ts` (`generateReply`).
- **Nota:** `applyTool` escreve direto no CRM (efeito colateral durante o raciocínio). O `handoff` retornado hoje **não é usado** pelo handler — a transição para `humano` acontece dentro de `applyTool`. Fronteira raciocínio (este módulo) × execução de ações (crm) a refinar — ver [[architecture]].

### WhatsApp / Evolution (cluster WhatsApp)
- **Responsabilidade:** I/O do canal. `sendText` (POST na Evolution API v2) e `parseWebhook` (normaliza `messages.upsert` → `InboundMessage[]`, filtra grupos/status, extrai texto).
- **Arquivos:** `src/whatsapp/evolution.ts`
- **Depende de:** [[config]], `fetch` global.
- **Quem usa:** `handler.ts`, `followup/scheduler.ts`, `routes/api.ts` (todos para `sendText`); `routes/webhook.ts` (`parseWebhook`).
- **Migração:** o canal passa a ser o **Make**. `sendText` → `POST {MAKE_SEND_URL} { phone, text }`. `parseWebhook` some/simplifica: o Make entrega `{ phone, name, text }` já normalizado. Ver [[architecture]].

### Follow-up / Scheduler (cluster follow-up)
- **Responsabilidade:** motor de retomadas (até `FOLLOWUP_MAX`, padrão 30). Cron (`node-cron`) varre leads em `AUTO_STATUSES` com `last_direction='out'` e intervalo vencido, envia mensagem rotacionada (5 variações + "última chance") e incrementa o contador.
- **Arquivos:** `src/followup/scheduler.ts`
- **Depende de:** `node-cron`, [[config]], [[db]] (query direta), [[types]], `crm/leads.ts`, `whatsapp/evolution.ts`.
- **Quem usa:** `index.ts` (`startFollowUpEngine`).
- **Migração crítica:** `node-cron` **não roda em serverless**. Vira rota `/api/cron/followup` (protegida por `CRON_SECRET`) disparada pela Vercel Cron. A lógica de `runFollowUpCheck` migra quase intacta; só muda o gatilho. Ver [[architecture]].

### Orquestrador (handler)
- **Responsabilidade:** fluxo de uma mensagem recebida: ignora `fromMe` → upsert do lead → grava mensagem `in` → zera follow-up → checa `AUTO_STATUSES` → promove `novo`→`em_atendimento` → chama o agente → envia e grava a resposta `out`.
- **Arquivos:** `src/handler.ts`
- **Depende de:** `whatsapp/evolution.ts`, `crm/leads.ts`, `agent/agent.ts`, [[types]].
- **Quem usa:** `routes/webhook.ts`. **God node** — é a coluna vertebral do fluxo receber→IA→responder→persistir.

### Rotas — Webhook
- **Responsabilidade:** recebe `POST /webhook/evolution`, responde 200 imediatamente, processa em background via `handleInbound`.
- **Arquivos:** `src/routes/webhook.ts`
- **Depende de:** `whatsapp/evolution.ts` (`parseWebhook`), `handler.ts`.
- **Quem usa:** `index.ts`.
- **Risco de migração:** processamento "fire-and-forget" após `res.sendStatus(200)` **não sobrevive** em serverless (a função congela ao retornar). E **não há dedupe de mensagens** hoje — ponto crítico de idempotência. Ver [[architecture]].

### Rotas — API do Dashboard
- **Responsabilidade:** CRUD do kanban: `GET /api/leads`, `GET /api/leads/:id`, `POST .../reply` (humano responde → vira `humano`), `.../status`, `.../takeover`, `.../release`, `.../edit`.
- **Arquivos:** `src/routes/api.ts`
- **Depende de:** `crm/leads.ts`, `whatsapp/evolution.ts` (`sendText`), [[types]].
- **Quem usa:** `index.ts` e o dashboard estático em `public/` (`app.js`).

### Dashboard (front-end)
- **Responsabilidade:** kanban do funil + leitura de conversas + controles (assumir/devolver/editar/responder). Estático, consome `/api`.
- **Arquivos:** `public/index.html`, `public/app.js`, `public/styles.css`
- **Depende de:** API em `src/routes/api.ts`.

---

## ⚡ God Nodes

Arquivos mais centrais — maior impacto de mudança (mais importados ou na rota crítica):

| Arquivo | Por que é central |
|---|---|
| `src/types.ts` | Modelo de domínio puro. Importado por 5 módulos. Mudar `LeadStatus`/`AUTO_STATUSES` propaga pra agente, follow-up, handler e API. |
| `src/db.ts` | Único ponto de acesso ao banco. Toda persistência passa por ele. Alvo nº1 da migração Supabase. |
| `src/crm/leads.ts` | Repositório de domínio. Importado por handler, agente, follow-up e API. As assinaturas aqui são o contrato a preservar na migração. |
| `src/handler.ts` | Coluna vertebral do fluxo receber→IA→responder→persistir. Conecta canal + CRM + agente. |
| `src/config.ts` | Configuração global. Importado por quase tudo; muda com a troca de canal (Evolution→Make) e de cron. |

---

## Clusters

### Cluster IA
`src/agent/agent.ts` ⟷ `src/agent/prompt.ts` — raciocínio do agente, tools e prompt.
Fronteira: escreve no CRM via `updateLeadFields`. Acionado por `handler.ts`.

### Cluster WhatsApp / Canal
`src/whatsapp/evolution.ts` ⟷ `src/routes/webhook.ts` — entrada (`parseWebhook`) e saída (`sendText`).
Na produção este cluster é abstraído pelo **Make**.

### Cluster Follow-up
`src/followup/scheduler.ts` (+ `node-cron`) — motor de retomadas; lê `db` direto e usa `crm/leads.ts` + `sendText`.
Na produção vira rota cron serverless.

### Cluster CRM / Persistência
`src/db.ts` ⟷ `src/crm/leads.ts` ⟷ `src/types.ts` — núcleo de dados de domínio. Tudo orbita aqui.

### Cluster Dashboard / API
`src/routes/api.ts` ⟷ `public/*` — operação humana sobre o funil.

### Cluster Orquestração
`src/handler.ts` + `src/index.ts` — fluxo e bootstrap; amarram todos os clusters acima.

---

## Dependencies (principais arestas "X importa Y")

```
index.ts            → config, db, routes/webhook, routes/api, followup/scheduler
handler.ts          → whatsapp/evolution, crm/leads, agent/agent, types
agent/agent.ts      → @anthropic-ai/sdk, config, agent/prompt, types, crm/leads
agent/prompt.ts     → config
whatsapp/evolution.ts → config
followup/scheduler.ts → node-cron, config, db, types, crm/leads, whatsapp/evolution
crm/leads.ts        → db, types
routes/webhook.ts   → whatsapp/evolution, handler
routes/api.ts       → crm/leads, whatsapp/evolution, types
db.ts               → node:sqlite, fs, path
config.ts           → dotenv
types.ts            → (folha — não importa nada do projeto)
```

Grau de entrada (quantos módulos importam): `types.ts` (5) · `config.ts` (5) · `crm/leads.ts` (4) · `whatsapp/evolution.ts` (3) · `db.ts` (2).
