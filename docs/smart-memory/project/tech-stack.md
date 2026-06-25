---
title: "Tech Stack — CRM WhatsApp"
type: project
agent: crm-analyst
created: 2026-06-25
updated: 2026-06-25
tags: [tech-stack, project, protótipo, produção]
related: ["[[conventions]]", "[[overview]]", "[[../agents/data-engineer/schema]]"]
---

# Tech Stack — CRM WhatsApp

## Stack atual (protótipo)

Node.js + TypeScript rodando como servidor Express com SQLite embutido (`node:sqlite`, disponível a partir do Node 22.5+). Toda a lógica roda num único processo persistente. Sem dependências nativas compiladas — decisão deliberada para facilitar Windows.

```
WhatsApp (lead) → Evolution API → Express webhook → Agente IA (Claude) → resposta
                                        │
                                        ├─ SQLite (node:sqlite built-in, data/crm.db)
                                        ├─ Motor follow-up (node-cron)
                                        └─ Dashboard estático (public/)
```

### Dependências de produção

| Pacote | Versão | Propósito |
|--------|--------|-----------|
| `@anthropic-ai/sdk` | ^0.68.0 | Cliente oficial da Claude API — loop agentic com ferramentas (`atualizar_lead`, `transferir_para_humano`) |
| `express` | ^4.19.2 | Servidor HTTP, routing de webhook (`/webhook/evolution`) e API REST do dashboard (`/api/*`) |
| `node-cron` | ^3.0.3 | Motor de follow-up no protótipo — agenda `runFollowUpCheck` via expressão cron. **Não roda na Vercel** (substituído por Vercel Cron em prod) |
| `dotenv` | ^16.4.5 | Carrega `.env` para `process.env` antes de qualquer importação |

### Dependências de desenvolvimento

| Pacote | Versão | Propósito |
|--------|--------|-----------|
| `ts-node-dev` | ^2.0.0 | Servidor de dev com hot reload (`npm run dev`) |
| `typescript` | ^5.5.4 | Compilação TypeScript — `tsc` gera `dist/` |
| `@types/express` | ^4.17.21 | Tipos do Express |
| `@types/node` | ^24.0.0 | Tipos do Node.js |
| `@types/node-cron` | ^3.0.11 | Tipos do node-cron |

### Configuração TypeScript

- `target`: ES2021 / `module`: CommonJS
- `strict: true`, `esModuleInterop: true`, `resolveJsonModule: true`
- `rootDir: src/`, `outDir: dist/`

### Banco (protótipo)

SQLite via `node:sqlite` (built-in Node 22.5+). Arquivo em `data/crm.db`, WAL mode habilitado. Zero dependências nativas — sem `better-sqlite3` nem Python/compilador.

### WhatsApp (protótipo)

Evolution API (não-oficial). Recebe eventos `messages.upsert` via webhook POST, envia via `POST /message/sendText/{instancia}` com header `apikey`.

---

## Stack de produção (alvo)

| Camada | Decisão | Observação |
|--------|---------|-----------|
| Banco | **Supabase** (Postgres) | Schema base em `supabase/schema.sql`. IDs UUID, timestamptz, enum `lead_status` |
| Hospedagem | **Vercel** (serverless) | Funções em `/api/`, cron em `vercel.json` |
| Cron | **Vercel Cron** | Rota `/api/cron/followup` protegida por `CRON_SECRET` — agenda `0 * * * *` (config atual) |
| IA | **Claude API** | Modelo padrão `claude-opus-4-8`; fallback `claude-sonnet-4-6` para volume |
| WhatsApp — entrada | **Make.com → POST /api/webhook** | Make recebe do WhatsApp, faz POST com `{ phone, name, text }`. Idempotência: deduplicar por id da mensagem |
| WhatsApp — saída | **POST no webhook do Make** (`MAKE_SEND_URL`) | Vercel não fala com Evolution diretamente; Make abstrai o canal |
| Automações | **Make.com** | Glue entre WhatsApp, Vercel e futuramente Cal.com/Google Calendar |

### Modelo de IA

| Modelo | Caso de uso |
|--------|-------------|
| `claude-opus-4-8` | Padrão — melhor qualidade de qualificação |
| `claude-sonnet-4-6` | Volume alto — mais barato, qualidade suficiente |
| `claude-haiku-4-5` | Conversas simples / triagem rápida |

Modelos Opus 4.6+, Sonnet 4.6 e Fable 5 suportam `thinking: { type: "adaptive" }` + `output_config: { effort: "low" }` — habilitado automaticamente em `src/agent/agent.ts` via regex. Loop agentic: máximo **5 iterações** por resposta.

---

## Variáveis de ambiente

### Protótipo (`.env.example`)

| Variável | Padrão | O que faz |
|----------|--------|-----------|
| `PORT` | `3000` | Porta do servidor Express |
| `ANTHROPIC_API_KEY` | — | Chave da Claude API (obrigatório) |
| `AGENT_MODEL` | `claude-opus-4-8` | Modelo do agente de IA |
| `EVOLUTION_URL` | `http://localhost:8080` | URL base da Evolution API |
| `EVOLUTION_INSTANCE` | — | Nome da instância WhatsApp na Evolution (obrigatório) |
| `EVOLUTION_API_KEY` | — | Chave de autenticação da Evolution (header `apikey`) |
| `FOLLOWUP_MAX` | `30` | Máximo de retomadas por lead antes de desistir |
| `FOLLOWUP_INTERVAL` | `24` | Intervalo numérico entre retomadas |
| `FOLLOWUP_UNIT` | `hours` | Unidade do intervalo: `hours` ou `minutes` (minutes para testes) |
| `FOLLOWUP_CRON` | `*/5 * * * *` | Expressão cron do motor de follow-up |
| `COMPANY_NAME` | `Cranium Digital` | Nome da agência usado pelo agente nas respostas |

### Produção (adicional — de CLAUDE.md)

| Variável | O que faz |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role (ignora RLS — usar apenas no servidor) |
| `MAKE_SEND_URL` | Webhook do Make para enviar mensagens no WhatsApp |
| `CRON_SECRET` | Protege a rota `/api/cron/followup` na Vercel |

---

## Roadmap de migração

- [ ] Criar projeto Supabase, rodar `supabase/schema.sql`
- [ ] Reescrever `src/db.ts` e `src/crm/leads.ts` usando `@supabase/supabase-js` (service_role)
- [ ] Reestruturar Express → funções serverless `/api/`
- [ ] `/api/webhook` idempotente (deduplicar por id da mensagem do Make)
- [ ] `/api/cron/followup` + Vercel Cron protegido por `CRON_SECRET`
- [ ] Dashboard estático ou Next.js App Router na Vercel
- [ ] Quando lead qualifica: agendar reunião via Make → Cal.com/Google Calendar
- [ ] Observabilidade: logs, métricas de conversão, rate limiting

---

## Referências de arquivo

- `src/config.ts` — lê todas as variáveis de ambiente, exporta objeto `config`
- `src/db.ts` — SQLite via `node:sqlite`; a substituir por Supabase
- `src/agent/agent.ts` — loop agentic, detecção de modelo, ferramentas
- `src/followup/scheduler.ts` — motor de follow-up com node-cron
- `vercel.json` — configuração do Vercel Cron (`/api/cron/followup`, `0 * * * *`)
- `supabase/schema.sql` — schema Postgres alvo
