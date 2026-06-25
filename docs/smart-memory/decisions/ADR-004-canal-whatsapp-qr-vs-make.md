---
title: "ADR-004: Canal WhatsApp — QR (Evolution auto-hospedada) vs Make"
type: decision
status: proposed
agent: crm-architect
created: 2026-06-25
updated: 2026-06-25
tags: [architecture, decision, security]
related: ["[[ADR-003-portal-nextjs]]", "[[../project/architecture]]", "[[../stories/backlog/3.1-adapter-canal-make]]", "[[../stories/backlog/5.8-evolution-self-hosted]]", "[[../stories/backlog/5.9-whatsapp-connect-qr]]"]
---

# ADR-004: Canal WhatsApp — QR (Evolution auto-hospedada) vs Make

## Status
**Proposed** — aguarda confirmação do lead. **Conflita com a decisão "Make como ponte"** do CLAUDE.md e com a Wave 2 **já entregue** (Story [[../stories/backlog/3.1-adapter-canal-make|3.1]] Evolution→Make DONE/QA PASS; webhook 3.3 construído em torno do inbound do Make) — ver impacto abaixo. É a reversão mais cara deste ADR e por isso precisa de aceite explícito do lead/usuário.

## Contexto

O módulo 4 do portal pede **"Conectar WhatsApp via QR code"** — onboarding self-service: o operador lê o QR no portal e parea o número. O **QR de pareamento é um recurso da Evolution API** (auto-hospedada, conectada à sessão do WhatsApp). O **Make NÃO expõe** esse QR para o nosso portal — no Make a conexão é gerida dentro do próprio Make. Portanto **o requisito de QR no portal força ter a Evolution acessível a nós**.

Isso colide com a decisão anterior (Make como ponte, já que a Vercel serverless não hospeda a Evolution). A Story 3.1 está construindo justamente o adapter de saída Evolution→Make.

## Opções consideradas

### A — Evolution auto-hospedada (VPS/Railway) — recomendada
Evolution roda num host gerenciado (Railway/Fly/VPS). O portal mostra o **QR** (proxy ao endpoint da Evolution) e gere a instância; a Vercel fala **direto** com a Evolution para enviar/receber.
- **Prós:** satisfaz o requisito de QR/onboarding self-service no portal; controle total da instância (status, reconexão, múltiplas instâncias por cliente no futuro); sem custo variável por operação do Make; o protótipo **já** fala com a Evolution direto (`src/whatsapp/evolution.ts`) — menos reescrita de domínio; entrada via webhook da Evolution → `/api/webhook`.
- **Contras:** **ops próprio** — hospedar, monitorar, atualizar a Evolution, manter a sessão WhatsApp viva (reconexão/expiração); superfície de segurança (expor a Evolution API com `apikey`, restringir origem à Vercel); precisa de um servidor sempre-ligado (vai contra a simplicidade serverless). Custo: host ~US$5–20/mês.

### B — Make como ponte (decisão atual)
Mantém o Make abstraindo o canal; sem QR no portal (conexão gerida no Make).
- **Prós:** zero infra para nós; já decidido e em construção (3.1); Make também serve de glue para outras automações (calendário, notificações).
- **Contras:** **não entrega o requisito do módulo 4** (sem QR/onboarding self-service no portal); custo do Make escala com operações; menos controle e um hop a mais de latência; dependência de produto de terceiro no caminho crítico de mensagens.

### C — Híbrido
Evolution auto-hospedada como **canal de mensagens + QR**; Make retido **apenas para glue não-canal** (Cal.com/Google Calendar, notificações internas do módulo de agendamento).
- **Prós:** entrega o QR (via Evolution) e ainda aproveita o Make onde ele é forte (orquestração de automações), sem pôr o Make no caminho crítico das mensagens.
- **Contras:** dois sistemas a manter; precisa deixar claro o limite (mensagens = Evolution; automações = Make).

## Decisão

**Opção A como canal (Evolution auto-hospedada), na prática um híbrido C:** a Evolution passa a ser o canal de WhatsApp (entrada/saída + QR no portal) e o **Make é retido apenas para automações não-canal** (agendamento/notificações, módulo 3).

Razão decisiva: o requisito de QR/onboarding no portal é **funcional e explícito** e **só** a Evolution o satisfaz. Como o protótipo já integra a Evolution diretamente, a reversão do caminho de mensagens é de baixo atrito no domínio.

## Impacto na Wave 2 já entregue (ação para o lead)
A Wave 2 **já shipou** o caminho Make: 3.1 (adapter de saída → Make, QA PASS) e 3.3 (webhook construído em torno do **inbound do Make**, dedupe dependente do mapeamento `wamid` no cenário do Make — requisito ainda pendente do usuário). Escolher a Evolution **reverte o caminho de mensagens** para **Vercel↔Evolution direto** (como no protótipo). Recomendo ao lead:
- **Não jogar fora a Wave 2:** o domínio (`handleInbound`, agente, persistência) é o mesmo; muda só a borda do canal. A saída volta a usar `src/whatsapp/evolution.ts` (envio direto, já existe); a entrada passa a receber o webhook **da Evolution** em `/api/webhook` em vez do payload do Make.
- **Dedupe melhora:** com a Evolution, o `external_id` vem direto de `key.id` da mensagem — elimina a dependência frágil do mapeamento `wamid` no Make (requisito escalado pelo QA da 3.1).
- **Repropor o Make para glue não-canal:** o investimento em Make migra para o **módulo de agendamento** (Story 5.7) — notificações/Cal.com — onde agrega valor.
- Tratar a re-rota do canal como uma **story própria** (5.8 provisionamento Evolution + 5.9 QR connect), não como retrabalho silencioso da 3.1/3.3.

## Consequências

**Positivas:** módulo 4 viável; controle do canal; custo previsível; menos terceiros no caminho crítico.

**Negativas / mitigações:**
- **Ops da Evolution:** isolar numa story de provisionamento (5.8) com host gerenciado (Railway) + healthcheck + estratégia de reconexão; documentar runbook.
- **Segurança:** Evolution atrás de `apikey` forte, restrição de origem/IP à Vercel, segredos só em env; **nunca** expor a Evolution API direto ao browser — o QR é **proxied** por uma função `/api` autenticada (não chamada client→Evolution).
- **Sessão WhatsApp:** monitorar expiração/desconexão; o módulo 4 deve mostrar status da instância e permitir re-parear.

## Gatilho para reverter ao Make-puro (B)
Se a ops da Evolution se mostrar cara/instável e o onboarding self-service deixar de ser requisito, reconsiderar B. Decisão reversível: o domínio fala com uma interface de canal; trocar a implementação por trás é localizado.
