---
title: "ADR-006: Canal WhatsApp em escala - manter Evolution com gatilho de migração para Cloud API"
type: decision
status: accepted
agent: crm-architect
created: 2026-07-08
updated: 2026-07-08
tags: [architecture, decision, whatsapp, canal, escala, evolution, cloud-api, saas]
related: ["[[ADR-004-canal-whatsapp-qr-vs-make]]", "[[../agents/research/saas-decisoes-canal-e-pagamento]]", "[[../project/roadmap-saas]]", "[[../stories/backlog/7.2-whatsapp-em-escala]]", "[[../stories/backlog/8.3-termos-whatsapp]]", "[[../stories/backlog/6.2-onboarding-self-service]]", "[[../stories/backlog/9.3-wizard-setup-in-app]]"]
---

# ADR-006: Canal WhatsApp em escala - manter Evolution com gatilho de migração para Cloud API

## Status
**Accepted** (usuário, 2026-07-08). Supersede **parcialmente** o [[ADR-004-canal-whatsapp-qr-vs-make]] - especificamente a cláusula "Cloud API oficial: reavaliar se houver bloqueio de compliance/escala" (seção "Alternativas descartadas" e "Gatilho para reabrir" do ADR-004). O resto do ADR-004 (Evolution auto-hospedada, Meta Lead Ads outbound-first, Google Calendar direto, Make dropado) permanece válido. Este ADR resolve a **DECISÃO 1** do [[../project/roadmap-saas]]. Base factual: [[../agents/research/saas-decisoes-canal-e-pagamento]] (DECISÃO 1).

## Decisão

1. **Manter a Evolution API (não-oficial) como canal principal no curto prazo.** Não migrar para a Cloud API oficial agora. Motivo central: a Cloud API cobra por mensagem de marketing (~R$0,35/msg no Brasil) e isso **inviabiliza financeiramente o follow-up de até 30 retomadas por lead** no modelo atual (a research estima ~R$56 mil/mês em 30 mil msgs/dia de marketing). A Evolution mantém custo de mensagem zero (paga-se só a infra do Railway).

2. **Foco operacional imediato na Evolution: reconexão automática + monitoramento de sessão por cliente.** O maior problema prático da Evolution não é hoje o custo, é a estabilidade da sessão (o Railway derruba a sessão, exige re-scan de QR). O trabalho de escala se concentra em: health-check por cliente, auto-reconexão sem babá manual e alerta segmentado (qual cliente caiu). Isso é o corpo da story [[../stories/backlog/7.2-whatsapp-em-escala]].

3. **Gatilho objetivo de migração para a WhatsApp Cloud API oficial** (o que vier primeiro):
   - Passar de **~30 clientes ativos**, OU
   - **Primeiro ban de número de cliente**.
   
   Um segundo gatilho qualitativo permanece: exigência de compliance por cliente (ex.: corretora regulada que exija canal oficial). Qualquer um dos gatilhos dispara a reavaliação formal e a execução do plano de migração descrito abaixo.

4. **Quando o gatilho disparar, o que muda** (readequação, não jogar fora):
   - **Opener outbound deixa de ser livre** - passa a exigir **template aprovado** pela Meta (categoria marketing/utility, aprovação em 1-24h). O fluxo outbound-first do Meta Lead Ads readequa a 1ª mensagem para um template.
   - **Verificação de empresa** obrigatória por cliente no Meta Business (CNPJ + dados legais, processo de 1-5 dias úteis) - vira passo de onboarding.
   - **Novo custo por conversa/mensagem**: marketing ~R$0,35, utility ~R$0,04, service (resposta em janela de 24h) grátis. O modelo de follow-up é repriorizado (ver abaixo).
   - **Modelo de follow-up muda**: em vez de 30 retomadas indiscriminadas via marketing, adota-se abordagem híbrida - opener via template, e após o lead responder (janela service de 24h grátis) as mensagens seguintes são gratuitas; follow-ups agendados usam **utility template** (~R$0,04, 9x mais barato que marketing). A cadência de 30 retomadas do modelo atual é reavaliada nesse momento.

