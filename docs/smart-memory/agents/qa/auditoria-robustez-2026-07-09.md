---
title: "Auditoria de Robustez da Plataforma — CRM Cranium"
type: qa-audit
agent: crm-qa
created: 2026-07-09
tags: [qa, robustez, seguranca, resiliencia, auditoria, producao, saas]
related: ["[[project/architecture]]", "[[project/modules]]", "[[agents/qa/results]]", "[[agents/data-engineer/schema]]"]
---

# Auditoria de Robustez — Plataforma CRM Cranium (2026-07-09)

Read-only no código. Varredura de `src/`, `app/api/`, `lib/`, `components/`, `supabase/migrations/`.
Foco: resiliência de chamadas externas, idempotência/concorrência, segurança, validação,
observabilidade, RBAC, edge cases de negócio e prontidão para SaaS multi-tenant.

## VEREDICTO GERAL: ⚠️ CONCERNS

A plataforma tem uma base sólida e bem pensada nos pontos que mais importam: idempotência do
webhook (dedupe por `external_id`), claim atômico do follow-up (optimistic lock), todos os
ingress de máquina fail-closed em produção (webhook, leadgen, site-lead, cron), RBAC correto
(requireAdmin nos escritores de segredo, requireUser no CRM), service_role só no servidor e
assinaturas HMAC validadas (Meta X-Hub, Make secret com timingSafeEqual, unsubscribe assinado).
O que impede o PASS é uma classe transversal de fragilidade em produção: **nenhuma chamada
externa tem timeout** (OpenAI, Evolution, Google, SMTP, Meta Graph) — em serverless com
`maxDuration: 60`, uma dependência lenta trava a função até o corte da plataforma. Some-se a
isso o **RLS de negócio não aplicado** (AC3 da 5.2, ainda pendente) e a **ausência de rate
limiting** nos ingress públicos. Nada disso é bug de lógica; é hardening de resiliência e postura
de segurança que precisa entrar antes de escalar / virar SaaS.

Achados: **P0: 3 · P1: 6 · P2: 6** (mais 1 item da review anterior confirmado como resolvido).

---

## P0 — Crítico (pode quebrar ou vazar em produção)

### P0-1. Nenhuma chamada externa tem timeout — risco de esgotar `maxDuration` e travar
- **Onde:** `src/agent/agent.ts:14` (client OpenAI sem `timeout`/`maxRetries`), `src/agent/agent.ts:358` e `:411` (`client.chat.completions.create`); `src/whatsapp/evolution.ts:43,58,92,108,132,155,173` (todos os `fetch` sem `AbortSignal`); `src/crm/calendar.ts:79` (token) e demais fetch da Calendar API; `src/crm/meta.ts` (Graph API); `src/crm/email-provider.ts:97` (nodemailer `sendMail` sem timeout).
- **Problema:** o SDK da OpenAI tem timeout padrão de **10 minutos** e o `fetch` global do Node **não tem timeout**. As funções serverless têm `maxDuration: 60`. Se a OpenAI, a Evolution (Railway) ou o Google demorarem, a função fica presa até a Vercel matá-la em 60s — sem log útil, com 504 pro chamador.
- **Impacto:** no `/api/webhook`, o processamento é **síncrono antes do 200** (`await handleInbound`). Uma latência da OpenAI ou da Evolution segura o webhook até estourar; a Evolution então **reentrega** a mesma mensagem (o dedupe salva de duplicar resposta, mas o custo de invocação e a fila crescem). Em produção sob carga, isso vira efeito dominó.
- **Correção:** configurar `new OpenAI({ apiKey, timeout: 30_000, maxRetries: 2 })`; envolver cada `fetch` externo com `AbortSignal.timeout(10_000)` (o `evolution-admin.ts:37` já usa `AbortController` — replicar o padrão); no nodemailer, passar `connectionTimeout`/`greetingTimeout`/`socketTimeout`. Escolher timeouts que somados caibam em 60s (o loop agentic roda até 5 iterações de OpenAI + N sends de Evolution).

