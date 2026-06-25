---
title: "Convenções de Código — CRM WhatsApp"
type: project
agent: crm-analyst
created: 2026-06-25
updated: 2026-06-25
tags: [conventions, code-style, projeto]
related: ["[[tech-stack]]", "[[overview]]"]
---

# Convenções de Código — CRM WhatsApp

Extraídas do código real em `src/`. Não são suposições — cada item tem evidência observada.

---

## Idioma

**PT-BR em tudo.** Código, comentários, nomes de função, mensagens de log, mensagens do agente para o usuário final.

Evidência direta:
- Comentários: `// Processa uma mensagem recebida do lead: registra, e (se for o caso) responde com a IA.`
- Nomes de função: `getOrCreateLead`, `runFollowUpCheck`, `handleInbound`, `generateReply`, `parseSqliteDate`
- Logs: `[handler] Lead ${fresh.phone} esta em '${fresh.status}', agente nao responde.`
- Ferramentas da IA: `atualizar_lead`, `transferir_para_humano`
- Enum de status: `novo`, `em_atendimento`, `qualificado`, `proposta`, `fechado`, `perdido`, `humano`

Exceção: nomes de campo de banco e propriedades de interface usam snake_case inglês (`service_interest`, `follow_up_count`, `last_direction`) — padrão SQL convencional.

---

## Organização de pastas

```
src/
  index.ts            — entrypoint: Express + rotas + follow-up engine
  config.ts           — lê process.env, exporta objeto config tipado
  db.ts               — inicialização do banco (SQLite → Supabase em prod)
  types.ts            — tipos e enums compartilhados (LeadStatus, Lead, Message)
  handler.ts          — orquestra: inbound → IA → resposta
  agent/
    agent.ts          — loop agentic, ferramentas, detecção de modelo
    prompt.ts         — system prompt do agente
  crm/
    leads.ts          — CRUD de leads e mensagens
  whatsapp/
    evolution.ts      — sendText + parseWebhook (Evolution API)
  followup/
    scheduler.ts      — motor de follow-up (node-cron)
  routes/
    webhook.ts        — POST /webhook/evolution
    api.ts            — API REST do dashboard
public/               — dashboard estático (kanban + conversas)
supabase/
  schema.sql          — schema Postgres para produção
```

Cada pasta = uma responsabilidade. Sem barrel files (sem `index.ts` de re-export em subpastas).

---

## Estilo de imports

CommonJS (`require` via `import` TypeScript com `esModuleInterop: true`). Imports nomeados preferidos:

```typescript
import { db } from "../db";
import { Lead, Message, LeadStatus } from "../types";
import { config } from "../config";
import Anthropic from "@anthropic-ai/sdk"; // default import quando necessário
```

Paths relativos (`../`, `./`). Sem alias de path configurado. Imports agrupados: externos primeiro, internos depois (sem blank line separador formal — mas observado na prática).

Exceção deliberada: `node:sqlite` via `require()` comentado como necessário por ausência de types:
```typescript
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require("node:sqlite");
```

---

## Nomenclatura

| Padrão | Exemplos |
|--------|---------|
| Funções: verbos descritivos em camelCase | `getOrCreateLead`, `addMessage`, `resetFollowUp`, `startFollowUpEngine`, `historyToMessages`, `applyTool` |
| Interfaces: PascalCase | `Lead`, `Message`, `InboundMessage`, `AgentResult` |
| Types: PascalCase | `LeadStatus` |
| Constantes exportadas: SCREAMING_SNAKE ou camelCase | `AUTO_STATUSES`, `STATUS_LABELS`, `config` |
| Variáveis locais: camelCase PT-BR ou inglês curto | `lead`, `fresh`, `handoff`, `toolResults`, `nome` |
| Arquivos: kebab-case.ts ou camelCase.ts | `agent.ts`, `scheduler.ts`, `evolution.ts` |

---

## Padrões de erro

Log com prefixo de módulo entre colchetes. Nunca relança — registra e continua:

```typescript
console.error(`[handler] Erro ao gerar/enviar resposta para ${fresh.phone}:`, err);
console.error(`[followup] Falha ao enviar retomada para ${lead.phone}:`, err);
console.error("[webhook] erro ao processar:", e);
```

Prefixos em uso: `[config]`, `[handler]`, `[followup]`, `[webhook]`.

Erros de rede na Evolution: lança `Error` com mensagem descritiva (status HTTP + body). Quem chama lida com o catch.

`config.ts`: variável ausente → `console.warn` (não lança). Retorna string vazia para não travar o boot.

---

## Padrão webhook (fire-and-forget)

```typescript
webhookRouter.post("/evolution", (req, res) => {
  res.sendStatus(200); // responde imediatamente
  try {
    const messages = parseWebhook(req.body);
    for (const msg of messages) {
      handleInbound(msg).catch((e) => console.error("[webhook] erro ao processar:", e));
    }
  } catch (e) { ... }
});
```

Motivo: não segurar a Evolution esperando a IA responder (pode demorar segundos).

Em produção (Vercel): manter o mesmo padrão — retornar 200 antes de processar.

---

## Regras do agente de IA

Definidas em `src/agent/prompt.ts` e reforçadas em `CLAUDE.md`:

1. **Nunca inventa preço, prazo ou promessa.** Se não sabe: "um especialista vai passar os detalhes."
2. **Uma pergunta por vez.** Nunca despeja múltiplas perguntas juntas.
3. **Tom WhatsApp brasileiro** — simpático, direto, mensagens curtas (1 a 3 frases). Máximo 1 emoji quando faz sentido.
4. **Responde sempre em português do Brasil.**
5. **Usa ferramentas** para registrar qualificação (`atualizar_lead`) e transferir (`transferir_para_humano`). Não registra apenas na conversa.
6. **Acolhe o lead primeiro** — começa sempre acolhendo.
7. **Transfere para humano** quando: lead pede falar com pessoa, demonstra intenção de fechar, pede proposta formal, conversa exige especialista.

Loop agentic: máximo **5 iterações**. Thinking adaptativo habilitado para modelos compatíveis (Opus 4.6+, Sonnet 4.6, Fable 5).

---

## Pipeline de estágios (funil)

```
novo → em_atendimento → qualificado → proposta → fechado / perdido
                                                 humano (IA pausada)
```

`AUTO_STATUSES = ["novo", "em_atendimento", "qualificado"]` — agente só responde nesses estágios.

Transição `novo → em_atendimento` ocorre automaticamente em `handler.ts` quando o lead manda a primeira mensagem.

---

## Comentários

Densidade: moderada. Comentários explicam o **porquê**, não o quê. Exemplos:

```typescript
// Responde imediatamente para nao segurar a Evolution; processa em background.
// Preserva o conteudo do assistente (inclui blocos de thinking) e devolve os resultados.
// Usa o SQLite embutido no Node (node:sqlite, disponivel no Node 22.5+/24).
// Evita dependencias nativas que precisariam de Python/compilador no Windows.
// Recarrega para pegar status atual.
```

Sem comentários de JSDoc (`/** */`). Comentários inline curtos para contexto não óbvio.

---

## Git e segredos

`.env` e `.claude/settings.local.json` no `.gitignore` — nunca commitar.

`.claude/settings.json` (versionado): allow-list de comandos de dev (npm, git, supabase, vercel…).

`.claude/settings.local.json` (não versionado): `defaultMode: bypassPermissions` — por dev, não por repo.

---

## Scripts npm

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | `ts-node-dev --respawn --transpile-only src/index.ts` — hot reload |
| `npm run build` | `tsc` — compila para `dist/` |
| `npm start` | `node dist/index.js` — roda build compilado |
