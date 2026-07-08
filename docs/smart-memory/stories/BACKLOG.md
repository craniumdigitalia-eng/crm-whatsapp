---
title: Story Backlog
type: backlog
updated: 2026-06-25
tags: [story, backlog, migracao, waves]
related: ["[[../project/architecture]]", "[[../project/modules]]", "[[../agents/data-engineer/schema]]"]
---

# Backlog de Stories — Migração Protótipo → Produção

Plano de migração (Express + SQLite → Supabase + Vercel + Make) organizado por **waves de dependência**.
Cada wave depende da anterior. Stories com `god-node: true` tocam arquivos centrais
(`types.ts`, `db.ts`, `crm/leads.ts`, `handler.ts`, `config.ts`) — exigem cuidado redobrado (modo `pre-flight`).

Fontes: [[../project/architecture]] (6 riscos serverless) · [[../project/modules]] (god nodes) · [[../agents/data-engineer/schema]] (gaps).

## Wave 0 — Hardening / pré-requisitos
> Base independente. Resolve riscos antes de migrar a infra. Toca god nodes.

| Story | Título | Complexidade | God node | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/1.1-idempotencia-external-id\|1.1]] | Idempotência de mensagens por `external_id` | M | sim | backlog | — |
| [[backlog/1.2-lead-id-uuid\|1.2]] | Migrar `Lead.id`/`Message.id` para `string` (UUID) | M | sim | backlog | — |
| [[backlog/1.3-followup-update-atomico\|1.3]] | Update atômico no motor de follow-up | M | sim | backlog | — |

## Wave 1 — Persistência Supabase
> Depende da Wave 0. Provisiona e migra a camada de dados.

| Story | Título | Complexidade | God node | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/2.1-supabase-projeto-schema\|2.1]] | Criar projeto Supabase e aplicar schema | S | não | backlog | — |
| [[backlog/2.2-rewrite-persistencia-supabase\|2.2]] | Reescrever `db.ts` + `crm/leads.ts` para Supabase | L | sim | backlog | — |

## Wave 2 — Serverless Vercel
> Depende da Wave 1. Rotas Express → funções `/api`; canal Make; cron.

| Story | Título | Complexidade | God node | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/3.1-adapter-canal-make\|3.1]] | Adapter de canal — Evolution → Make | M | sim | backlog | — |
| [[backlog/3.2-scaffold-serverless-vercel\|3.2]] | Scaffold serverless — rotas → funções `/api` | L | não | backlog | — |
| [[backlog/3.3-api-webhook-idempotente\|3.3]] | `/api/webhook` idempotente (Make → agente → resposta) | L | sim | backlog | — |
| [[backlog/3.4-api-cron-followup\|3.4]] | `/api/cron/followup` + Vercel Cron (`CRON_SECRET`) | M | não | backlog | — |

## Wave 3 — Dashboard + Observabilidade
> Depende da Wave 2. Front em produção, segurança e operação.

| Story | Título | Complexidade | God node | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/4.1-dashboard-vercel\|4.1]] | Dashboard na Vercel | M | não | backlog | — |
| [[backlog/4.2-auth-supabase-rls\|4.2]] | Autenticação do dashboard + RLS | L | não | backlog | — |
| [[backlog/4.3-distinguir-ia-vs-humano\|4.3]] | Distinguir mensagem de IA vs humano | M | sim | backlog | — |
| [[backlog/4.4-a11y-drawer\|4.4]] | Acessibilidade do drawer de conversa | S | não | backlog | — |
| [[backlog/4.5-observabilidade-rate-limiting\|4.5]] | Observabilidade e rate limiting | L | não | backlog | — |

## Grafo de dependências (waves)

```mermaid
flowchart LR
    subgraph W0[Wave 0 — Hardening]
        S11[1.1 external_id]
        S12[1.2 UUID]
        S13[1.3 claim atômico]
    end
    subgraph W1[Wave 1 — Supabase]
        S21[2.1 schema]
        S22[2.2 rewrite repo]
    end
    subgraph W2[Wave 2 — Serverless]
        S31[3.1 canal Make]
        S32[3.2 scaffold]
        S33[3.3 webhook]
        S34[3.4 cron]
    end
    subgraph W3[Wave 3 — Dashboard/Obs]
        S41[4.1 dashboard]
        S42[4.2 auth+RLS]
        S43[4.3 IA vs humano]
        S44[4.4 a11y]
        S45[4.5 observabilidade]
    end

    S11 --> S21
    S12 --> S21
    S12 --> S22
    S13 --> S22
    S21 --> S22
    S22 --> S31
    S22 --> S32
    S31 --> S33
    S32 --> S33
    S11 --> S33
    S31 --> S34
    S32 --> S34
    S13 --> S34
    S32 --> S41
    S41 --> S42
    S41 --> S43
    S41 --> S44
    S33 --> S45
    S34 --> S45
```

