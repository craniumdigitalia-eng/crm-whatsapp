---
title: "ADR-005: Provedor de IA do agente — migrado de Anthropic (Claude) para OpenAI (GPT)"
type: decision
status: accepted
agent: crm-architect
created: 2026-07-02
updated: 2026-07-03
tags: [architecture, decision, ia, custo]
related: ["[[ADR-003-portal-nextjs]]", "[[../project/architecture]]", "[[../changelog/2026-07-03-sessao-features]]"]
---

# ADR-005: Provedor de IA do agente — Anthropic (Claude) → OpenAI (GPT)

## Status
**Accepted** (usuário, 2026-07-02). Supersede a escolha `claude-*` do CLAUDE.md para a camada do agente.

## Contexto
- O agente de atendimento (e o gerador de pílulas de e-mail) rodava na **Anthropic** (`claude-sonnet-4-6`, antes `claude-opus-4-8`).
- A conta Anthropic ficou **sem crédito** (`credit balance too low`), parando o atendimento.
- O usuário optou por **trocar de provedor** para OpenAI (GPT), com **chave dedicada só do CRM** (billing isolado, dá pra ver o gasto exato do CRM em platform.openai.com/usage).
- Ponto esclarecido ao usuário: a assinatura do **ChatGPT** (consumidor) **não** dá acesso à API; a API da OpenAI é paga por uso, igual à Anthropic. Trocar de provedor não elimina o custo, só o move.

## Decisão
1. **Camada de IA do agente = OpenAI (GPT).** `src/agent/agent.ts` reescrito com **Chat Completions + function calling** (as 3 ferramentas preservadas: atualizar_lead, transferir_para_humano, agendar_reuniao). Loop, guarda anti-vácuo, coleta de e-mail e agendamento mantidos.
2. `src/crm/email-content.ts` (pílulas) também migrado para OpenAI.
3. `config.openaiApiKey` (`OPENAI_API_KEY`) + `config.agentModel` = `AGENT_MODEL` (default `gpt-4o`). **Modelo em produção: `gpt-4o-mini`** (escolhido por custo, ~15-16x mais barato que gpt-4o; qualidade suficiente para primeiro contato/SPIN, validada em teste).
4. `anthropicApiKey` mantido no config (opcional, sem uso) para reversão fácil.

## Consequências
- **Positivo**: atendimento volta a funcionar; custo por conversa baixo no mini; billing isolado por chave.
- **Diferenças de API tratadas**: sem "adaptive thinking" (feature Anthropic); tool calls no formato OpenAI (`tool_calls` / role `tool`); o client OpenAI exige `apiKey` na criação (fallback para não quebrar o build quando a env falta em build-time).
- **Trade-off**: GPT-4o-mini é um pouco mais verboso/emoji que o Claude; ajustável via prompt se incomodar.
- **Reversão**: trocar `AGENT_MODEL` de volta para um modelo Claude exigiria reverter `agent.ts`/`email-content.ts` para o SDK Anthropic (código versionado no git antes do commit da migração).
- **Env de produção (Vercel)**: `OPENAI_API_KEY` + `AGENT_MODEL=gpt-4o-mini`.