5. **A borda do canal permanece isolada atrás de uma interface** (`src/whatsapp/*`, `/api/webhook`). A troca de implementação (Evolution → Cloud API) é localizada; o domínio (`handleInbound`, agente, persistência, idempotência, follow-up) não muda. Isso mantém a decisão reversível e a migração incremental.

## Contexto

A arquitetura atual (ADR-004) usa Evolution API com 1 instância por cliente no Railway. Ao virar SaaS e vender em escala (dezenas a centenas de clientes), a escolha do canal deixa de ser só técnica e vira risco de negócio: ban em massa dos números dos clientes, custo operacional de gerenciar N sessões e viabilidade financeira do follow-up.

A research ([[../agents/research/saas-decisoes-canal-e-pagamento]]) mapeou o trade-off central:
- **Evolution (não-oficial):** opener livre, custo de mensagem zero, já implementado. Contra: viola os ToS do WhatsApp, risco de ban documentado em 2-8 semanas com automação, sem SLA, gestão de sessão manual, e em 100+ instâncias vira operação de plataforma dedicada.
- **Cloud API (oficial):** zero risco de ban, SLA da Meta, sem sessão para gerenciar. Contra: opener exige template aprovado, verificação de empresa, e o custo de marketing template (~R$0,35/msg) inviabiliza o follow-up de 30 retomadas no volume projetado.

Nenhuma das duas é perfeita em escala. Para o volume atual (poucos clientes), a Evolution segue praticável com as mitigações de anti-ban. O ponto de decisão foi: **não pagar antecipadamente o custo (financeiro e operacional) da Cloud API enquanto o volume não justifica**, mas definir um gatilho objetivo para não ser pego de surpresa por um ban ou pela escala.

## Alternativas descartadas

- **Migrar já para a Cloud API oficial (agora):** descartada. Inviabiliza o follow-up de 30 retomadas no custo atual (~R$0,35/msg de marketing) e adiciona atrito de onboarding (verificação de empresa por cliente) sem retorno enquanto o volume é baixo. A estabilidade que ela traz não compensa o custo com poucos clientes.
- **Abordagem híbrida imediata (Evolution para opener + Cloud API para inbound):** tem respaldo na research, mas foi adiada para o momento do gatilho. Adotá-la já dobraria a complexidade da borda do canal (duas integrações) sem necessidade no volume atual.
- **Ficar na Evolution indefinidamente, sem gatilho:** descartada. Ignora o maior risco do negócio (ban em massa). O gatilho objetivo (30 clientes ou 1º ban) é a rede de proteção.

## Consequências

**Positivas:**
- Custo de mensagem permanece zero no curto prazo; o follow-up de 30 retomadas continua viável financeiramente.
- Sem atrito de verificação de empresa no onboarding enquanto o volume é baixo (onboarding mais simples).
- Foco de engenharia no problema real de hoje (estabilidade de sessão), não num custo futuro.
- Gatilho objetivo destrava as stories bloqueadas: dá o critério concreto que faltava para [[../stories/backlog/7.2-whatsapp-em-escala]] e [[../stories/backlog/8.3-termos-whatsapp]] especificarem os ACs sem esperar mais decisão.

**Negativas / mitigações:**
- **Risco de ban permanece** enquanto na Evolution. Mitigar com limites de cadência por número (números novos: 20-50 msgs/dia nas primeiras 2 semanas; aquecidos: 80-200/dia; delay de 10-45s entre mensagens; sem mensagens idênticas em sequência) - aplicados no motor de follow-up e documentados em [[../stories/backlog/8.3-termos-whatsapp]].
- **Migração futura tem custo de projeto** (template, verificação, novo modelo de follow-up). Mitigar mantendo a borda do canal atrás de uma interface (troca localizada) e deixando o plano de migração já escrito aqui, para executar rápido quando o gatilho disparar.
- **Monitoramento por cliente é pré-requisito para detectar o gatilho "1º ban"** - sem health-check segmentado, um ban passa despercebido. Por isso o AC de monitoramento por cliente da 7.2 é prioritário.

## Gatilho para reabrir
Este ADR se auto-agenda para reabertura: ao atingir **30 clientes ativos** ou no **1º ban de número de cliente** (ou exigência de compliance de um cliente), abrir ADR de migração para Cloud API executando o plano da seção "o que muda". Enquanto nenhum gatilho dispara, a decisão vale.
