---
title: "ADR-004: Canal WhatsApp — decidido Evolution auto-hospedada (Make dropado)"
type: decision
status: accepted
agent: crm-architect
created: 2026-06-25
updated: 2026-06-25
tags: [architecture, decision, security]
related: ["[[ADR-003-portal-nextjs]]", "[[../project/architecture]]", "[[../stories/backlog/5.8-evolution-self-hosted]]", "[[../stories/backlog/5.9-whatsapp-connect-qr]]", "[[../stories/backlog/5.10-meta-lead-ads]]", "[[../stories/backlog/5.7-modulo-agendamento]]"]
---

# ADR-004: Canal WhatsApp — decidido Evolution auto-hospedada (Make dropado)

## Status
**Accepted — DECISÃO FINAL** (usuário, 2026-06-25; detalhes delegados ao lead). **Canal = Evolution auto-hospedada. Make removido por completo** (canal *e* automações). **Não muda mais.** Supersede a decisão "Make como ponte" do CLAUDE.md.

## Decisão

1. **Canal de WhatsApp = Evolution auto-hospedada** (Railway). O portal mostra o **QR** para parear o número (proxied por função `/api` autenticada). Vercel ↔ Evolution **direto** (entrada via webhook da Evolution, saída via `src/whatsapp/evolution.ts`).
2. **Make dropado de tudo** — não é mais usado nem no canal nem como glue.
3. **Agendamento (módulo 3) = Google Calendar API direto** (SDK/MCP), sem Make/Cal.com — menos um terceiro para o usuário configurar/pagar. Ver [[../stories/backlog/5.7-modulo-agendamento|5.7]].
4. **Aquisição = Meta Lead Ads (formulário instantâneo), outbound-first.** O anúncio usa **formulário instantâneo** (NÃO CTWA). Fluxo: lead preenche o form → webhook **`leadgen`** (`/api/leadgen`) → busca dados via **Graph API** → cria o lead → **dispara o opener outbound** no WhatsApp via Evolution → lead responde → `/api/webhook` (Evolution) → `handleInbound` + agente (fluxo inbound existente). Atribuição (form/anúncio/campanha) capturada para o BI. Ver [[../stories/backlog/5.10-meta-lead-ads|5.10]].

> **Dois ingressos distintos (documentar):** `/api/leadgen` (novos leads do Meta, **outbound-first**) vs `/api/webhook` (respostas do lead, **inbound**). O **opener livre exige Evolution** — a Cloud API oficial exigiria template aprovado para a 1ª mensagem fora de janela. Isso **reforça** a escolha da Evolution.

**Princípio guia:** minimizar o esforço do **usuário** — ele escaneia 1 QR, conecta o Google uma vez e cria o anúncio com formulário; **nós** cuidamos de hospedar e manter a Evolution.

## Contexto e trajetória

O módulo 4 pede conectar o WhatsApp e o objetivo de aquisição é **FB Ads → atendimento**. Houve idas e vindas (Make vs Evolution; CTWA vs formulário). Esclarecido: o anúncio do usuário é **formulário instantâneo (Meta Lead Ads)**, que inverte o fluxo para **outbound-first** (nós disparamos a 1ª mensagem). O usuário fechou em **manter a Evolution** (necessária para o opener livre) e **eliminar o Make**, delegando os detalhes ao lead. Este ADR consolida a decisão final.

## Alternativas descartadas
- **Make como ponte (canal):** zero infra para nós, mas não entrega QR/onboarding self-service, põe um terceiro pago no caminho crítico e fora do nosso controle. Descartado.
- **Make/Cal.com como glue de agendamento:** substituído por Google Calendar API direto (menos um terceiro).
- **Cloud API oficial da Meta:** não escolhida agora (Evolution não-oficial já atende; reavaliar se houver bloqueio de compliance/escala).

## Impacto na Wave 2 (gerir como re-rota planejada, não jogar fora)
A Wave 2 entregou o caminho Make (3.1 saída→Make, 3.3 webhook sobre payload do Make). Com a decisão final:
- **Saída** volta a `src/whatsapp/evolution.ts` (envio direto — já existe no protótipo).
- **Entrada** passa a receber o webhook **da Evolution** em `/api/webhook` (reusa `parseWebhook`); dedupe por **`external_id = key.id`** (mais robusto — elimina a dependência frágil do mapeamento `wamid` no Make que o QA havia escalado).
- O **domínio** (`handleInbound`, agente, persistência, idempotência) **não muda**.
- Encapsulado nas stories **[[../stories/backlog/5.8-evolution-self-hosted|5.8]]** (provisionar + re-rota + ajuste do `/api/webhook`) e **[[../stories/backlog/5.9-whatsapp-connect-qr|5.9]]** (QR/status no portal). A 3.1 (adapter→Make) é removida do caminho.

## Consequências

**Positivas:** controle total do canal; QR self-service; opener outbound livre (só possível com Evolution); atribuição via Lead Ads (form/anúncio); menos terceiros (sem Make) → menos custo/configuração para o usuário; dedupe inbound mais forte (`key.id`).

**Negativas / mitigações:**
- **Ops da Evolution (host sempre-ligado):** isolar em 5.8 (Railway + healthcheck + runbook de reconexão); é o trade-off aceito para ter QR e controle. Nós operamos, não o usuário.
- **Risco de ban no outbound-first:** disparar opener para números novos via Evolution (não-oficial) tem risco; o opt-in via formulário reduz, não elimina. Mitigar com **rate limiting / sem blast** e monitorar (AC da 5.10).
- **Segurança:** Evolution atrás de `apikey` forte, restrição de origem/IP à Vercel, segredos só em env; **nunca** expor a Evolution ao browser — QR e comandos via função `/api` autenticada (5.9). Webhook `leadgen` valida verify token + assinatura.
- **Sessão WhatsApp:** monitorar expiração/desconexão; 5.9 mostra status e permite re-parear.
- **Google OAuth (5.7):** autorização única do usuário; tratar token/refresh com segurança.

## Gatilho para reabrir
Só se a ops da Evolution se tornar inviável (instabilidade/custo) **ou** surgir necessidade de Cloud API oficial por compliance/escala. Decisão reversível: o domínio fala com uma interface de canal; trocar a implementação por trás é localizado.
