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
| WhatsApp | **Não-oficial**, via **Make** como ponte (ver "Integração WhatsApp"). |
| Automação/glue | **Make.com** (já disponível). |

## Implicações de arquitetura (importante)

1. **Serverless não tem processo longo** → o `node-cron` do protótipo **não roda na Vercel**. Trocar por **Vercel Cron** chamando uma rota `/api/cron/followup` protegida por `CRON_SECRET`.
2. **Persistência** → trocar [src/db.ts](src/db.ts) (SQLite) por `@supabase/supabase-js` usando a **service_role key** no servidor (ignora RLS). Reescrever [src/crm/leads.ts](src/crm/leads.ts) com as mesmas funções, mas batendo no Supabase.
3. **Webhook idempotente** → Make/Evolution podem reenviar; deduplicar por id da mensagem.

## Integração WhatsApp — DECIDIDO: Make como ponte

A Vercel (serverless) não hospeda a Evolution, então o **Make** é a ponte com o WhatsApp:
- **Entrada:** WhatsApp → cenário no Make → `POST {VERCEL_URL}/api/webhook` com `{ phone, name, text }` (deduplicar por id da mensagem).
- **Saída:** a rota da Vercel faz `POST` no **webhook do Make** (`MAKE_SEND_URL`) com `{ phone, text }`, e o Make envia no WhatsApp.

Assim a Vercel não fala com a Evolution diretamente — o Make abstrai o canal. (Alternativa descartada: Evolution num VPS/Railway com a Vercel chamando direto.)

## Camada serverless (esqueleto JÁ criado em `/api` e `/lib`)

A versão de produção já tem o esqueleto, type-checado (`npx tsc -p tsconfig.vercel.json`):
- [lib/supabase.ts](lib/supabase.ts), [lib/leads.ts](lib/leads.ts) — CRM no Supabase (service_role).
- [lib/agent.ts](lib/agent.ts) + [lib/prompt.ts](lib/prompt.ts) — agente Claude.
- [lib/whatsapp.ts](lib/whatsapp.ts) — envio via webhook do Make (`MAKE_SEND_URL`).
- [api/webhook.ts](api/webhook.ts) — entrada: Make faz `POST` aqui → agente responde.
- [api/cron/followup.ts](api/cron/followup.ts) — retomadas, protegida por `CRON_SECRET` (Vercel Cron em [vercel.json](vercel.json)).

## Roadmap (o que falta para produção)

- [ ] Criar projeto Supabase e rodar [supabase/schema.sql](supabase/schema.sql).
- [ ] Configurar env vars na Vercel (`ANTHROPIC_API_KEY`, `SUPABASE_*`, `MAKE_SEND_URL`, `CRON_SECRET`, `FOLLOWUP_*`).
- [ ] Montar os cenários no Make: entrada (WhatsApp → `POST /api/webhook`) e saída (`MAKE_SEND_URL` → WhatsApp).
- [ ] Idempotência no `/api/webhook` (deduplicar reenvios do Make por id da mensagem).
- [ ] Dashboard na Vercel (estático ou Next.js); opcional **Supabase Auth** + RLS.
- [ ] **Substituir o SDR de fato:** ao qualificar, agendar reunião (Cal.com/Google via Make) e notificar a equipe.
- [ ] Observabilidade (logs, conversão por estágio) e rate limiting.

## Variáveis de ambiente (produção)

```
ANTHROPIC_API_KEY=...
AGENT_MODEL=claude-opus-4-8
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
MAKE_SEND_URL=...            # webhook do Make para enviar no WhatsApp (se usar Make)
CRON_SECRET=...             # protege /api/cron/followup
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