### P0-2. RLS das tabelas de negócio (leads/messages/…) NÃO está aplicado (AC3 da 5.2 aberto)
- **Onde:** `supabase/migrations/005-rls-business-tables.optional.sql` (não aplicada — provado com sentinela na review 5.2: anon key LÊ e INSERE em `leads`/`messages`).
- **Problema:** a proteção dos dados de negócio hoje é só o gate server-side (`lib/auth.ts`) + service_role. Se qualquer código client-side, edge function ou integração futura usar a **anon key** para consultar o Supabase diretamente, todos os leads/mensagens ficam expostos e graváveis. Defense-in-depth desligado.
- **Impacto:** vazamento de PII (telefone, nome, e-mail, notas de qualificação, conversas inteiras) de todos os leads. Grave por si só; **bloqueante para virar SaaS** (multi-tenant sem RLS = qualquer tenant lê os leads dos outros).
- **Correção:** aplicar a migration 005 no Supabase e re-rodar `node scripts/test/ac5-negative.mjs` com `STRICT_RLS=1` (esperar R1–R3 → PASS). É o item nº1 antes de multi-tenant.

### P0-3. Ingress públicos sem rate limiting nem limite de tamanho de payload
- **Onde:** `app/api/webhook/route.ts`, `app/api/leadgen/route.ts`, `app/api/site-lead/route.ts`, `app/api/email/track/{open,click}/route.ts`, `app/api/email/unsubscribe/route.ts` — todos leem `req.json()`/`req.text()` sem cap de tamanho e sem throttle.
- **Problema:** o webhook e o leadgen são autenticados por token, mas o token é **fixo e único**; se vazar (ou por brute-force no site-lead), um atacante pode inundar o endpoint. Cada POST no webhook aciona o agente Claude (**custo por token**) e escreve no banco. Sem rate limit, um loop malicioso ou um bug do lado da Evolution/Make vira DoS financeiro. `req.json()` sem limite permite payload gigante consumindo memória/CPU.
- **Impacto:** DoS de custo (fatura da OpenAI + Supabase), enchente de invocações Vercel, degradação geral. Os tracking pixels públicos (open/click) são anônimos e triviais de martelar.
- **Correção:** rate limiting por IP/token nos ingress (ex.: `@upstash/ratelimit` com Redis serverless, ou throttle simples em tabela); rejeitar payloads acima de um teto (checar `content-length` / limitar bytes lidos). Cachear/deduplicar tracking. Priorizar o `/api/webhook` (o mais caro).

---

## P1 — Importante

### P1-1. Webhook processa TODAS as mensagens do batch de forma síncrona e sequencial
- **Onde:** `app/api/webhook/route.ts:61-77` — `for (const msg of messages) await handleInbound(msg)` e depois o loop de grupos.
- **Problema:** um único `messages.upsert` pode trazer várias mensagens. Cada `handleInbound` roda o agente (várias chamadas OpenAI) em série, dentro de `maxDuration: 60`. Um batch de 3-4 mensagens já pode estourar o teto. Combinado com P0-1 (sem timeout), é o cenário mais provável de 504 em produção.
- **Impacto:** timeouts sob rajada, reentrega da Evolution, atendimento atrasado.
- **Correção:** limitar o batch processado por invocação e/ou desacoplar (enfileirar em tabela de jobs + processar no cron). No mínimo, processar só a primeira mensagem por lead e deixar as demais para o próximo ciclo, ou paralelizar com `Promise.allSettled` respeitando o teto.

### P1-2. `getAgentEnabled` falha ABERTO (kill-switch que religa sozinho em erro de banco)
- **Onde:** `src/agent/config.ts` (getAgentEnabled retorna `true` em erro de leitura — confirmado na review anterior L4).
- **Problema:** se a leitura de `integrations_config` falhar, o interruptor global da IA é tratado como **ligado**. Um kill-switch de segurança deveria falhar FECHADO (não responder) quando não consegue confirmar seu estado.
- **Impacto:** num incidente de banco, a IA volta a responder mesmo que a equipe a tenha desligado de propósito (custo + atendimento indevido).
- **Correção:** em erro de leitura do toggle, retornar `false` (não responder) ou propagar o erro para o handler decidir. Documentar a escolha.

