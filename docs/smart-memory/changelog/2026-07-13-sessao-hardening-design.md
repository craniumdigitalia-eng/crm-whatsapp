---
title: "Sessao 8-13/jul — Hardening, produto SaaS, dominio, email, grupos e design do portal"
type: changelog
created: 2026-07-13
tags: [changelog, seguranca, rls, rate-limit, saas, dominio, email, smtp, grupos, design, login]
related: ["[[../shared-context]]", "[[../project/roadmap-saas]]", "[[../agents/qa/auditoria-robustez-2026-07-09]]", "[[../decisions/ADR-006-canal-whatsapp-em-escala]]", "[[../decisions/ADR-007-gateway-pagamento-br]]", "[[../decisions/ADR-008-plano-de-controle-central]]", "[[../decisions/ADR-009-byok-openai-por-tenant]]"]
---

# Sessao 8-13/jul/2026 — Hardening + SaaS + dominio + email + grupos + design

Leva grande. Resumo do que foi construido, decidido e aplicado.

## 1. Planejamento SaaS (squad team-os)
- **ADRs novos:** [[../decisions/ADR-006-canal-whatsapp-em-escala]] (manter Evolution; gatilho de migracao p/ Cloud API = 30 clientes ativos OU 1o ban), [[../decisions/ADR-007-gateway-pagamento-br]] (Asaas), [[../decisions/ADR-008-plano-de-controle-central]] (control-plane em schema separado no Supabase atual), [[../decisions/ADR-009-byok-openai-por-tenant]] (chave OpenAI por tenant, so OpenAI).
- **Research:** [[../agents/research/saas-decisoes-canal-e-pagamento]].
- **Backlog SaaS:** Epics 6-10 (16+ stories) em stories/backlog. Ver [[../stories/BACKLOG]].
- **Forma do produto (confirmada pelo usuario):** ver secao dedicada em [[../project/roadmap-saas]]. Plano UNICO R$997/mes; corretor pluga a propria chave OpenAI + Meta Ads + Google Calendar + Evolution; tenant nasce com protocolo de plano de saude; control-plane em schema separado. Guard-rail: **o CRM da Cranium NAO e um tenant**.

## 2. Fundacao SaaS aplicada no banco
- **Migration 015 (control_plane):** schema separado com tenants, plans (seed plano unico R$997), subscriptions, subscription_events, invoices, webhook_events, admins, admin_actions. RLS fechado (so service_role). **APLICADA em producao** e verificada (8 tabelas, seed, RLS 100%).

## 3. Auditoria de robustez (crm-qa) + 3 P0 corrigidos
Relatorio: [[../agents/qa/auditoria-robustez-2026-07-09]] (veredicto CONCERNS; P0x3, P1x6, P2x6).
- **P0-1 Timeouts** em todas as chamadas externas: OpenAI 25s, Evolution/Google/Meta 10s (AbortSignal), SMTP 10s (nodemailer). Arquivos: src/agent/agent.ts, src/whatsapp/evolution.ts, src/crm/calendar.ts, src/crm/meta.ts, src/crm/email-provider.ts.
- **P0-2 RLS de negocio** (defense-in-depth): migrations 005 (leads/messages/tags/lead_tags/checklist_items/integrations_config) + 016 (email_* + follow_up_schedule). **APLICADAS** e verificadas (anon key bloqueada nas 13 tabelas; service_role segue lendo). Plano em [[../agents/data-engineer/rls-p0-apply-plan]].
- **P0-3 Rate-limit + cap de payload** nos ingress publicos (webhook 60/min, leadgen 30/min, site-lead 10/min, tracking, unsubscribe). Helper src/lib/rate-limit.ts (UPSERT atomico, fail-open). Migration 017 (tabela rate_limits + funcao upsert_rate_limit, EXECUTE revogado de anon/authenticated, so service_role). **APLICADA.**
- P1/P2 seguem abertos (desacoplar webhook/campanha, kill-switch fail-closed + auditoria, telefone E.164, segredos cifrados, etc.).