## Resumo (Epics 1–4 — migração)
- **14 stories** em 4 waves: Wave 0 (3) · Wave 1 (2) · Wave 2 (4) · Wave 3 (5).
- **7 god-node stories** (modo `pre-flight`): 1.1, 1.2, 1.3, 2.2, 3.1, 3.3, 4.3.
- Complexidade: S(2) · M(7) · L(5) · XL(0).

---

# Epic 5 — Portal interno multi-módulo

Nova direção (usuário, 2026-06-25): CRM → **portal da equipe interna** da Cranium. O backend (Supabase + serverless + agente IA + WhatsApp) vira **fundação**; o CRM vira módulo. Decisões **accepted**: [[../decisions/ADR-003-portal-nextjs]] (front → Next.js App Router) e [[../decisions/ADR-004-canal-whatsapp-qr-vs-make]] (**DECISÃO FINAL: canal = Evolution auto-hospedada; Make dropado de tudo; agendamento via Google Calendar direto; aquisição via Meta Lead Ads (formulário instantâneo) outbound-first**). Princípio: minimizar o esforço do **usuário** (escaneia 1 QR + conecta Google + cria anúncio com formulário; nós hospedamos/mantemos).

## Wave P0 — Fundação do Portal
> Shell + auth + branding. Base de todos os módulos.

| Story | Título | Complexidade | God node | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/5.1-portal-nextjs-shell\|5.1]] | Shell do portal em Next.js App Router | XL | não | backlog | — |
| [[backlog/5.2-auth-rbac-interno\|5.2]] | Auth interno + RBAC (Supabase Auth SSR + RLS por papel) | L | não | backlog | — |
| [[5.3-design-system-branded\|5.3]] | Design system branded (KV) | L | não | active | — |

## Wave P1 — Migrar CRM para o portal
> Depende da P0. Porta o que já existe.

| Story | Título | Complexidade | God node | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/5.4-modulo-crm-kanban\|5.4]] | Módulo CRM/kanban no portal | M | não | backlog | — |
| [[backlog/5.5-aba-leads-rica\|5.5]] | Aba rica de visualização de leads | L | não | backlog | — |

## Wave P2 — Módulos novos
> Depende da P0 (e P1 p/ contexto de leads). Módulos podem ir em paralelo entre si.

| Story | Título | Complexidade | God node | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/5.6-modulo-metricas-bi\|5.6]] | Métricas & BI | L | não | backlog | — |
| [[backlog/5.7-modulo-agendamento\|5.7]] | Agendamento de reuniões (Google Calendar direto) | L | sim | backlog | — |
| [[backlog/5.8-evolution-self-hosted\|5.8]] | Provisionar Evolution auto-hospedada + re-rota do canal | L | sim | backlog | — |
| [[backlog/5.9-whatsapp-connect-qr\|5.9]] | Conectar WhatsApp via QR no portal | M | não | backlog | — |
| [[backlog/5.10-meta-lead-ads\|5.10]] | Integração Meta Lead Ads (form instantâneo) + opener outbound | L | sim | backlog | — |
| [[backlog/5.11-guia-setup-evolution-leadads\|5.11]] | Guia de setup (Evolution + Meta Lead Ads + Google Calendar) (doc) | S | não | backlog | — |

> **Decisão final ADR-004 (Evolution, Make dropado):** a 3.1 (adapter→Make) sai do caminho; a borda do canal volta a Vercel↔Evolution direto (encapsulado em 5.8 + ajuste do `/api/webhook`). Make removido também do agendamento (5.7 usa Google Calendar direto).

## Grafo de dependências (Epic 5)

```mermaid
flowchart LR
    ADR3[ADR-003 Next.js] --> P51[5.1 shell]
    ADR4[ADR-004 Evolution] --> P58[5.8 Evolution host]
    KV[(KV do usuário)] --> P53[5.3 design system]
    P51 --> P52[5.2 auth+RBAC]
    P51 --> P53
    P51 --> P54[5.4 CRM module]
    P53 --> P54
    P52 --> P54
    P53 --> P55[5.5 leads-view]
    P54 --> P55
    P53 --> P56[5.6 BI]
    P45[4.5 tokens/custo] --> P56
    P510[5.10 Meta Lead Ads + opener] --> P56
    P53 --> P57[5.7 agendamento - Google Cal]
    P33[3.3 webhook] --> P58
    P58 --> P59[5.9 QR connect]
    P52 --> P59
    P58 --> P510
    P58 --> P511[5.11 guia setup]
    P59 --> P511
    P57 --> P511
    P510 --> P511
```

