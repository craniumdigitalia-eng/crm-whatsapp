# CRM WhatsApp — Primeiro atendimento por IA + Follow-up automático

CRM próprio (Node.js + TypeScript) para uma agência de serviços digitais. Recebe leads pelo **WhatsApp** (via Evolution API), um **agente de IA da Claude** faz o primeiro atendimento e qualifica o lead, um **motor de follow-up** retoma quem não respondeu, e um **dashboard** com pipeline kanban mostra tudo.

```
WhatsApp (lead) ──▶ Evolution API ──▶ Webhook ──▶ Agente IA (Claude) ──▶ resposta
                                          │
                                          ├─▶ SQLite (leads, conversas)
                                          ├─▶ Motor de follow-up (cron)
                                          └─▶ Dashboard (kanban + conversas)
```

## Pré-requisitos

1. **Node.js 18+** (recomendado 20+). Confira com `node -v`.
2. **Evolution API** rodando e uma instância conectada ao WhatsApp (QR code lido). Veja https://doc.evolution-api.com — a forma mais fácil é via Docker.
3. **Chave da Anthropic** (Claude): https://console.anthropic.com

## Instalação

```bash
cd C:\Users\Bruno\crm-whatsapp
npm install
copy .env.example .env   # depois edite o .env com suas chaves
```

Edite o `.env`:
- `ANTHROPIC_API_KEY` — sua chave da Claude.
- `EVOLUTION_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_API_KEY` — dados da sua Evolution API.
- `COMPANY_NAME` — nome da sua agência (o agente usa nas respostas).

## Rodar

```bash
npm run dev      # modo desenvolvimento (reinicia ao salvar)
# ou
npm run build && npm start
```

Acesse o dashboard em **http://localhost:3000**.

## Conectar o WhatsApp (webhook)

Na sua Evolution API, configure o **webhook** da instância apontando para:

```
http://SEU_HOST:3000/webhook/evolution
```

com o evento **`messages.upsert`** habilitado. Em desenvolvimento local, exponha sua porta com um túnel (ex: `ngrok http 3000`) e use a URL pública do ngrok no webhook.

## Como funciona o follow-up

Quando **nós** mandamos a última mensagem e o lead não responde, o motor envia até 3 follow-ups automáticos, nos intervalos definidos em `FOLLOWUP_DELAYS` (padrão `24,48,72` horas). Assim que o lead responde, o contador zera.

**Para testar rápido**, no `.env`:
```
FOLLOWUP_UNIT=minutes
FOLLOWUP_DELAYS=1,2,3
FOLLOWUP_CRON=* * * * *
```

## Pipeline (estágios do funil)

`Novo → Em atendimento → Qualificado → Proposta → Fechado / Perdido`
Mais o estágio **Atend. humano**: quando você (ou o agente, via transferência) assume, a IA para de responder automaticamente. Use **Assumir** / **Devolver p/ IA** no dashboard.

## Trocar o modelo de IA (custo x qualidade)

No `.env`, `AGENT_MODEL`:
- `claude-opus-4-8` — melhor qualidade (padrão).
- `claude-sonnet-4-6` — mais barato, ótimo para volume.
- `claude-haiku-4-5` — mais rápido e barato para conversas simples.

## Estrutura

```
src/
  index.ts            servidor Express
  config.ts           variáveis de ambiente
  db.ts               banco SQLite (leads, mensagens)
  types.ts            tipos e estágios do funil
  whatsapp/evolution.ts   enviar/receber mensagens
  agent/agent.ts      agente de IA (loop com ferramentas)
  agent/prompt.ts     instruções do agente
  crm/leads.ts        serviço de leads/pipeline
  followup/scheduler.ts   motor de follow-up (cron)
  routes/webhook.ts   recebe mensagens da Evolution
  routes/api.ts       API do dashboard
  handler.ts          orquestra recebido → IA → resposta
public/               dashboard (kanban + conversas)
```

## Deploy em produção (Supabase + Vercel + Make)

Passo a passo completo em **[DEPLOY.md](DEPLOY.md)**. A camada de produção já tem esqueleto em `api/` e `lib/`; o briefing para o time está em [CLAUDE.md](CLAUDE.md).

## Próximos passos sugeridos

- Migrar o banco de SQLite para PostgreSQL quando o volume crescer.
- Migrar do WhatsApp não-oficial (Evolution) para a Cloud API oficial da Meta.
- Autenticação no dashboard.
- Relatórios (conversão por estágio, tempo de resposta).