## 4. Dominio (Vercel, nameservers da Vercel)
- **interno.craniumdigital.com.br** = CRM interno da Cranium (equipe). No ar, SSL ok.
- **crm.craniumdigital.com.br** = porta do produto SaaS (hoje ainda serve o interno por transicao; sera reapontada quando a landing/login do produto existir).
- **{corretor}.craniumdigital.com.br** = 1 subdominio por tenant (criado no provisionamento futuro).
- Estrategia registrada em [[../project/roadmap-saas]] secao "Forma do produto".

## 5. Autenticacao e email
- **Esqueci minha senha:** rota publica /reset-password (liberada no middleware) + link no login. Fluxo implicito (hash) tratado explicitamente com setSession. Arquivos: app/reset-password/page.tsx, app/login/page.tsx, middleware.ts.
- **SMTP Gmail + 4 templates:** configurados no Supabase Auth via Management API (PATCH config/auth). Sender name "Cranium Digital". Templates futuristas em supabase/email-templates/ (reset-password, confirm-signup, magic-link, invite) + README com o mapa dos slots. Emails chegam na caixa de entrada, na marca.
- **Conta admin:** craniumdigital.ia@gmail.com, role admin, nome Bruno (login testado e funcionando). Senha inicial fraca (123456) — trocar.
- Nota: nao ha UI in-app de gestao/convite de usuario ainda (story 9.2). Contas criadas via admin API / painel Supabase. Papeis: admin | atendente ([[../agents/data-engineer/schema]], migration 004/006).

## 6. Grupos (aba de atendimento) — commit 8863554
- **Foto do grupo** puxada da Evolution (CachedGroup.pictureUrl; fallback com onError).
- **Atualizacao automatica:** polling (lista 10s, conversa aberta 5s), sem F5.
- **Exclusao sincronizada com o WhatsApp** (dentro dos limites do WhatsApp): mensagem enviada pelo CRM -> apaga pra todos via Evolution (POST /chat/deleteMessageForEveryone); mensagem recebida -> some so do CRM; revogacao no WhatsApp -> removida do CRM via webhook (parseGroupRevoke + deleteGroupMessageByExternalId).
- Arquivos: src/whatsapp/evolution.ts, src/crm/groupchat.ts, app/api/groups/*, app/api/webhook/route.ts, components/GruposInbox.tsx.

## 7. Design — alinhar ao portal.craniumdigital.com.br
- **Video cinematografico no login** (reaproveitado do portal do corretor): public/brand/{login-cinematic,cyborg-hero,sinapses-brain}.mp4; componente components/BrandBackgroundVideo.tsx.
- **Login redesenhado** igual ao portal: card glass escuro, cerebro em caixa, eyebrow CRANIUM, "Entrar", subtitulo, inputs com icone (mail/lock), olho de senha, "Esqueci a senha". (app/login/page.tsx + .login-card--glass em styles/globals.css). Sem "Criar conta" no interno (sem cadastro publico).
- **Home + Conversas + Shell + reset-password:** porte da linguagem visual do portal EM ANDAMENTO (crm-frontend). Sem gamificacao (o portal e gamificado, mas o CRM interno nao). So a estetica: cards roxos escuros, labels maiusculas, KPI grande, bolhas de chat, botoes roxos.

## 8. Correcoes de infra
- **Vercel:** removida a pasta legada `api/` da raiz (protótipo Make) que colidia no symlink das funcoes (EEXIST) e quebrava o deploy intermitentemente.
- **CI follow-up cron** (.github/workflows/followup-cron.yml): timeout no curl (90s) + timeout no job (5min) + 3 retries + concurrency, pra parar os cancelamentos/notificacoes de falha.

## Estado de migrations (producao)
Aplicadas nesta sessao: **015** (control_plane), **005** + **016** (RLS negocio), **017** (rate-limit). Ver [[../agents/data-engineer/migrations-log]].

## Pendencias / proximos passos
- Design: terminar home + CRM + reset (crm-frontend em andamento).
- P1 da auditoria de robustez.
- Trocar a senha admin fraca.
- Produto SaaS (crm.): billing Asaas + onboarding/wizard + super-admin (Epic 6).