## Re-escopo de stories da Wave 3 (efeito do Epic 5)
> O portal absorve/reescopa stories do epic 4 — evitar trabalho duplicado:

| Story 4.x | Destino |
|---|---|
| 4.1 dashboard estático na Vercel | **Superseded** por 5.1 (shell Next.js) |
| 4.2 auth + RLS | **Absorvida** por 5.2 (auth+RBAC do portal) |
| 4.3 distinguir IA vs humano | **Mantida** — concern de dados; alimenta 5.4/5.5 |
| 4.4 a11y do drawer | **Absorvida** por 5.3/5.4 |
| 4.5 observabilidade + tokens/custo | **Mantida** — pré-requisito do BI (5.6) |
| 4.6 redesign visual dashboard | **Absorvida** por 5.3 (design system) |

## Resumo (Epic 5 — portal)
- **11 stories** em 3 waves: P0 (3) · P1 (2) · P2 (6).
- **3 god-node stories** (`pre-flight`): 5.7 (gatilho de qualificação), 5.8 (borda de canal/webhook), 5.10 (Lead Ads: cria lead + opener outbound; toca tipos/intake/envio). 5.1/5.2 também em `pre-flight` por raio de impacto (não-god-node).
- Complexidade: S(1) · M(2) · L(7) · XL(1).
- **ADRs accepted:** 003 (Next.js) e 004 (**FINAL: Evolution auto-hospedada; Make dropado de tudo; Google Calendar direto no agendamento; aquisição via Meta Lead Ads / formulário instantâneo, outbound-first**).
- **Bloqueios:** 5.3 bloqueada pelo KV do usuário; P2 depende de P0; 5.8 re-rota o `/api/webhook` (3.3 entregue) para payload da Evolution; 5.9/5.10/5.11 dependem de 5.8.

## Follow-ups / Tech-debt (de QA)
> Itens não-bloqueantes levantados em review. Endereçar em hardening futuro.

- **[TEST] Regressão de idempotência (de 1.1, god-node):** repo não tem suíte nem script `test`. AC4 fechado por verificação manual do QA. Criar teste automatizado (2x payload → 1 linha em `messages` + 1 envio). Idealmente junto de uma story maior de *testing strategy* (a definir) — relevante para qualidade de produção. **→ absorvido pela story [[backlog/7.4-idempotencia-rate-limit-tenant\|7.4]] (AC5).**
- **[NIT] `src/db.ts` catch amplo na migração ALTER:** `catch {}` engole qualquer erro, não só "duplicate column". Tornar específico. Baixa severidade — pode ser absorvido na 1.2/2.2 enquanto se mexe em db.ts.

---

# Epics 6–10 — Virar SaaS (vender em escala)

> Deriva de [[../project/roadmap-saas]] (Fases 1 a 5). O produto já está **completo e no ar**; estes épicos são o que falta para **vender em escala** (cobrança, onboarding self-service, confiabilidade, jurídico, self-serve, e a reforma de tenancy futura). Numeração: 1 épico por fase do roadmap.
>
> ✅ **DECISÃO 1 (canal WhatsApp em escala)** resolvida em [[../decisions/ADR-006-canal-whatsapp-em-escala]] (manter Evolution no curto prazo, com gatilho de migração para Cloud API). Destravou 7.2, 8.3 (total) e o passo WhatsApp de 6.2 e 9.3 (parcial). **DECISÃO 2 (gateway BR)** resolvida em [[../decisions/ADR-007-gateway-pagamento-br]] (Asaas), destravando a integração de [[backlog/6.1-cobranca-assinatura\|6.1]]. O **plano de controle central** (onde vivem assinaturas/super-admin) está em [[../decisions/ADR-008-plano-de-controle-central]]. **DECISÃO 3** (tenancy longo prazo) segue sendo a própria [[backlog/10.1-multi-tenant-db-compartilhado\|10.1]].

## Epic 6 — Fundação comercial SaaS (Fase 1 🔴)
> Sem isso não vende em escala. O que transforma em "vendável".