### P1-3. Kill-switch global da IA é `requireUser` e sem auditoria
- **Onde:** `app/api/agente/status/route.ts` (POST protegido por requireUser) + `src/agent/config.ts` (persistência do toggle).
- **Problema:** qualquer membro autenticado pausa/religa TODA a automação (custo + atendimento de todos os leads) e não há registro de quem alterou nem quando.
- **Impacto:** interruptor de alto impacto sem trilha; num time maior, impossível auditar. (Já era M3 na review anterior — segue aberto.)
- **Correção:** avaliar `requireAdmin` para o toggle e logar autor+timestamp (tabela de auditoria — o schema `control_plane.admin_actions` já dá o padrão).

### P1-4. [RESOLVIDO — reclassificado] Ordem toggle × setStatus com IA desligada
- **Onde:** `src/handler.ts` — `iniciarAtendimento`: check `getAgentEnabled` em `:219` vem **antes** do `setStatus('em_atendimento')` em `:224`; `handleInbound`: check de toggle em `:69` vem **antes** do `setStatus` em `:85-87`.
- **Situação:** o L1 da review anterior (lead ficava "em_atendimento" sem opener com IA OFF) está **corrigido** no código atual — com a IA desligada, `iniciarAtendimento` retorna em `:219-222` mantendo o lead em "novo". Não é mais um achado; registrado como confirmação.
- **Recomendação:** adicionar teste de regressão cobrindo IA-OFF + opener para travar a ordem correta em futuras mudanças no handler (god node).

### P1-5. Telefone não normalizado para E.164 no lead manual
- **Onde:** `app/api/leads/route.ts:42-49` guarda só-dígitos (`replace(/\D/g,'')`, mínimo 8), sem garantir DDI/`+`. Diverge do CLAUDE.md (E.164 obrigatório) e de `isSendablePhone` (`^\+?\d{8,15}$`).
- **Problema:** lead manual sem DDI (ex.: "9999-8888") entra no banco e pode falhar num envio outbound futuro ou duplicar contato (mesmo número com/sem 55). O `site-lead` normaliza (prefixa 55), mas o `/api/leads` não.
- **Impacto:** envios falhos, dedupe de contato furado (dois leads pro mesmo humano).
- **Correção:** aplicar a mesma `normalizePhone` do site-lead no `/api/leads`; considerar normalização única e centralizada em `getOrCreateLead`.

### P1-6. Campanha de e-mail: envio serial sem `maxDuration` e sem paginação de lote
- **Onde:** `src/crm/email.ts:703-719` (`for (const r of recipients) await provider.send(...)`), disparado por `app/api/email/campaigns/[id]/send/route.ts` — a rota **não declara `maxDuration`** (default 10s na Vercel Hobby / 15s no Pro sem config).
- **Problema:** cada `send` é um SMTP síncrono (Gmail, com latência de rede). 20-30 destinatários já estouram o timeout default da função; a campanha fica presa em `enviando` (o claim atômico está correto, mas o status nunca fecha) e parte dos e-mails não sai.
- **Impacto:** campanhas parcialmente enviadas, status travado, sem retomada automática.
- **Correção:** declarar `maxDuration` explícito na rota; processar em lotes com cursor (retomar de onde parou) ou mover o envio para o cron; considerar `Promise.allSettled` com concorrência limitada. O Gmail SMTP também tem limite diário — documentar.

