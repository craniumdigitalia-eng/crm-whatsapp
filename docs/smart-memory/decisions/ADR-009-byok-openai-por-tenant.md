---
title: "ADR-009: BYOK — chave OpenAI por tenant (corretor) no modelo SaaS"
type: decision
status: accepted
agent: crm-architect
created: 2026-07-08
updated: 2026-07-08
tags: [architecture, decision, ia, openai, byok, multi-tenant, saas, fase-1, custo]
related: ["[[ADR-005-ia-openai-vs-anthropic]]", "[[ADR-008-plano-de-controle-central]]", "[[../project/roadmap-saas]]", "[[../stories/backlog/6.2-onboarding-self-service]]", "[[../stories/backlog/9.3-wizard-setup-in-app]]"]
---

# ADR-009: BYOK — chave OpenAI por tenant (corretor)

## Status
**Accepted** (usuário, 2026-07-08). Complementa [[ADR-005-ia-openai-vs-anthropic]] (que fixou o provedor de IA em **OpenAI/GPT**) para o modelo **SaaS multi-tenant**. Não muda o provedor; muda **de quem é a chave** e **onde ela vive** por tenant.

## Contexto
- O ADR-005 migrou o agente para OpenAI (GPT) com **uma chave dedicada do CRM** (billing isolado da Cranium). Isso serve a **um** deploy (a instância da Cranium).
- Ao virar SaaS ([[../project/roadmap-saas]] § "Forma do produto SaaS"), cada **corretor** é um tenant à parte. Duas opções para a IA:
  1. **Chave central da Cranium para todos os tenants:** a Cranium banca o custo de IA de todos e repassa no preço. Concentra risco (uma chave para toda a base), embute custo variável imprevisível no plano único e mistura o gasto de todos os clientes numa fatura só.
  2. **BYOK (bring your own key): cada corretor pluga a própria chave OpenAI.** O custo de IA é do corretor, não da Cranium; o gasto fica isolado por tenant; nenhuma chave da Cranium é exposta ao volume dos clientes.
- O usuário escolheu **BYOK, somente OpenAI (sem opção de Claude)**, coerente com o ADR-005.

## Decisão
1. **A chave de IA é por tenant (BYOK) e é do próprio corretor.** No SaaS, o agente de cada tenant usa a **`OPENAI_API_KEY` do corretor**, informada por ele no onboarding. **Continua OpenAI (GPT); não há opção de Claude/Anthropic** (mantém o ADR-005).
2. **Onde a chave vive:** guardada por tenant, **server-side**, criptografada em repouso; nunca no client, nunca em outro tenant, nunca commitada. No modelo "deploy por cliente", é a env/segredo do deploy do corretor; no registro central, o control-plane ([[ADR-008-plano-de-controle-central]], schema `control_plane`) guarda no máximo a referência/estado da integração, não a chave em claro fora do lugar seguro.
3. **O corretor pluga a chave no wizard de onboarding** — é o **passo 1** do wizard ([[../stories/backlog/9.3-wizard-setup-in-app]]), pré-requisito para o agente atender. Sem chave válida, o agente não roda para aquele tenant (degradação clara, não erro genérico).
4. **Validação na entrada:** ao salvar, o sistema faz uma chamada de teste barata à OpenAI para confirmar que a chave é válida antes de marcar o passo como concluído.
5. **A instância da Cranium não muda:** ela **não é tenant** (guard-rail do [[ADR-008-plano-de-controle-central]]) e segue com a chave dedicada do ADR-005. BYOK vale só para os tenants do SaaS.

## Consequências
- **Positivo:** custo de IA sai da Cranium e vira do corretor (o plano único R$997/mês não carrega custo variável de tokens); gasto isolado por tenant; sem chave central exposta ao volume de todos.
- **Positivo (segurança):** raio de exposição de uma chave é um tenant só; vazamento não afeta os demais nem a Cranium.
- **Trade-off (fricção de onboarding):** o corretor precisa ter/criar uma conta OpenAI e gerar a chave — passo a mais no wizard e potencial ponto de suporte. Mitigar com guia claro no passo 1 e validação imediata.
- **Trade-off (suporte):** problemas de billing/limite da OpenAI passam a ser do corretor; o produto precisa distinguir "chave inválida/sem crédito do corretor" de erro do sistema, e avisar o corretor.
- **Modelo fixo:** o `AGENT_MODEL` (default `gpt-4o-mini`, ADR-005) continua sendo escolha do produto, não do corretor; o corretor traz a chave, não o modelo.

## Alternativas descartadas
- **Chave central da Cranium para todos os tenants:** descartada. Embute custo variável de IA no plano único (imprevisível), concentra risco numa chave só e mistura o gasto de todos os clientes. BYOK resolve os três.
- **Deixar o corretor escolher o provedor (OpenAI ou Claude):** descartada. Mantém o ADR-005 (só OpenAI) para não duplicar caminhos de código (Chat Completions vs SDK Anthropic) por tenant. Reabrir só se um provedor cair.

## Gatilho para reabrir
Reavaliar se (a) a fricção de o corretor obter a chave derrubar a conversão do onboarding (talvez oferecer uma chave gerenciada opcional com repasse de custo), ou (b) a Cranium decidir absorver o custo de IA como diferencial comercial.
