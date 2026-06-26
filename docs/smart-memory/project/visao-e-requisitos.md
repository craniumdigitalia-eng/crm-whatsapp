---
title: "Visão & Requisitos — Portal Cranium"
type: project
status: living
updated: 2026-06-26
tags: [project, visao, requisitos, segundo-cerebro]
related: ["[[overview]]", "[[../shared-context]]", "[[../decisions/ADR-004-canal-whatsapp-qr-vs-make]]", "[[conventions]]"]
---

# Visão & Requisitos — Portal Cranium

> **Segundo cérebro do projeto.** Tudo que o usuário (Bruno, Cranium Digital) já definiu fica aqui pra não se repetir. Atualizar SEMPRE que surgir um requisito/preferência novo.

## Quem é a Cranium / o negócio
Agência de **marketing + tecnologia + IA**, foco em **planos de saúde** (corretores; operadoras: Amil, Bradesco, SulAmérica, Unimed, Omint, Porto Saúde, Prevent Senior, MedSênior). Tagline: *"Inteligência de quem vive o mercado"* / *"Marketing + Tecnologia + IA"*. Site: www.craniumdigital.com.br. Dono/admin: **Bruno de Castro** (`craniumdigital.ia@gmail.com`).

## Visão do produto
Era um **CRM de WhatsApp que substitui o SDR** → virou um **PORTAL interno multi-módulo** da equipe. A IA (Claude) faz o **primeiro atendimento**, qualifica e faz follow-up; a equipe acompanha tudo no portal.

## Módulos do portal (pedidos pelo usuário)
1. **CRM / Kanban** (funil de 7 estágios: Novo → Em atendimento → Qualificado → Proposta → Fechado / Perdido + Atend. humano) ✅
2. **Leads** (aba rica: busca/filtro/ordenação) — parcial
3. **Métricas & BI** — a fazer
4. **Agenda** (Google Calendar direto) — a fazer
5. **WhatsApp** (Evolution + QR) — a fazer
6. **Integrações** (aba dedicada: Google Calendar, Facebook Ads, WhatsApp) ✅
7. **Config**

## Requisitos explícitos do usuário (NÃO esquecer)
- **Layout bonito, com a marca Cranium** (roxo/violeta #7C3AED, off-white, Geist, pill, glow). KV completo em `docs/design/kv/`. ✅
- **Motion do site (cérebro/rede neural)** na tela inicial/login. ✅
- **Etiquetas (tags)** coloridas nos leads do kanban. ✅
- **Checklists** dentro do lead. ✅
- **Filtros do CRM** (busca + por etiqueta). ✅
- **Notas do lead = resumo da qualificação gerado pela IA** (serviço, objetivo, orçamento, status, próximo passo). ✅
- **Aba Integrações** dedicada (Google Calendar + Facebook Ads p/ importar lead com dados do formulário). ✅
- **Área no lead com as respostas do formulário do Meta** (Origem/Formulário). ✅
- **QA sempre no loop** (não soltar feature sem revisão independente). ✅ (reinstaurado)
- **Smart-memory como segundo cérebro** — guardar tudo, não repetir. (este doc)

## Como o lead entra (fluxo de aquisição) — DECIDIDO
O anúncio do usuário é **formulário instantâneo do Meta Ads (Instant Form)** — NÃO Click-to-WhatsApp. Fluxo **outbound-first**:
```
Lead preenche o formulário (Face/Insta)
 → MAKE (conector nativo Facebook Lead Ads) pega todos os campos
 → POST no nosso /api/leadgen (com os dados + senha)
 → CRM cria o lead organizado (nome, telefone, respostas, atribuição)
 → IA dispara a 1ª mensagem no WhatsApp (Evolution)
 → lead responde → IA qualifica → resumo nas notas
```
**Facebook via Make** (decisão do usuário): mais fácil, sem criar app de dev no Meta. (Ver [[../decisions/ADR-004-canal-whatsapp-qr-vs-make]] — ajustar pro fluxo Make.)

## Stack / infra (resumo — detalhe em [[../shared-context]])
Next.js 15 · Supabase · Vercel · Claude `claude-opus-4-8` · Evolution (WhatsApp) · Make (Facebook) · Google Calendar.

## Credenciais/contas (estado)
Supabase ✅ · Anthropic ✅ · login admin ✅ · WhatsApp/Evolution ⬜ (montar Railway) · Make ⬜ (cenário) · Vercel ⬜ (deploy). Senhas/segredos só no `.env` (gitignored).

## Preferências de trabalho do usuário
- Quer **velocidade** + **paralelismo** entre agentes, mas **com QA**.
- Gosta de **ver cada marco** (abre no navegador) e ser avisado quando "pronto".
- Delega decisões técnicas ao lead ("faça o melhor", "evita meu trabalho"), mas quer **entender os fluxos** (ensina como vai funcionar).
- Quer **mínimo esforço dele** nas integrações (nós hospedamos/configuramos; ele só conecta contas).
