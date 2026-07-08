---
title: Roadmap — Virar SaaS (vender em escala)
type: roadmap
status: active
created: 2026-07-08
updated: 2026-07-08
tags: [project, roadmap, saas, comercial, whatsapp, billing]
related: ["[[../shared-context]]", "[[modules]]", "[[../decisions/ADR-004-canal-whatsapp-qr-vs-make]]", "[[../decisions/ADR-005-ia-openai-vs-anthropic]]", "[[../changelog/2026-07-03-sessao-features]]"]
---

# Roadmap — Virar SaaS (vender pra todo Brasil)

Objetivo: sair de "ferramenta que a gente instala pra cada cliente" para "SaaS que se
vende (idealmente sozinho) pra corretoras/agências em escala". Esforço: **P** (pequeno),
**M** (médio), **G** (grande).

## Onde estamos (base atual — jul/2026)
- Produto completo e no ar: CRM/kanban, IA no WhatsApp (SPIN, provas, agendamento), Conversas, Grupos, Demandas, Financeiro, Metas, Email marketing, BI, Agenda, Mobile/PWA, tema escuro.
- **Multi-tenant por deploy**: 1 código, 1 Supabase + 1 Vercel por cliente. Kit em `provisioning/` (schema consolidado + `setup.ts` + `update-all.ts`). Ver [[modules]].
- Infra: Vercel **Hobby**, Supabase, Evolution (Railway), OpenAI (gpt-4o-mini).

## 🧩 Forma do produto SaaS (confirmado pelo usuário em 2026-07-08)
Decisões de produto que guiam o Epic 6 em diante:
1. **Duas coisas separadas, nunca misturar:**
   - **CRM da Cranium** (login/senha do dono, instância atual) = ferramenta interna que a Cranium usa pra atender e vender pros corretores. **NÃO é um tenant do SaaS. Fica intocado.**
   - **SaaS** = produto que o corretor compra e usa pra atender os leads dele. Instância à parte por cliente.
2. **Bring your own (cada corretor pluga o que é dele):**
   - **Chave OpenAI** do próprio corretor (SOMENTE OpenAI, sem opção de Claude). O agente segue OpenAI (ADR-005); a chave passa a ser por tenant.
   - **Meta Lead Ads** dele.
   - **Google Calendar** dele.
   - **Evolution API** dele.
3. **Plano único: R$997/mês** (sem tiers Starter/Pro). Ajusta a 6.1 e a 9.1.
4. **Pré-configurado com protocolo de atendimento para leads de plano de saúde** por padrão, em todo tenant novo.
5. **Onboarding/wizard (6.2 + 9.3) é o coração:** o corretor entra e conecta as 4 integrações + põe a chave OpenAI, sozinho.
6. **Control-plane = schema separado no Supabase atual** (não projeto novo). Ajusta o ADR-008.

## ⚖️ Decisões pendentes (travam o resto — decidir PRIMEIRO)
1. **Canal WhatsApp em escala** (o mais importante):
   - **Evolution (não-oficial)**: barato, opener livre, mas viola os termos do WhatsApp → risco de **ban** dos números com automação/follow-up em massa. Aceitável em poucos clientes; arriscado em centenas.
   - **WhatsApp Cloud API (oficial, Meta)**: seguro/estável, mas cobra por conversa, exige verificação de empresa e **template aprovado** pra mensagem de abertura. Muda a arquitetura do canal.
   - Supersede parcialmente [[../decisions/ADR-004-canal-whatsapp-qr-vs-make]]. **Precisa virar um ADR novo.**
2. **Gateway de pagamento (Brasil)**: Asaas × Pagar.me × Iugu (Pix/boleto/cartão + assinatura recorrente + inadimplência).
3. **Modelo de tenancy no longo prazo**: manter "deploy por cliente" (simples, até dezenas) ou migrar pra **banco compartilhado + `org_id` + RLS** (a partir de centenas). Ver Fase 5.

---

## Fase 1 — Fundação comercial (🔴 sem isso não vende em escala)
- **Cobrança/assinatura** (G): integrar gateway BR; planos, teste grátis, faturas, **suspender inadimplente** automaticamente. Emissão de **nota fiscal**.
- **Onboarding self-service** (G): site → cadastro → pagamento → **conta provisionada sozinha** → cliente conecta o WhatsApp dele. Hoje é manual (kit). É o que destrava o "sem você no meio de cada venda".
- **Painel super-admin** (M): visão de TODOS os clientes (ativo/uso/inadimplência/suspender). Hoje não existe visão entre clientes.
- **Landing + pricing** (M): site de venda, planos, demo/trial.

## Fase 2 — Confiabilidade & escala (🟡 pra rodar sério)
- **Sair do Vercel Hobby → Pro** (P): libera cron sub-diário (hoje o alerta depende de UptimeRobot externo, ver [[../changelog/2026-07-03-sessao-features]]) e tira limites.
- **WhatsApp em escala** (G, depende da decisão 1): provisionar/monitorar 1 instância por cliente, auto-reconexão (Railway derruba a sessão), alerta de queda por cliente.
- **Observabilidade** (M): Sentry (erros), status page, uptime, **backups** por cliente.
- **Idempotência/rate-limit** revisados por tenant.

## Fase 3 — Jurídico & compliance (🟡 obrigatório no Brasil)
- **LGPD** (M): política de privacidade, termos de uso, DPA, consentimento, direito de exclusão de dados. Lidamos com dados pessoais de leads.
- **Contratos/SLA** (P) e **CNPJ + nota fiscal** da mensalidade.
- **Termos do WhatsApp**: alinhar com a decisão do canal (risco de ban se não-oficial).

## Fase 4 — Produto self-serve (🟡 reduz suporte)
- **Limites por plano** (M): ex. X leads/mês, Y mensagens; travar/avisar ao estourar.
- **Convite de usuários** por cliente (P): já há papéis admin/atendente; falta o fluxo de convite multi-usuário.
- **Wizard de setup dentro do app** (M): conectar WhatsApp, configurar agente, importar leads sem depender de você.
- **Central de ajuda / suporte** (M): docs pro cliente final + canal de suporte.

## Fase 5 — Escala futura (🟢 problema bom)
- Quando passar de **dezenas → centenas** de clientes: reforma **multi-tenant de banco compartilhado** (`org_id` em todas as tabelas + RLS + config por org). Gerenciar N Supabase/Vercel cansa nesse volume. **Só quando o volume justificar.**

---

## Ordem sugerida
1. **Decidir o WhatsApp** (decisão 1) — muda a arquitetura, então vem antes de tudo.
2. **Fase 1** (cobrança + onboarding + super-admin) — é o que transforma em "vendável".
3. **Fase 2 e 3** em paralelo (infra + jurídico).
4. **Fase 4** conforme os primeiros clientes pagantes trazem feedback.
5. **Fase 5** só quando o volume pedir.

## Riscos principais
- **Ban de WhatsApp** (se ficar no não-oficial em escala) — o maior risco do negócio.
- **Custo de infra** cresce linear no modelo "deploy por cliente" (N Supabase + N Vercel).
- **Suporte**: sem central de ajuda + self-service, cada cliente vira um chamado pra você.
