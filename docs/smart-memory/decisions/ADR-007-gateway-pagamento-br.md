---
title: "ADR-007: Gateway de pagamento (Brasil) - Asaas"
type: decision
status: accepted
agent: crm-architect
created: 2026-07-08
updated: 2026-07-08
tags: [architecture, decision, pagamento, gateway, billing, asaas, saas, fase-1]
related: ["[[../agents/research/saas-decisoes-canal-e-pagamento]]", "[[../project/roadmap-saas]]", "[[../stories/backlog/6.1-cobranca-assinatura]]", "[[ADR-008-plano-de-controle-central]]"]
---

# ADR-007: Gateway de pagamento (Brasil) - Asaas

## Status
**Accepted** (usuário, 2026-07-08). Resolve a **DECISÃO 2** do [[../project/roadmap-saas]]. Base factual: [[../agents/research/saas-decisoes-canal-e-pagamento]] (DECISÃO 2). Destrava a integração de gateway (AC3+) da story [[../stories/backlog/6.1-cobranca-assinatura]].

## Decisão

1. **Gateway de pagamento = Asaas.** É a opção com melhor custo-benefício para SaaS B2B brasileiro com foco em recorrência via PIX e boleto.

2. **Escopo da integração** (o que este gateway cobre no produto):
   - **Assinatura recorrente** - cria cliente + cobrança recorrente por plano (PIX, boleto, cartão).
   - **NFS-e nativa** - emissão automática de nota fiscal de serviço por assinatura (R$0,49/nota). Integrar desde o lançamento da cobrança (não deixar para fase posterior), aproveitando que é nativo.
   - **Suspensão automática de inadimplente** - regra configurável por dias de inadimplência, casada com o ciclo `past_due → suspended` da 6.1.
   - **Webhooks de status** - recebe eventos de pagamento/cobrança; o webhook é idempotente (dedupe por id do evento do Asaas) e valida secret. Mesmo princípio do `/api/webhook` já existente.
   - **Dunning** - régua de cobrança nativa (WhatsApp, email, SMS, Serasa) para recuperar inadimplência antes da suspensão.

3. **Onde vive a integração:** no **plano de controle central** (ver [[ADR-008-plano-de-controle-central]]), não no deploy de cada cliente. Cobrança é por natureza cross-cliente; as tabelas `plans/subscriptions/invoices` e o webhook do Asaas moram no control-plane.

## Contexto

O CRM SaaS precisa cobrar assinatura recorrente de corretoras brasileiras (B2B). Métodos esperados: PIX, boleto e cartão. Necessidades críticas mapeadas na research: recorrência nativa, dunning/retry, suspensão automática de conta, emissão de NFS-e e API bem documentada com sandbox.

A research comparou Asaas, Pagar.me e Iugu. Números que decidiram:

| Critério | Asaas | Pagar.me | Iugu |
|---|---|---|---|
| PIX (por transação) | R$ 1,99 fixo | 1,19% do valor | ~R$ 1,50 (não confirmado) |
| Boleto | R$ 1,99 fixo | R$ 3,49 | ~R$ 2,50 (não confirmado) |
| Cartão à vista | R$ 0,49 + 2,99% | 4,39% | ~4% (negociável) |
| NFS-e nativa | Sim (R$0,49/nota) | Não (integração externa) | Verificar |
| Suspensão automática | Sim (configurável) | Não documentado | Não documentado |
| Transparência de preços | Pública | Pública | Não (consulta comercial) |
| Sem mensalidade | Sim | Sim | Não |

Para o ticket B2B típico (ex.: R$500/mês via PIX), o Asaas é ~3x mais barato que o Pagar.me em taxas (R$1,99 fixo vs 1,19% = R$5,95). O PIX/boleto fixo do Asaas é a estrutura ideal para mensalidade B2B, onde PIX e boleto dominam.

## Alternativas descartadas

- **Pagar.me:** descartado. PIX percentual (1,19%) e boleto (R$3,49) mais caros para o ticket B2B; cartão à vista (4,39%) mais caro; NFS-e não nativa (exigiria integração externa); suspensão automática não documentada. Foco em e-commerce de cartão de alto volume, não em SaaS B2B com mensalidade fixa.
- **Iugu:** descartada. Produto maduro em recorrência, mas **não publica taxas** (exige consulta comercial), tem estrutura de planos com mensalidade e menos adoção entre SaaS pequenos. A falta de transparência de preço torna a avaliação inconclusiva sem cotação direta - risco desnecessário quando o Asaas já atende com números públicos.

## Consequências

**Positivas:**
- Menor custo de PIX/boleto entre os três, com estrutura fixa (previsível) ideal para B2B.
- NFS-e nativa por assinatura resolve a nota fiscal (gancho da 6.1 / [[../stories/backlog/8.2-contratos-sla-cnpj-nf]]) sem integração de terceiros.
- Suspensão automática e dunning nativos casam diretamente com o ciclo de inadimplência da 6.1.
- Sem mensalidade de plataforma (paga só por transação recebida) - custo escala com a receita.
- API REST com sandbox completo e coleções Postman/Insomnia - integração testável.
- Suporte a split/marketplace se um dia houver modelo com revendedores.

**Negativas / mitigações:**
- **Webhooks relatados com atraso em picos de alta carga** (research). Mitigar com **reconciliação periódica** (cron que confere status das assinaturas direto na API, além do webhook) para não suspender cliente adimplente por webhook perdido - reforça o requisito de idempotência da 6.1 (AC4/AC5).
- **API menos madura que Stripe.** Aceitável: o público é BR e o Asaas é feito para PME brasileira.
- **Validar cobertura de municípios para NFS-e** antes do go-live (a emissão depende do município do cliente estar coberto) - item de verificação operacional, não bloqueia a decisão.
- **WhatsApp de cobrança é cobrado à parte** (R$0,55/notificação). Usar com parcimônia no dunning; email é o canal padrão sem custo extra.

## Gatilho para reabrir
Só se o Asaas se mostrar inviável na integração real (webhook reliability inaceitável mesmo com reconciliação, ou cobertura de NFS-e insuficiente para a base de clientes) ou se o modelo mudar para alto volume de cartão parcelado (onde outro gateway seria melhor).
