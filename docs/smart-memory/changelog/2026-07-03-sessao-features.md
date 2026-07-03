---
title: Changelog — Sessão de features (1-3 jul 2026)
type: changelog
created: 2026-07-03
tags: [changelog, ia-openai, financeiro, metas, demandas, grupos, site-lead, email, evolution, incidente]
related: ["[[../shared-context]]", "[[../decisions/ADR-005-ia-openai-vs-anthropic]]", "[[2026-06-29-sessao-features]]"]
---

# Sessão de features — 1 a 3 jul 2026

Tudo abaixo foi construído, buildado, **publicado em produção** (`crm-cranium.vercel.app` via `vercel --prod`) e **enviado ao GitHub** (branch `feat/portal-epic-5`). Migrations aplicadas pelo usuário no SQL editor do Supabase.

## 1. Agente de IA — humano + SPIN selling
- **Timing humano**: `sendText` aceita `delayMs`; a Evolution mostra "digitando..." por um tempo proporcional ao tamanho da mensagem (`delayDigitacao` em `handler.ts`, 1,4s a 6s).
- **SPIN selling**: `prompt.ts` ganhou o bloco "MÉTODO COMERCIAL (SPIN)" — situação → problema → implicação → valor → agendar. Meta = gerar desejo de agendar a **sessão estratégica**, não só qualificar. Abertura variada. `config.ts` (opening/qualificação/scheduling) reescritos no código e no banco.
- **Guarda anti-vácuo**: se o modelo encerra o turno só com ferramenta (sem texto), refaz o turno sem ferramentas para nunca deixar o lead sem resposta.

## 2. Migração de IA: Claude → OpenAI (GPT) — ver [[../decisions/ADR-005-ia-openai-vs-anthropic]]
- `src/agent/agent.ts` e `src/crm/email-content.ts` reescritos com **OpenAI Chat Completions + function calling** (mesmas ferramentas: atualizar_lead, transferir_para_humano, agendar_reuniao).
- `config.ts`: `OPENAI_API_KEY` + `AGENT_MODEL` default `gpt-4o`. Depois trocado para **`gpt-4o-mini`** por custo (15-16x mais barato).
- Motivo: a conta Anthropic ficou sem crédito; usuário optou por trocar de provedor. **Chave dedicada só do CRM** na OpenAI.

## 3. Módulo Financeiro (migration 011) + aba Metas
- **Financeiro** (`/financeiro`): clientes pagantes (MRR), receitas avulsas, despesas fixas/variáveis, **DRE por período** (mês/trimestre/semestre/ano). MRR conta só cliente ativo no mês; início futuro vira "a entrar" (scheduled); churn não infla a receita do mês. Tabelas `fin_clients`, `fin_revenue`, `fin_expenses`. `src/crm/finance.ts` + `/api/finance/*` + `components/FinanceDashboard.tsx`.
- **Metas** (`/metas`, aba separada): projeção de MRR mês a mês (novos/churn por mês + ticket) até o mês-alvo. `finance_goals` em `integrations_config`. `components/MetasDashboard.tsx`.
- Dados reais da Cranium cadastrados (28 clientes, MRR ~R$24k, despesas ~R$8,3k/mês).

## 4. Demandas dos grupos (migration 012)
- Quadro kanban (`/demandas`): cliente escreve **"demanda"** num grupo → a IA resume/classifica (8 categorias) e vira card (Aberta → Em andamento → Concluída). A IA responde no grupo prometendo retorno **em até 30 min com o prazo**.
- `parseGroupWebhook` + `handleGroupMessage`; tabelas `demands` + `demand_pending`. Monitora **todos** os grupos.

## 5. Aba Grupos (migration 013) — inbox estilo WhatsApp
- `/grupos`: lista todos os grupos do WhatsApp (via `fetchAllGroups` da Evolution) + inbox (mensagens do grupo + responder). Histórico guardado a partir de agora (`group_messages`); a Evolution não persiste histórico de grupo.
- `src/crm/groupchat.ts` + `/api/groups` + `/api/groups/messages`.

## 6. Formulário do site → CRM
- `POST /api/site-lead` (protegido por `SITE_LEAD_SECRET`): cria lead origem "site", salva e-mail (entra na lista automática), e dispara o opener da IA no WhatsApp se houver telefone. **Integração no lado do site ainda em configuração pelo usuário** (0 leads recebidos até 3/jul).

## 7. E-mail marketing
- **Lista automática**: `email_auto_list_id` — leads que chegam (Meta + site + e-mail coletado pela IA) entram sozinhos numa lista escolhida. Criada a lista "Leads Meta" como automática. Bug do `addContacts` (onConflict vs índice de expressão) corrigido — conserta também o import de CSV.
- **Prévia do e-mail**: iframe se ajusta à altura real (mostra o e-mail inteiro, sem scroll interno).

## 8. Excluir conversas
- Botão "Excluir" no cabeçalho da conversa (aba Conversas): `deleteLead` + `DELETE /api/leads/:id` (cascade apaga mensagens/tags/atribuição).

## 9. Alerta de queda da Evolution
- `checkEvolutionHealth` + endpoint `/api/cron/evolution-health` (aceita `Bearer CRON_SECRET` ou `?token={CRON_SECRET}`). Avisa por **e-mail** (canal independente do WhatsApp) só na transição cai/volta. `alert_email` em `integrations_config`.
- **Vercel Hobby só permite cron 1x/dia**, então NÃO dá pra rodar a checagem a cada 10 min pela Vercel. Solução: **monitor externo grátis** (UptimeRobot / cron-job.org) batendo no endpoint com `?token={CRON_SECRET}` a cada ~10 min. (Ver incidente abaixo.)

---

## ⚠️ INCIDENTE — chave da Evolution errada no banco (raiz de várias falhas)
- **Sintoma**: portal mostrava WhatsApp "inacessível", QR 404, status 401; agente não enviava; grupos vinham 0.
- **Causa**: `integrations_config.evolution_api_key` estava com uma chave **errada** (`CraniumAdm…`, 17 chars → 401). `getEvolutionConfig` usa o **banco primeiro** (DB `??` env), então a chave errada do banco derrubava tudo.
- **Correção**: trocada no banco para a chave correta (`cranium-crm-evolution-2026-secret`, 33 chars → 200). Vale na hora (leitura em runtime), sem deploy.
- **Aprendizado**: a config efetiva da Evolution vem do **banco**, não do env. Ao depurar 401/conexão, checar `integrations_config` antes do env. A instância também desconecta quando o Railway reinicia — reparear pelo QR na aba WhatsApp (por isso o alerta do item 9).

## ⚠️ INCIDENTE — deploys falhando por cron no plano Hobby
- **Sintoma**: depois de adicionar o cron `/api/cron/evolution-health` (`*/10 * * * *`), **todos os `vercel --prod` passaram a falhar** com `Hobby accounts are limited to daily cron jobs`. Produção ficou travada numa versão antiga (aba Grupos aparecia como cards em vez do inbox).
- **Causa**: a conta Vercel é **Hobby**, que só permite cron **1x por dia** (por isso o cron de follow-up é `0 12 * * *`). Um schedule mais frequente **quebra o build**.
- **Correção**: removido o cron `evolution-health` do `vercel.json`. O endpoint continua e é acionado por **monitor externo** (`?token={CRON_SECRET}`).
- **Aprendizado**: no Hobby, nada de cron sub-diário no `vercel.json`. Se precisar de frequência, usar monitor externo grátis ou subir pro plano Pro.
