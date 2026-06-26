---
title: "Setup & Infraestrutura — onde tudo está"
type: ops
status: living
updated: 2026-06-26
tags: [ops, infra, integracoes, segundo-cerebro]
related: ["[[../project/visao-e-requisitos]]", "[[../shared-context]]"]
---

# Setup & Infraestrutura

> Mapa de TUDO que está montado + onde cada segredo vive. **Nenhum segredo é gravado aqui** (repo é público) — só os locais. Atualizar a cada nova integração.

## Plataformas conectadas
| Serviço | O quê | Onde / identificador | Segredo vive em |
|---|---|---|---|
| **Supabase** | Banco Postgres (leads, mensagens, profiles, tags, checklists, integrations_config) | projeto `iiahpfvhrfuznszytbod` · `https://iiahpfvhrfuznszytbod.supabase.co` | `.env` (service_role, anon) + senha do banco · Dashboard Supabase |
| **Anthropic** | IA (Claude `claude-opus-4-8`) — atendimento/qualificação | console.anthropic.com | `.env` (ANTHROPIC_API_KEY) · console Anthropic |
| **Railway** | Hospeda a **Evolution API** (WhatsApp) — plano Hobby (~US$5/mês) | serviço "Evolution API" + Postgres + Redis · `https://evolution-api-production-d9f4.up.railway.app` (v2.3.7) | painel Railway → Variables (AUTHENTICATION_API_KEY) |
| **Evolution** | Canal WhatsApp (envio/recebimento + QR) | instância **`cranium-crm`** (número Cranium/Pâmella 5521995197818) | `.env` (EVOLUTION_*) |
| **Meta/Facebook** | Lead Ads (formulário) **via Make** (a configurar) | Business Manager do usuário | — (Make) |
| **Make** | Ponte Facebook Lead Ads → `/api/leadgen` (a configurar) | conta Make do usuário | — |
| **Google Calendar** | Agenda (a configurar) | — | — |
| **GitHub** | Versionamento/backup do código | github.com/craniumdigitalia-eng/crm-whatsapp · branch `feat/portal-epic-5` | — (sem segredos) |
| **Vercel** | Hospeda o PORTAL (produção) | projeto **`crm-cranium`** (time craniumdigitalia-engs-projects) · **https://crm-cranium.vercel.app** | env vars no painel Vercel (Production) |

> ⚠️ NÃO confundir: o projeto certo é **`crm-cranium`** (https://crm-cranium.vercel.app). Existe um `cranium-crm` ANTIGO (30 dias) no Vercel que NÃO é este — ignorar/deletar se o usuário confirmar.

## 🌐 Produção (Vercel) — estado
- **URL:** https://crm-cranium.vercel.app · login admin: `craniumdigital.ia@gmail.com`.
- **Env vars** configuradas no Vercel (Production): Supabase*, Anthropic, Evolution*, EMAIL_TRACK_SECRET, CRON_SECRET, APP_URL, NEXT_PUBLIC_*. Falta (quando for ligar): META_MAKE_SECRET, GOOGLE_CLIENT_ID/SECRET, EMAIL_PROVIDER/EMAIL_API_KEY/EMAIL_FROM.
- **Webhook Evolution** já apontado p/ `https://crm-cranium.vercel.app/api/webhook?token=...` (evento MESSAGES_UPSERT).
- **Cron** Vercel: `0 12 * * *` (diário — limite do plano Hobby; Pro libera de hora em hora).
- **Funções movidas** p/ route handlers Next (`app/api/webhook|cron/followup|health`) — a pasta raiz `api/` foi removida (não deployável em projeto Next).
- **Falta ativar:** reconectar WhatsApp (QR em /whatsapp) · cenário Make (Facebook) · OAuth Google · provedor de email.

## Variáveis de ambiente (no `.env` local — gitignored)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `AGENT_MODEL`, `EVOLUTION_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE=cranium-crm`, `EVOLUTION_WEBHOOK_TOKEN`, `COMPANY_NAME`, `FOLLOWUP_*`. (Meta/Google a adicionar.)

## Migrations aplicadas no Supabase
001 (schema base) · 002 (tags/checklists) · 003 (atribuição de lead / integrations_config) · 004 (profiles+role) · 006 (trava de role). [005 RLS de negócio = opcional, não aplicada].

## Acesso ao portal
- Login: **`craniumdigital.ia@gmail.com`** (admin) — senha temporária `CraniumAdmin@2026` (trocar).

## Estado das integrações
- ✅ **Banco + IA + Login** ligados e validados.
- ✅ **Evolution no ar** (Railway); instância `cranium-crm` existe, status **desconectado** → reconectar via QR (`/whatsapp`).
- ⏳ **Inbound real depende de DEPLOY na Vercel** (a Evolution precisa de URL pública pra mandar o webhook de volta — `localhost` não recebe).
- ⏳ **Facebook (Make)** + **Google Calendar**: a configurar.

## 🔧 Manutenção do Railway (Evolution) — quase zero
- **Automático:** ligado 24/7, reinicia sozinho, dados persistem (volume).
- **Atenção 1 — cobrança:** Hobby ~US$5/mês + uso. Manter cartão válido; se estourar crédito, pausa (religar = upgrade/resume).
- **Atenção 2 — conexão WhatsApp:** pode cair (logout do aparelho, inatividade) → **reescanear o QR** em `/whatsapp` (10s). Dados NÃO se perdem (ficam no Supabase). O portal mostra o status da conexão (rede de segurança).

## ⚠️ Recuperação de segredos (não perder)
Os segredos NÃO estão no GitHub (proposital). Fontes de recuperação: `.env` local + os painéis (Railway, Supabase, Anthropic console). **Recomendado:** guardar as chaves também num gerenciador de senhas (1Password/Bitwarden).