| Story | Título | Size | Prioridade | Bloqueio | Depende de | Status |
|---|---|---|---|---|---|---|
| [[backlog/6.1-cobranca-assinatura\|6.1]] | Cobrança e assinatura recorrente (gateway BR) | G | P0 | ✅ ADR-007 (Asaas) | — | backlog |
| [[backlog/6.2-onboarding-self-service\|6.2]] | Onboarding self-service | G | P0 | ✅ passo WhatsApp por ADR-006 | 6.1 | backlog |
| [[backlog/6.3-painel-super-admin\|6.3]] | Painel super-admin (visão cross-cliente) | M | P0 | — (ADR-008 control-plane) | 6.1 | backlog |
| [[backlog/6.4-landing-pricing\|6.4]] | Landing + pricing + demo/trial | M | P1 | — | 6.1, 6.2 (integra), 5.3 | backlog |

## Epic 7 — Confiabilidade & escala (Fase 2 🟡)
> Pra rodar sério em produção.

| Story | Título | Size | Prioridade | Bloqueio | Depende de | Status |
|---|---|---|---|---|---|---|
| [[backlog/7.1-vercel-pro\|7.1]] | Migrar Vercel Hobby → Pro | P | P1 | — | — | backlog |
| [[backlog/7.2-whatsapp-em-escala\|7.2]] | WhatsApp em escala (1 instância/cliente) | G | P0 | ✅ ADR-006 (Evolution) | — | backlog |
| [[backlog/7.3-observabilidade\|7.3]] | Observabilidade (Sentry, uptime, backups) | M | P1 | — | 7.1 (facilita) | backlog |
| [[backlog/7.4-idempotencia-rate-limit-tenant\|7.4]] | Idempotência + rate-limit por tenant | M | P1 | — | — | backlog |

## Epic 8 — Jurídico & compliance (Fase 3 🟡)
> Obrigatório no Brasil.

| Story | Título | Size | Prioridade | Bloqueio | Depende de | Status |
|---|---|---|---|---|---|---|
| [[backlog/8.1-lgpd\|8.1]] | LGPD (privacidade, termos, DPA, exclusão) | M | P0 | — | 7.3 (scrubbing) | backlog |
| [[backlog/8.2-contratos-sla-cnpj-nf\|8.2]] | Contratos/SLA + CNPJ + nota fiscal | P | P1 | — | 6.1 (fatura paga) | backlog |
| [[backlog/8.3-termos-whatsapp\|8.3]] | Alinhar compliance com termos do WhatsApp | P | P0 | ✅ ADR-006 (Evolution) | 8.1 | backlog |

## Epic 9 — Produto self-serve (Fase 4 🟡)
> Reduz suporte conforme entram clientes pagantes.

| Story | Título | Size | Prioridade | Bloqueio | Depende de | Status |
|---|---|---|---|---|---|---|
| [[backlog/9.1-limites-por-plano\|9.1]] | Limites por plano (cotas) | M | P1 | — | 6.1 | backlog |
| [[backlog/9.2-convite-usuarios\|9.2]] | Convite de usuários por cliente | P | P2 | — | 5.2, 9.1 | backlog |
| [[backlog/9.3-wizard-setup-in-app\|9.3]] | Wizard de setup dentro do app | M | P1 | ✅ passo WhatsApp por ADR-006 | 6.2 | backlog |
| [[backlog/9.4-central-de-ajuda\|9.4]] | Central de ajuda / suporte | M | P2 | — | 5.11 (base) | backlog |

## Epic 10 — Escala futura / multi-tenant DB (Fase 5 🟢)
> Problema bom. Só quando o volume justificar (centenas de clientes).

| Story | Título | Size | Prioridade | Bloqueio | Depende de | Status |
|---|---|---|---|---|---|---|
| [[backlog/10.1-multi-tenant-db-compartilhado\|10.1]] | Multi-tenant banco compartilhado (org_id + RLS) | G | P3 | gatilho de volume + ADR tenancy | — | backlog |

## Ordem de execução (waves SaaS)

Respeita a "Ordem sugerida" do roadmap: decidir o canal antes de tudo, Fase 1 primeiro (é o que vende), Fases 2 e 3 em paralelo, Fase 4 conforme feedback, Fase 5 só com volume.

