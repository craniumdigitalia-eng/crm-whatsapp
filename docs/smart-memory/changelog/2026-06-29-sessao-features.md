---
title: Changelog — Sessão de features (29-30 jun 2026)
type: changelog
created: 2026-06-30
tags: [changelog, agenda, topbar, agente-ia, leads]
related: ["[[../shared-context]]", "[[../stories/in-review/5.7-modulo-agendamento]]", "[[../agents/qa/results]]"]
---

# Sessão de features — 29-30 jun 2026

Tudo abaixo foi construído, buildado, **publicado em produção** (`crm-cranium.vercel.app` via `vercel --prod`) e **enviado ao GitHub** (branch `feat/portal-epic-5`). Deploy é por `vercel --prod` (arquivos locais), não por git integration.

## 1. Perfil & Config + Dashboard home
- Tela `/config`: editar nome e foto de perfil (Supabase Storage, bucket `avatars`, limite 2MB, só imagens).
- `POST/GET /api/profile`. Dashboard home em `/` (KPIs + funil + atividade). Foto na sidebar.
- Migration **009** aplicada (coluna `avatar_url` + bucket + policy `avatars_own_folder`). Bucket criado via Storage API.
- Commits: `116db31`.

## 2. Correção do agente de IA (abordagem)
- A abertura parou de perguntar "saúde ou seguros?"; agora pergunta **como o corretor trabalha** (interno / externo de corretora / corretora com vendedores / autônomo).
- Limpeza de "seguros" nos campos da config (contexto, objeções, transferência, guardrails) — foco 100% plano de saúde.
- Aplicado no **banco** (`integrations_config`, vale na hora) e no **código** (`src/agent/config.ts`, `src/agent/prompt.ts`). Commit `daf5371`.

## 3. Agenda (Story 5.7) + 3 melhorias
- Módulo Agendamento: calendário mês/semana, CRUD de eventos no Google Calendar, vínculo a leads (`extendedProperties.private.leadId`), Google Meet. Google Calendar = fonte da verdade (sync bidirecional). Commits `a1cd001` (backend) + `6f59938` (frontend).
- **Cores**: 11 cores nativas do Google (`colorId`), seletor + eventos pintados. `00df5aa` + `f0e279d`.
- **Lado a lado**: eventos sobrepostos em colunas (column packing). `2da4333`.
- **Arrastar**: drag-to-reschedule (pointer events, otimista + revert), muda horário/dia e sincroniza no Google. `01b739f`.
- Arquivos: `src/crm/calendar.ts`, `app/api/agenda/events/route.ts`, `app/api/agenda/events/[id]/route.ts`, `components/AgendaModule.tsx`.

## 4. Novo Lead
- `POST /api/leads` (cria lead manual) + modal `NovoLeadModal` no kanban; botões "Novo Lead" e "Adicionar" por coluna. `1e62428` + `99d9265`.

## 5. Topbar (4 botões funcionais)
- Avatar → menu (Perfil/Sair); Busca → leads (`/crm?lead=`); Sino → próximas reuniões + leads novos; Filtro → `/crm?stage=`.
- KanbanBoard lê `?lead`/`?stage` (Suspense no `crm/page.tsx`). `38e22b9`.

## 6. Interruptor liga/desliga da IA
- Flag global `agent_enabled` em `integrations_config` + trava no `src/handler.ts` (desligada = registra lead, não responde) + `GET/POST /api/agente/status`. `a7bf4d0`.
- Switch na sidebar (`components/AiToggle.tsx`). `b562788`.

## 7. Handoff: IA recua quando o humano assume
- Quando o humano responde o lead **de qualquer aparelho** (celular, WhatsApp Web, Desktop) com o número conectado, o sistema detecta a mensagem `fromMe`, registra no CRM e marca o lead como `humano` → a IA para de responder.
- Distinção do eco da própria IA via `external_id`: `sendText` agora retorna o `key.id`; toda mensagem que enviamos é gravada com esse id, então o eco é deduplicado. `6f168b6`.
- Arquivos: `src/whatsapp/evolution.ts`, `src/handler.ts`, `app/api/leads/[id]/reply/route.ts`.

## 8. Estilo das mensagens da IA
- Sem travessão ("—"), frases bem curtas, com respiro. `04e99b9`.
- Resposta enviada em **mensagens separadas** (até 3 balões, split por linha em branco, intervalo de 600ms). `146c154`.
- Preferência de estilo também salva na memória do assistente (vale pro chat e pras mensagens da IA).

## QA
- Review da leva: **CONCERNS** (0 alto · 3 médio · 6 baixo). Detalhe em [[../agents/qa/results]].
- **3 bugs corrigidos e no ar** (`5b9dd92`): Novo Lead não sobrescreve lead existente; editar lead vinculado na Agenda agora salva (PATCH trata leadId); lead do Meta com IA off permanece `novo` (não vai pra `em_atendimento` sem humano).

## Pendências de segurança (não bloqueantes)
- Aplicar migration **005** (RLS defense-in-depth) no Supabase.
- Trocar a senha temporária do admin (`CraniumAdmin@2026`).
- Decisão: pausar a IA deveria ser só admin + auditoria? (hoje é qualquer membro).