### P1-7. `config.required()` só avisa (warn), não falha rápido — segredo ausente vira erro silencioso tardio
- **Onde:** `src/config.ts:4-10` — `required()` faz `console.warn` e devolve `""`. OpenAI cai em `"sk-missing-openai-key"` (`agent.ts:14`), Supabase recebe URL/key vazias.
- **Problema:** faltando `OPENAI_API_KEY`/`SUPABASE_*` em produção, o app **sobe** e só quebra na primeira chamada, com erro genérico da lib (401 da OpenAI, erro obscuro do supabase-js), difícil de diagnosticar. Fail-fast seria melhor para variáveis realmente obrigatórias.
- **Impacto:** deploy "verde" que falha em runtime; debugging demorado.
- **Correção:** separar env verdadeiramente obrigatória (Supabase, OpenAI) e falhar o boot / expor um `/api/health` que valide a presença. Não commitar segredo (já está OK — `.env` gitignored).

---

## P2 — Oportunidades de melhoria

### P2-1. Segredos de integração em texto plano em `integrations_config`
- **Onde:** `src/crm/integrations.ts` — `meta_app_secret`, `evolution_api_key`, `google_refresh_token`, `email_app_password`, `meta_make_secret` salvos como valor cru na tabela.
- **Problema:** qualquer acesso à tabela (backup, dump, service_role comprometida, log acidental) expõe todas as credenciais em claro. Para SaaS multi-tenant isso é sério.
- **Correção:** cifrar em repouso (pgcrypto / KMS) ou manter segredos só em env por tenant. No mínimo, garantir que a tabela nunca é lida pela anon key (depende do P0-2/RLS).

### P2-2. `parseWebhook`/`parseGroupWebhook` sem validação de tamanho/estrutura
- **Onde:** `src/whatsapp/evolution.ts:187-252` — confia no shape do payload; texto sem cap de tamanho.
- **Problema:** mensagem gigante (WhatsApp permite textos longos) entra inteira no prompt do agente (custo de tokens) e no banco. Input malformado é tolerado, mas não há limite superior.
- **Correção:** truncar `text` a um teto razoável antes de persistir/enviar ao modelo.

### P2-3. Erros de negócio retornam `e.message` cru ao cliente
- **Onde:** padrão em quase todas as rotas: `{ error: e instanceof Error ? e.message : 'erro interno' }, status 500`.
- **Problema:** mensagens do supabase-js/OpenAI podem vazar detalhes internos (nomes de coluna, constraint, provider). Não é stack trace (bom), mas ainda expõe internals.
- **Correção:** logar o detalhe server-side (já faz) e devolver mensagem genérica ao cliente em 500; reservar `e.message` para erros de validação 4xx controlados.

