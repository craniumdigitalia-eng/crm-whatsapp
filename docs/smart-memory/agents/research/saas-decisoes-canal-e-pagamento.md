---
title: "Research: Canal WhatsApp em escala e Gateway de Pagamento BR"
type: research
agent: crm-analyst
created: 2026-07-08
updated: 2026-07-08
tags: [research, whatsapp, canal, gateway, pagamento, saas, escala]
related: ["[[../../decisions/ADR-004-canal-whatsapp-qr-vs-make]]", "[[../../project/roadmap-saas]]"]
---

# Research: Canal WhatsApp em escala e Gateway de Pagamento BR

**Decisoes que informam:** Decisoes pendentes 1 e 2 do [[../../project/roadmap-saas]]
**Solicitado por:** team-os (2026-07-08)

---

## DECISAO 1 - Canal WhatsApp em escala

### Contexto

A arquitetura atual usa Evolution API (nao-oficial, Baileys/WhatsApp Web) com 1 instancia por cliente
no Railway. Com dezenas a centenas de clientes, a escolha do canal afeta custo,
risco de ban dos numeros, esforco operacional e viabilidade do fluxo outbound-first
(opener livre para leads de Meta Lead Ads).

### Resumo executivo

Evolution API e viavel para poucos clientes (ate ~20-30) com baixo volume de mensagens.
Em escala de centenas de clientes, o risco de ban em massa e o custo operacional de
gerenciar N sessoes tornam a Evolution API tecnicamente inaceitavel como canal principal.
A WhatsApp Cloud API oficial cobra por mensagem mas oferece estabilidade e compliance.
Uma abordagem hibrida e possivel: Cloud API para fluxos de resposta (inbound) e
Evolution para abertura de lead em fase inicial, migrando para template aprovado
conforme o volume cresce.

### Findings

#### Evolution API (nao-oficial, Baileys)

**Como funciona:** Emula o protocolo WhatsApp Web via engenharia reversa. 1 numero = 1 sessao ativa
mantida em Node.js. Nao requer aprovacao da Meta.

**Pros:**
- Opener outbound livre: envia qualquer mensagem sem template pre-aprovado
- Custo de mensagem zero (paga-se so infra: Railway ~$5-20/mes por instancia)
- Ja implementado, sem mudanca de arquitetura imediata

**Contras:**
- Viola os Termos de Servico do WhatsApp. Ban pode acontecer em 2-8 semanas com
  comportamento automatizado, independentemente do volume
- Sem SLA: Meta pode mudar o protocolo a qualquer momento, derrubando todas as instancias
  ate a comunidade atualizar o Baileys (potencial downtime de dias)
- Cada cliente = 1 sessao que pode cair e exigir re-scan de QR Code. Sem auto-reconexao
  garantida apos queda do Railway
- Meta intensificou deteccao automatica de clientes nao-oficiais em 2025-2026
- Em escala de 100+ instancias: gerenciamento de sessoes, monitoramento e reconexoes
  vira operacao de plataforma full-time
- Risco juridico: ban dos numeros dos clientes prejudica o negocio principal deles

**Limites documentados de seguranca (para reduzir ban):**
- Numeros novos: max 20-50 mensagens/dia nas primeiras 2 semanas
- Numeros aquecidos (uso manual previo de 2-5 dias): max 80-200 mensagens/dia
- Delay obrigatorio entre mensagens: 10-45 segundos
- Sem mensagens identicas em sequencia (spam detection)
- Distribuir carga entre multiplas sessoes aquecidas

