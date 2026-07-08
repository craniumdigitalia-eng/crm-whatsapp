---
title: Changelog — Sessão de features (1-8 jul 2026)
type: changelog
created: 2026-07-03
updated: 2026-07-08
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

---

# Continuação — 4 a 6 jul 2026

## 10. Agente envia PROVAS/IMAGENS ao lead (migration 014)
- Novo: o agente manda **imagens** (prints de campanha, resultados, "como o lead chega") no momento certo, não só texto.
- `evolution.sendMedia` (envia imagem por URL); ferramenta **`enviar_material`** (categorias: campanha/resultado/como_chega/depoimento); `src/agent/assets.ts` (CRUD + upload pro bucket público **`agent-assets`**). O prompt injeta os materiais disponíveis (`assetsSummaryForPrompt`).
- **Tela de upload** na aba Agente IA (`AgentAssets`): sobe imagem + categoria + legenda; ativa/desativa; remove.
- Prompt tunado: **tirar dúvidas** do projeto com clareza, **agendamento impecável** (confirma e-mail, 2 horários), e usar prova no momento certo. Testado ponta a ponta (imagem chegou no WhatsApp).

## 11. Aba Grupos — redesign + cache (correção de instabilidade)
- **Redesign**: o inbox de Grupos passou a usar as **mesmas classes visuais da aba Conversas** (`conv-*`) — roxo, busca com ícone, itens idênticos. (Antes era uma grade de cards que o usuário achou ruim.)
- **Cache dos grupos**: o `fetchAllGroups` da Evolution é lento (**25s+**) e estourava o timeout da função, então os grupos apareciam de forma intermitente. Agora a lista fica em **cache** (JSON em `integrations_config`, chave `groups_cache`); `/api/groups` lê do cache (instantâneo). Botão **Atualizar** dispara o refresh lento; grupo novo entra no cache quando chega mensagem (`ensureGroupCached`). Ver incidente abaixo.

## 12. Favicon + kanban arrastável
- **Favicon**: ícone da Cranium (cérebro roxo) em `app/icon.png` + `app/apple-icon.png`.
- **Kanban drag-and-drop**: arrastar o lead entre etapas com o mouse (HTML5 drag), update otimista + POST `/status`, reverte se falhar. Coluna destaca em roxo no hover.

## 13. Formulário do site → CRM (testado)
- `POST /api/site-lead` validado em produção (cria lead origem "site", entra na lista automática, dispara opener). Secret `SITE_LEAD_SECRET` na Vercel. **Integração no site ainda depende do usuário** ligar a chamada no projeto do site.

## ⚠️ INCIDENTE — Evolution fetchAllGroups lento (grupos sumindo)
- **Sintoma**: aba Grupos aparecia vazia de forma intermitente ("funciona e para"), mesmo com a Evolution `open`.
- **Causa**: `/group/fetchAllGroups` da Evolution chega a **25-26s**; a função serverless corta antes → 0 grupos. E às vezes retorna 0 sem erro (instabilidade da Evolution).
- **Correção**: cache da lista de grupos (item 11). O app não depende mais da latência da Evolution a cada abertura.
- **Aprendizado**: qualquer chamada síncrona à Evolution na borda de request é risco de timeout — preferir cache + refresh sob demanda.

## Pendências do usuário (loops abertos)
- Subir os **prints reais** na aba Agente IA (a IA já sabe enviar, falta o material).
- Preencher o **FAQ do agente** (cases, faixas de investimento, o que a Cranium entrega).
- Ligar a chamada do **formulário do site** no projeto do site.
- Configurar o **UptimeRobot** apontando pra `/api/cron/evolution-health?token=...` (alerta de queda) — feito nesta sessão.

---

# Continuação — 7 jul 2026 (mobile / PWA + tema escuro)

## 14. Mobile / PWA (portal instalável)
- Decisão: **mobile da equipe** (não app de corretor) via **PWA** sobre o portal atual (reaproveita backend/dados). Gamificação do KV ficou de fora (é engajamento de corretor).
- **PWA**: `app/manifest.ts` (instalável, standalone, tema roxo, ícones 192/512 em `public/`); `viewport`/`themeColor` no layout raiz; `apple-icon`.
- **Barra de abas inferior** (`MobileTabBar`) substitui a sidebar no celular (Início/Funil/Conversas/Grupos/Mais). Página **`/mais`** (`MoreMenu`) com todos os módulos. CSS: `.sidebar { display:none }` no mobile.
- Handoff de design salvo em **`docs/design/app-handoff/`** (KV do app: tokens `colors_and_type.css` iguais aos atuais, telas login/chat/leads/funil/perfil em claro+escuro, `App Design System.dc.html`).

## 15. Tema escuro (data-theme="dark")
- Alternância clara/escura via botão na **Topbar** (`ThemeToggle`), persistida em localStorage; script inline no layout raiz aplica antes do paint (sem flash).
- Implementado por **inversão de tokens** em `:root[data-theme="dark"]`. Os **82 fundos `#fff`** viraram token `--card` (invertem juntos).
- Correções de retrofit: o **inbox** (`conv-*`, usado por Conversas e Grupos) era **roxo-escuro fixo** e não seguia o tema → convertido pra tokens (claro E escuro). **Sidebar** mantém cores claras no escuro (é sempre roxo profundo; logo/texto usam `--off-white`). **Selinhos de etapa** com contraste por tema.
- **Pendente/menor**: ~22 selinhos de status com cor fixa (drawer/integ/email/followup/finance) — badges pequenos, contraste aceitável; polir se incomodar.

---

# Continuação — 8 jul 2026 (SaaS / provisionamento)

## 16. Modelo SaaS decidido + kit de provisionamento
- **Decisão** (usuário): vender como SaaS usando **1 base de código, 1 deploy por cliente** (cada cliente com o PRÓPRIO Supabase + PRÓPRIO Vercel, código idêntico). Isolamento máximo dos dados, **zero refação** do código. Trade-off: gerenciar N Supabase/Vercel e aplicar updates/migrations em cada. A alternativa (multi-tenant de banco compartilhado + `org_id` + RLS) só compensa em centenas de clientes — fica pra depois.
- **Kit** em `provisioning/`:
  - `schema.sql` — schema consolidado (schema.sql + migrations 002-014) pra rodar de uma vez num Supabase novo (32 tabelas).
  - `setup.ts` — cria buckets (`avatars`, `agent-assets`), valida tabelas e cria o usuário admin do cliente.
  - `PROVISIONING.md` — guia passo a passo (Supabase → .env → setup → Vercel → WhatsApp → config → teste) + como ATUALIZAR clientes existentes + checklist por cliente.
- Cada cliente = próprias env vars + próprio número WhatsApp (instância Evolution).