```mermaid
flowchart TB
    subgraph DEC["Decisões resolvidas (ADRs 006/007/008)"]
        D1[✅ ADR-006 canal WhatsApp escala]
        D2[✅ ADR-007 gateway pagamento BR]
    end
    subgraph SW1["Wave S1 — Fundação comercial (Epic 6)"]
        S61[6.1 cobrança*]
        S62[6.2 onboarding**]
        S63[6.3 super-admin]
        S64[6.4 landing/pricing]
    end
    subgraph SW2["Wave S2 — Confiabilidade (Epic 7)"]
        S71[7.1 Vercel Pro]
        S72[7.2 WhatsApp escala**]
        S73[7.3 observabilidade]
        S74[7.4 idempotência/rate-limit]
    end
    subgraph SW3["Wave S3 — Jurídico (Epic 8)"]
        S81[8.1 LGPD]
        S82[8.2 contratos/NF]
        S83[8.3 termos WhatsApp**]
    end
    subgraph SW4["Wave S4 — Self-serve (Epic 9)"]
        S91[9.1 limites plano]
        S92[9.2 convite usuários]
        S93[9.3 wizard setup**]
        S94[9.4 central ajuda]
    end
    subgraph SW5["Wave S5 — Escala futura (Epic 10)"]
        S101[10.1 multi-tenant DB]
    end

    D2 ==>|resolve integração| S61
    D1 ==>|resolve canal| S72
    D1 ==>|resolve passo WA| S62
    D1 ==>|resolve passo WA| S93
    D1 ==>|resolve compliance| S83
    S61 --> S62
    S61 --> S63
    S61 --> S64
    S62 --> S64
    S61 --> S82
    S61 --> S91
    S71 --> S73
    S73 --> S81
    S91 --> S92
    S62 --> S93
    S81 --> S83
    SW1 --> SW4
    SW2 --> SW5
    S62 -.gatilho de volume.-> S101

    S61:::star
    classDef star fill:#f3e8ff,stroke:#7c3aed;
```

`*` integração desbloqueada por [[../decisions/ADR-007-gateway-pagamento-br]] (Asaas). `**` canal desbloqueado por [[../decisions/ADR-006-canal-whatsapp-em-escala]] (Evolution no curto prazo).

**Sequência recomendada:**
1. **Decisões resolvidas** - ADR-006 (canal), ADR-007 (gateway) e ADR-008 (control-plane) já saíram. 6.1(integração), 6.2, 7.2, 8.3 e 9.3 estão liberadas.
2. **Wave S1 (Epic 6)** - cobrança + onboarding + super-admin + landing. É o que vira "vendável". Com os ADRs prontos, a integração Asaas (6.1) e o passo WhatsApp (6.2) podem avançar; billing e super-admin vivem no control-plane (ADR-008).
3. **Wave S2 e S3 em paralelo** - infra (Epic 7: 7.1/7.3/7.4 livres; 7.2 liberada por ADR-006) + jurídico (Epic 8: 8.1/8.2 livres; 8.3 liberada por ADR-006).
4. **Wave S4 (Epic 9)** - self-serve, conforme os primeiros pagantes trazem feedback (9.1/9.2/9.4 livres; 9.3 com o passo WhatsApp já liberado).
5. **Wave S5 (Epic 10)** - só quando o volume pedir; o onboarding automático (6.2) pode ser o sinal.

## Resumo (Epics 6-10 - SaaS)
- **16 stories** em 5 waves: S1 (4) · S2 (4) · S3 (3) · S4 (4) · S5 (1).
- **Canal WhatsApp resolvido** ([[../decisions/ADR-006-canal-whatsapp-em-escala]]): 7.2 e 8.3 (total) e o passo WhatsApp de 6.2 e 9.3 (parcial) liberados. **Gateway resolvido** ([[../decisions/ADR-007-gateway-pagamento-br]] - Asaas): integração de 6.1 liberada. **Control-plane** definido ([[../decisions/ADR-008-plano-de-controle-central]]) para billing/super-admin.
- **God-node stories** (`pre-flight`): 7.2, 7.4, 10.1 (+ 6.1/6.2/6.3/8.1/9.1 em pre-flight por raio de impacto/arquitetura).
- Size (do roadmap): P(3) · M(6) · G(6) + 10.1(G/XL). Complexidade: S(2) · M(5) · L(5) · XL(4).
- **ADRs produzidos:** [[../decisions/ADR-006-canal-whatsapp-em-escala]] (canal em escala, supersede parcial do ADR-004), [[../decisions/ADR-007-gateway-pagamento-br]] (gateway BR = Asaas), [[../decisions/ADR-008-plano-de-controle-central]] (plano de controle central, junto de 6.1/6.3). Falta o ADR de **tenancy** (DECISÃO 3, junto de 10.1) para quando o volume pedir.