**Fontes:** [WASenderAPI - Ban Guide 2026](https://wasenderapi.com/blog/how-to-use-evolution-api-without-getting-banned-on-whatsapp-2026-guide) | [Wapisimo - Unofficial Ban Risk](https://wapisimo.dev/blog/en/whatsapp-unofficial-api-ban-risk) | [GitHub Issue #1946 Anti-ban](https://github.com/evolution-foundation/evolution-api/issues/1946)

---

#### WhatsApp Cloud API (oficial Meta)

**Como funciona:** API REST hospedada pela Meta. Requer verificacao de empresa via Meta Business
e aprovacao de templates para mensagens outbound. Paga-se por mensagem entregue.

**Pros:**
- Zero risco de ban: canal oficialmente suportado e monitorado pela Meta
- SLA e estabilidade garantidos pela Meta
- Reconexao automatica: sem sessao para gerenciar, sem QR Code
- Em escala de 100+ clientes: muito menos overhead operacional (sem sessoes, sem reconexao manual)
- Compliance total com os termos do WhatsApp

**Contras:**
- Opener outbound exige template aprovado previamente pela Meta (aprovacao em 1-24h)
- Marketing templates custam $0.0625/mensagem (~R$0,35 na cotacao atual)
- Custo pode ser proibitivo em follow-up de 30 retomadas por lead com volume alto
- Exige verificacao de empresa: CNPJ, dados legais, processo de 1-5 dias uteis
- Precisa de conta Verified Business no Meta Business Suite

**Custos por mensagem no Brasil (base Meta, julho 2025+):**

| Categoria | USD | BRL aprox. |
|---|---|---|
| Marketing (opener, follow-up) | $0.0625 | ~R$ 0,35 |
| Utility (transacional) | $0.0068 | ~R$ 0,04 |
| Authentication (OTP) | $0.0068 | ~R$ 0,04 |
| Service (resposta em 24h) | Free | Gratis |

> Nota: BRL billing programado para segundo semestre de 2026. Ate la, cobrado em USD.
> BSP markup adicional de $0.003-$0.010/mensagem se usar parceiro (BSP) em vez de direto.

**Exemplo de custo com volume:**
- 100 clientes x 10 leads/dia x 30 follow-ups = 30.000 mensagens marketing/dia
- Custo diario: 30.000 x $0.0625 = $1.875/dia = ~$56.000/mes
- Isso torna o follow-up de 30 retomadas via Cloud API inviavel sem repriorizar o modelo

**Custo realista para o fluxo atual:**
- Se opener (1 mensagem) + follow-up limitado a 5 tentativas = 6 mensagens marketing
- 100 clientes x 10 leads/dia x 6 = 6.000 mensagens/dia = $375/dia = ~$11.250/mes
- Ainda caro. A Cloud API favorece fluxos com mais resposta do lead (service = gratis)

**Fontes:** [Blueticks - Pricing 2026](https://blueticks.co/blog/whatsapp-business-api-pricing-2026) | [Whautomate - Brazil Pricing](https://whautomate.com/whatsapp-business-api-pricing-brazil) | [Uptail - Pricing Guide](https://www.uptail.ai/blog/whatsapp-business-api-pricing-2026-what-it-costs-and-how-billing-works) | [Meta Developers - Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)

---

### Comparacao

| Criterio | Evolution API (nao-oficial) | Cloud API (oficial Meta) |
|---|---|---|
| Opener outbound livre | Sim (qualquer mensagem) | Nao (template aprovado obrigatorio) |
| Custo por mensagem | R$ 0 (so infra) | ~R$ 0,35 (marketing), ~R$ 0,04 (utility) |
| Custo infra por cliente | ~$5-20/mes Railway | Zero (sem sessao) |
| Risco de ban | Alto em escala (2-8 semanas documentado) | Zero |
| Gestao de sessao | Manual (QR re-scan) | Automatica (nenhuma) |
| Reconexao automatica | Parcial (Railway pode derrubar) | Sim |
| Compliance legal | Viola ToS do WhatsApp | Compliant |
| Verificacao empresa | Nenhuma | CNPJ + Meta Business (1-5 dias) |
| Viabilidade em 100+ clientes | Critica: operacao de plataforma dedicada | Alta |
| Follow-up 30 retomadas | Viavel tecnicamente, risco de ban | Inviavel financeiramente no modelo atual |

### O que os dados sugerem

Para o modelo atual com poucos clientes (ate ~20-30) e volume moderado, a Evolution
continua praticavel com as mitigacoes de anti-ban documentadas.

Para escala de centenas de clientes, nenhuma das duas opcoes e perfeita no modelo atual:
- Evolution: risco operacional e juridico inaceitavel
- Cloud API pura: custo de marketing template inviabiliza o follow-up de 30 retomadas

**Uma abordagem hibrida tem respaldo nos dados:**
1. Opener outbound via Evolution (nao muda o fluxo atual)
2. Assim que o lead responde (janela de 24h service = gratis), todas as mensagens seguintes
   sao free na Cloud API
3. Follow-up reduzido: em vez de 30 retomadas indiscriminadas, usar Cloud API com
   utility template (R$0,04) para follow-ups agendados = custo 9x menor que marketing

**Gatilho para migrar do modelo atual para hibrido/oficial:**
- Quando passar de 30 clientes ativos, ou
- Primeiro ban de numero de cliente, ou
- Exigencia de compliance por cliente (corretoras reguladas pela SUSEP podem exigir)

**Fontes:** [Whapi - Official vs Unofficial 2026](https://whapi.cloud/whatsapp-business-api-to-choose) | [Evolution API - Guia completo](https://gurusup.com/blog/evolution-api-whatsapp) | [Aibuildr - n8n WhatsApp Guide](https://aibuildr.tech/blog/how-to-use-whatsapp-business-api-free-n8n-guide/)

### Limitacoes

- Preco oficial Meta nao inclui BSP markup (se usar parceiro e nao acesso direto)
- O limite diario da Cloud API por numero varia com nivel de qualidade (nao publicado)
- Custos em BRL sao estimativa baseada em cotacao; billing BRL oficial so no 2H 2026
- Nao foi possivel verificar custo de infra Railway para 100+ instancias Evolution simultaneas

### O que precisa virar ADR

ADR novo supersedendo ADR-004 com a decisao de escala:
- Definir limiar de clientes para migracao (sugestao: 30)
- Definir se o opener outbound migra para template ou permanece na Evolution
- Definir o modelo de follow-up na Cloud API (utility template vs marketing)
- Definir processo de verificacao Meta Business para cada cliente no onboarding

---

## DECISAO 2 - Gateway de Pagamento (Brasil)

### Contexto

O CRM SaaS precisa cobrar assinatura recorrente de corretoras brasileiras (B2B).
Metodos esperados: PIX, boleto, cartao de credito. Necessidades criticas: recorrencia
nativa, gestao de inadimplencia (retry/dunning), suspensao automatica de conta,
emissao de nota fiscal de servico (NFS-e), API bem documentada.

### Resumo executivo

Asaas e a opcao com melhor custo-beneficio para SaaS B2B brasileiro com foco em
recorrencia via PIX e boleto. Tem o menor custo de PIX/boleto, nota fiscal nativa,
dunning automatizado, suspensao por assinatura, e API REST bem documentada com sandbox
estavel. Pagar.me e mais caro para PIX/boleto e mais voltado para e-commerce de cartao.
Iugu nao publica taxas de forma transparente e exige consulta comercial.

### Findings

#### Asaas

**Pros:**
- Menor custo de PIX e boleto entre os tres (R$1,99 fixo por transacao recebida)
- Nota fiscal (NFS-e) nativa e automatica por assinatura (R$0,49/nota emitida)
- Dunning nativo: regua de cobranca com WhatsApp, email, SMS, voz, Serasa
- Suspensao automatica configuravel por dias de inadimplencia
- API REST com sandbox completo e colecoes Postman/Insomnia
- Sem mensalidade (paga so por transacao recebida)
- Suporte a split/marketplace para modelo com repasse

**Contras:**
- API menos madura que Stripe (webhooks relatados com atraso em picos de alta carga)
- Foco em PME brasileira; menos recursos para internacional
- WhatsApp de cobranca cobrado a parte (R$0,55 por notificacao)

**Taxas Asaas (dados de julho 2026):**

| Metodo | Taxa |
|---|---|
| PIX | R$ 1,99 por transacao recebida |
| Boleto | R$ 1,99 por transacao recebida |
| Cartao credito a vista | R$ 0,49 + 2,99% |
| Cartao 2-6x | R$ 0,49 + 3,49% |
| Cartao 7-12x | R$ 0,49 + 3,99% |
| Nota fiscal (NFS-e) | R$ 0,49 por nota emitida |
| Serasa negativacao | R$ 9,90 por cobranca |
| WhatsApp notificacao | R$ 0,55 por mensagem enviada |

**Fontes:** [Asaas Precos e Taxas (oficial)](https://www.asaas.com/precos-e-taxas) | [Asaas - Nota Fiscal](https://blog.asaas.com/nota-fiscal-asaas/) | [Asaas - Dunning/Inadimplencia](https://blog.asaas.com/controle-de-inadimplencia/) | [Asaas API Docs](https://docs.asaas.com/)

---

#### Pagar.me

**Pros:**
- Boa reputacao no mercado brasileiro de e-commerce
- Recorrencia nativa (planos e assinaturas com cartao, boleto, PIX)
- Retry inteligente de pagamentos (dunning por cartao)
- Checkout transparente avancado
- Integracao com multiplos adquirentes

**Contras:**
- Custo de PIX (1,19%) e boleto (R$3,49) mais caros que Asaas
- Cartao credito a vista (4,39%) mais caro que Asaas (2,99%)
- Nota fiscal nao e nativa (precisa integracao externa)
- Mais voltado para volume de e-commerce, menos para SaaS B2B puro
- Sem mencao clara a suspensao automatica de conta inadimplente

**Taxas Pagar.me (dados de julho 2026):**

| Metodo | Taxa |
|---|---|
| PIX | 1,19% do valor |
| Boleto | R$ 3,49 por boleto pago |
| Cartao credito a vista | 4,39% |
| Parcelado 2-12x | 8,59% a 21,59% |
| Taxa por transacao | R$ 0,99 |

**Fontes:** [Pagar.me Ofertas](https://www.pagar.me/ofertas) | [Pagar.me Ajuda - Taxas](https://pagarme.helpjuice.com/pt_BR/p2-manual-dashboard/taxas-como-vejo-as-minhas-taxas) | [Pagar.me Docs Recorrencia](https://docs.pagar.me/docs/overview-recorr%C3%AAncia)

---

#### Iugu

**Pros:**
- Historico forte em recorrencia e assinaturas (produto mais maduro nesse vertical)
- PIX automatico nativo (debito automatico com autorizacao previa)
- Boleto recorrente nativo
- API bem documentada para desenvolvedores

**Contras:**
- Taxas nao publicadas abertamente: exige contato comercial para orcamento
- Custo variavel por volume e plano escolhido (3 tiers: Essencial, Essencial+Split, Motor)
- Referencias de mercado apontam boleto a R$2,50 e PIX a R$1,50 (nao confirmados na pagina oficial)
- Pagina de precos redireciona para consultores sem mostrar numeros publicos
- Menos adocao entre SaaS pequenos (mais voltado para empresas maiores)

**Taxas Iugu (estimativas de mercado, nao confirmadas oficialmente):**

| Metodo | Taxa estimada |
|---|---|
| PIX | R$ 1,50 por transacao (verificar) |
| Boleto | R$ 2,50 por transacao (verificar) |
| Cartao credito | ~4% (variavel por contrato) |

> Aviso: Iugu nao publica taxas oficialmente. Os valores acima sao referencias de terceiros
> e devem ser confirmados diretamente com a Iugu antes de qualquer decisao.

**Fontes:** [Iugu Planos](https://www.iugu.com/planos) | [Iugu Recorrencia](https://www.iugu.com/iugu-recorrencia) | [Iugu - Tarifa cartao](https://www.iugu.com/blog/entenda-a-tarifa-da-iugu) | [Iugu Dev Docs - Recorrencia](https://dev.iugu.com/docs/cobran%C3%A7a-recorrente-assinaturas)

---

### Comparacao

| Criterio | Asaas | Pagar.me | Iugu |
|---|---|---|---|
| PIX (por transacao) | R$ 1,99 fixo | 1,19% do valor | ~R$ 1,50 (verificar) |
| Boleto (por transacao) | R$ 1,99 fixo | R$ 3,49 | ~R$ 2,50 (verificar) |
| Cartao credito a vista | R$ 0,49 + 2,99% | 4,39% | ~4% (negociavel) |
| Recorrencia nativa | Sim | Sim | Sim |
| Dunning automatico | Sim (WhatsApp, email, Serasa) | Sim (retry cartao) | Parcial |
| Suspensao automatica | Sim (configuravel) | Nao documentado | Nao documentado |
| Nota fiscal nativa | Sim (R$0,49/nota) | Nao (integracao externa) | Verificar |
| API / sandbox | REST + sandbox completo | REST + sandbox | REST + sandbox |
| Transparencia de precos | Publica | Publica | Nao (consulta comercial) |
| Sem mensalidade | Sim | Sim | Nao (planos com mensalidade) |
| Foco principal | PME / SaaS BR | E-commerce / alto volume | Mid-market / enterprise |

**Exemplo de custo mensal para 50 clientes pagando R$500/mes via PIX:**
- Asaas: 50 x R$1,99 = R$99,50/mes em taxas
- Pagar.me: 50 x (R$500 x 1,19%) = 50 x R$5,95 = R$297,50/mes
- Iugu: 50 x ~R$1,50 = ~R$75/mes (nao confirmado)

> Para ticket medio de R$500, Asaas e 3x mais barato que Pagar.me em PIX.
> Para ticket medio de R$200, Pagar.me PIX (R$2,38) fica similar ao Asaas (R$1,99).

### O que os dados sugerem

Asaas e a escolha mais clara para o perfil deste SaaS:
- Publico B2B brasileiro (PIX e boleto dominam no B2B)
- Necessidade de nota fiscal automatica por assinatura (R$0,49 por nota - nativo)
- Suspensao automatica de inadimplente (critico para o modelo SaaS)
- Dunning via multiplos canais (Asaas tem o mais completo dos tres)
- Sem mensalidade de plataforma (paga so pelo que recebe)
- API estavel com sandbox para integrar

O Pagar.me seria preferivel se o foco fosse cartao de credito parcelado com alto volume,
o que nao e o caso de SaaS B2B com mensalidade fixa.

A Iugu tem historico solido em recorrencia mas a falta de transparencia de preco
e a estrutura de planos com mensalidade tornam a avaliacao inconclusiva sem cotacao direta.

### Limitacoes

- Taxas Iugu nao foram confirmadas na fonte oficial (pagina nao exibe valores)
- Pagar.me: taxas de parcelado sao altas; negociacao pode melhorar em volume
- Asaas: webhook reliability em alta carga nao foi testado para o volume deste SaaS
- Nenhum dos tres foi testado em integracao real neste projeto

### O que precisa virar ADR

- Definir gateway principal (recomendacao: Asaas)
- Definir se integra nota fiscal automaticamente desde o lancamento ou em fase posterior
- Definir regras de suspensao (ex: suspender apos X dias de inadimplencia)
- Definir se usa split para eventual modelo com revendedores
- Validar limite de municipios cobertos pelo Asaas para emissao de NFS-e

---

## Fontes consolidadas

**Canal WhatsApp:**
- [Blueticks - WhatsApp Pricing 2026](https://blueticks.co/blog/whatsapp-business-api-pricing-2026)
- [Whautomate - Brazil Pricing](https://whautomate.com/whatsapp-business-api-pricing-brazil)
- [Uptail - Pricing Guide](https://www.uptail.ai/blog/whatsapp-business-api-pricing-2026-what-it-costs-and-how-billing-works)
- [Meta Developers - Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [WASenderAPI - Ban Guide](https://wasenderapi.com/blog/how-to-use-evolution-api-without-getting-banned-on-whatsapp-2026-guide)
- [Wapisimo - Unofficial API Ban Risk](https://wapisimo.dev/blog/en/whatsapp-unofficial-api-ban-risk)
- [Whapi - Official vs Unofficial](https://whapi.cloud/whatsapp-business-api-to-choose)
- [Evolution API - Guia completo](https://gurusup.com/blog/evolution-api-whatsapp)
- [Zaple - Meta Business Verification](https://zaple.ai/blog/meta-business-verification-whatsapp/)
- [MessageCentral - WhatsApp API Brasil](https://www.messagecentral.com/blog/api-whatsapp-business-brasil)

**Gateway de Pagamento:**
- [Asaas Precos e Taxas (oficial)](https://www.asaas.com/precos-e-taxas)
- [Asaas - Nota Fiscal](https://blog.asaas.com/nota-fiscal-asaas/)
- [Asaas - Dunning/Inadimplencia](https://blog.asaas.com/controle-de-inadimplencia/)
- [Asaas API Docs](https://docs.asaas.com/)
- [Asaas - Cobranca Recorrente](https://blog.asaas.com/cobranca-recorrente-no-asaas/)
- [Pagar.me Ofertas](https://www.pagar.me/ofertas)
- [Pagar.me Docs Recorrencia](https://docs.pagar.me/docs/overview-recorr%C3%AAncia)
- [Iugu Planos](https://www.iugu.com/planos)
- [Iugu Recorrencia](https://www.iugu.com/iugu-recorrencia)
- [Iugu Dev Docs](https://dev.iugu.com/docs/cobran%C3%A7a-recorrente-assinaturas)