### P2-4. Loop agentic sem teto de custo/observabilidade de tokens
- **Onde:** `src/agent/agent.ts:357` (loop até 5 iterações) — sem registro de tokens/custo por lead, sem alerta de gasto.
- **Problema:** impossível monitorar custo por lead/conversa (já apontado como gap #6 no schema). Um lead "difícil" pode consumir 5 iterações × 1024 tokens repetidamente via follow-up.
- **Correção:** registrar `usage` (input/output tokens) por chamada numa tabela `llm_calls`; alertar em gasto anômalo. Base para cotas de SaaS (`quota_mensagens_mes` já existe no plano).

### P2-5. `follow_up_count` sem CHECK no banco; limite só aplicacional
- **Onde:** schema `leads` — limite `FOLLOWUP_MAX=30` só na app (gap #7 do schema).
- **Problema:** um bug no scheduler pode ultrapassar o limite sem erro de banco (spam ao lead).
- **Correção:** `CHECK (follow_up_count >= 0)` + documentar; opcionalmente teto no banco.

### P2-6. Precisão do cron no plano Hobby (1x/dia) fura a cadência de follow-up
- **Onde:** `src/followup/scheduler.ts:200-206` (comentário reconhece) — cadência com hora BRT específica, mas cron roda 1x/dia às 12h UTC no Hobby.
- **Problema:** toque agendado para 14h dispara só no dia seguinte; a experiência de cadência fina não se cumpre. É limitação de infra, não de código, mas afeta o produto.
- **Correção:** documentar claramente / exigir plano Pro para cadência por hora; ou aceitar granularidade diária como contrato.

---

## O que está SÓLIDO (registrar o que não precisa mexer)

- **Idempotência do webhook:** dedupe por `external_id` (índice único parcial) em `addMessage` (`leads.ts:99-126`); reentrega recebe 200 sem duplicar resposta. Bem feito.
- **Claim atômico do follow-up:** `claimFollowUpTo` (`leads.ts:165-187`) com optimistic lock (`follow_up_count == expectedCount` + `last_direction='out'` + `last_message_at < intervalAgo` + `< maxCount`) e reescrita de `last_message_at` — fecha a corrida de cron concorrente e o duplo-envio. `runScheduledFollowUps` usa claim-then-send igual.
- **Ingress fail-closed em produção:** webhook (`route.ts:41-51`), site-lead (`route.ts:32-35`) e cron (`followup/route.ts:21`) recusam quando o secret falta em `NODE_ENV=production`. Corrige o concern fail-open da 3.3.
- **Assinaturas validadas:** Meta X-Hub-Signature-256 (`leadgen` legado), Make secret com `crypto.timingSafeEqual` (`leadgen:54-59`), unsubscribe/tracking com HMAC (`email-sign`). Constant-time onde importa.
- **RBAC correto:** `requireAdmin` em todos os escritores de segredo (integrations meta/evolution/google/email config, meta import, campaign send, agente config); `requireUser` no CRM operacional; leitura de `role` de `profiles` (não de user_metadata) travada pelo trigger 006.
- **service_role só no servidor:** `src/db.ts` isolado; middleware usa anon key + cookies; sem service_role em `components/` ou client.
- **Isolamento do canal:** Evolution admin (`evolution-admin.ts:37`) já usa `AbortController` — bom padrão a replicar nos demais fetch (ver P0-1).
- **Tolerância a falha nas chamadas best-effort:** `fetchProfilePictureUrl`, `sendMedia`, `getEvolutionState`, `fetchAllGroups`, notificações e e-mail de etapa são best-effort com catch e não quebram o atendimento. Falha de e-mail de confirmação não derruba o agendamento (`agent.ts:281`).
- **control_plane (015):** schema de SaaS bem modelado — RLS habilitado sem policies (fechado por padrão), dedupe de webhook Asaas por `unique(provider, external_id)`, auditoria imutável (`admin_actions`), sem service-role key em `tenants`. Ainda **sem código** que o use (schema-only) — quando implementar o painel super-admin, o gate tem que ser server-side conferindo `control_plane.admins` (o comentário já orienta).
- **Lead manual "existente":** a sobrescrita de status/interesse (M1 da review anterior) está **corrigida** — `app/api/leads/route.ts:71` só aplica status/interesse `if (!existed)`.

---

## Top 5 oportunidades (maior retorno primeiro)

1. **Timeouts em todas as chamadas externas (P0-1).** Uma mudança pequena e transversal que elimina a causa nº1 de 504/travamento em produção. Padrão já existe em `evolution-admin.ts`. Maior retorno de robustez por linha alterada.
2. **Aplicar o RLS de negócio — migration 005 (P0-2).** Liga o defense-in-depth e é **pré-requisito inegociável** para multi-tenant/SaaS. Já tem runner de validação pronto (`ac5-negative.mjs` + `STRICT_RLS=1`).
3. **Rate limiting + cap de payload nos ingress públicos (P0-3).** Fecha o DoS de custo (webhook aciona OpenAI). Prioridade no `/api/webhook`.
4. **Desacoplar/limitar o processamento síncrono do webhook e da campanha (P1-1 + P1-6).** Enfileirar ou lotear para não estourar `maxDuration`. Resolve os dois maiores caminhos de timeout de uma vez.
5. **Kill-switch fail-closed + auditoria + requireAdmin (P1-2 + P1-3).** Um interruptor de custo/atendimento que hoje religa sozinho em erro e não registra autor. Barato de corrigir, alto impacto operacional.

---

_Auditoria por Tessera (crm-qa), read-only. Nenhum código alterado. Achados evidenciados por
arquivo:linha. Itens P1-4 e o L1 anterior precisam de confirmação em runtime (ordem toggle×setStatus)._
