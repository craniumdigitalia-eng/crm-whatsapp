---
title: Proposta e custos — Portal CRM Cranium para um cliente
type: comercial
updated: 2026-06-30
tags: [comercial, custos, white-label, precificacao]
---

# Portal CRM Cranium para um cliente (corretora) — necessidades e custo base

> Documento-base para você montar a apresentação e definir quanto cobrar.
> Cada cliente recebe uma instância DEDICADA e ISOLADA do sistema (dados separados).
> Os valores de infraestrutura são ESTIMATIVAS (preços mudam — confirme na hora). O custo da IA usa os preços atuais da Claude.

---

## 1. O que o cliente recebe

- CRM de WhatsApp com IA que faz o primeiro atendimento e qualifica os leads, no número do WhatsApp dele.
- Funil (kanban), conversas, ficha do lead com resumo da IA, foto do contato.
- Follow-up automático (cadência de retomadas até o lead responder).
- Agenda integrada ao Google Calendar (cria reunião + Google Meet + e-mail de confirmação).
- Captação por Meta Lead Ads (formulário do Facebook/Instagram) com atendimento automático.
- Métricas e BI do funil.
- Interruptor para ligar/desligar a IA e recuo automático quando um humano assume.
- Tudo na marca/identidade que você definir para ele.

## 2. O que precisamos para montar (requisitos e acessos)

Itens EXCLUSIVOS de cada cliente (criar/conectar um por cliente):

- [ ] **Banco de dados próprio** — projeto Supabase novo (isola os dados do cliente).
- [ ] **WhatsApp do cliente** — número dele + instância Evolution conectada (QR).
- [ ] **Hospedagem da Evolution** — Railway (uma instância por cliente).
- [ ] **Deploy** — projeto na Vercel (pode ficar tudo numa conta da agência).
- [ ] **IA** — chave Anthropic (Claude) — pode ser uma chave da agência com billing centralizado.
- [ ] **Google** — conta Google do cliente conectada (Calendar/Meet) via OAuth.
- [ ] **Meta/Facebook** — Página + formulário Lead Ads do cliente + cenário no Make.
- [ ] **E-mail de envio** — Gmail/SMTP do cliente (confirmações de reunião).
- [ ] **Config da IA** — preencher a aba "Agente IA" com persona, empresa, ramo (ex.: seguros + planos de saúde), objeções e FAQ do cliente.
- [ ] **(Opcional) Domínio próprio** do cliente.

O CÓDIGO já está pronto — o trabalho é montar a infra e configurar.

## 3. Custo de operação (mensal recorrente) — por cliente

Câmbio usado: ~R$ 5,40/US$ (aproximado — confirme).

| Item | US$/mês | ~R$/mês | Observação |
|---|---|---|---|
| Supabase (banco) | 0 a 25 | 0 a 135 | Plano Free atende no início; Pro (US$25) para produção/backup |
| Evolution (Railway) | 5 a 20 | 27 a 108 | 1 instância por cliente (WhatsApp dele) |
| Vercel (deploy) | 0 a 20 | 0 a 108 | 1 conta Pro da agência hospeda VÁRIOS clientes (custo diluído) |
| Make (Meta Lead Ads) | 0 a 29 | 0 a 157 | Free atende volume baixo |
| Google Calendar / Meta | 0 | 0 | Grátis (só configurar) |
| Domínio (opcional) | ~1 | ~5 | ~R$50/ano |
| **IA (Claude)** | variável | variável | ver tabela abaixo |

### Custo da IA (Claude) — a maior variável

Preços atuais por 1 milhão de tokens:

| Modelo | Entrada (US$/1M) | Saída (US$/1M) | Quando usar |
|---|---|---|---|
| Opus 4.8 (padrão hoje) | 5 | 25 | Máxima qualidade do atendimento |
| Sonnet 4.6 | 3 | 15 | Ótimo equilíbrio qualidade/custo em volume |
| Haiku 4.5 | 1 | 5 | Mais barato — alto volume |

Estimativa por lead totalmente atendido pela IA (~10 trocas + follow-ups):

| Modelo | ~US$ por lead | 300 leads/mês | 1.000 leads/mês |
|---|---|---|---|
| Opus 4.8 | 0,30 a 0,50 | US$ 90 a 150 | US$ 300 a 500 |
| Sonnet 4.6 | 0,18 a 0,30 | US$ 54 a 90 | US$ 180 a 300 |
| Haiku 4.5 | 0,06 a 0,12 | US$ 18 a 36 | US$ 60 a 120 |

> Estimativas. O custo real depende do tamanho das conversas e do nº de follow-ups.
> **Alavanca de economia:** trocar Opus → Sonnet/Haiku no painel; e ligar "prompt caching" no código (reduz ~90% do custo de entrada do prompt fixo). Recomendo começar em Sonnet para clientes de volume.

### Resumo do custo mensal por cliente (estimado)

| Cenário | Infra + IA (US$/mês) | ~R$/mês |
|---|---|---|
| Enxuto (free tiers + Haiku, baixo volume) | 25 a 50 | 135 a 270 |
| Produção (Pro + Sonnet, ~300 leads) | 100 a 170 | 540 a 920 |
| Premium (Pro + Opus, alto volume) | 200 a 400+ | 1.080 a 2.160+ |

## 4. Custo único de setup (montagem)

- Não é custo de software (o código já existe).
- É o SEU tempo para: criar Supabase, conectar WhatsApp/Evolution, Google, Meta/Make, publicar e configurar a IA do cliente. Estimativa: algumas horas por cliente.
- Trate como **taxa de setup** (valor único) na sua proposta.

## 5. Sugestão de precificação (como cobrar)

Modelo recomendado: **Setup (único) + Mensalidade (recorrente)**.

- **Setup (único):** cobre a montagem e o onboarding. Ex.: a partir de R$ X (seu tempo + valor de implantação).
- **Mensalidade:** cobre infraestrutura + IA + gestão/suporte + sua margem.

Como achar o preço da mensalidade:
1. Some o custo do cenário do cliente (tabela do item 3). Ex.: produção ≈ R$ 700/mês de custo.
2. Adicione margem pelo VALOR entregue, não só pelo custo. Para um corretor, cada venda de plano/seguro vale muito — um fluxo previsível de leads paga a mensalidade fácil.
3. Faixa de referência (ajuste à sua realidade): mensalidade entre **2x e 4x o custo** quando o custo é o piso; em valor, mensalidades de R$ 1.500 a R$ 3.000+/mês são plausíveis para um sistema que substitui um SDR.

> Argumento de venda: o sistema substitui (ou turbina) um SDR. Compare a mensalidade com o custo de um SDR humano (salário + encargos) e com o valor de 1–2 vendas a mais por mês.

## 6. Modelo de operação (multi-cliente)

- 1 instância por cliente (dados isolados = mais seguro e vendável).
- A agência pode centralizar: 1 conta Vercel (vários projetos), 1 chave Anthropic com billing único, 1 repositório-base clonado por cliente.
- Para escalar: criar um guia de setup repetível (checklist do item 2) para montar cada cliente em poucas horas.

---

### Avisos

- Valores de Supabase, Vercel, Railway e Make são estimativas e mudam — confirme os planos atuais antes de fechar preço.
- Preços da Claude conforme tabela atual (Opus 4.8 5/25, Sonnet 4.6 3/15, Haiku 4.5 1/5 por 1M tokens).
- Câmbio aproximado; use o do dia.
