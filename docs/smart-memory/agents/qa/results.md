---
title: "QA Results — Histórico cross-story"
type: project
agent: tessera (crm-qa)
created: 2026-06-25
updated: 2026-06-25
tags: [qa, quality-gate, veredictos]
related: ["[[project/architecture]]", "[[project/conventions]]"]
---

# QA Results — Histórico de Veredictos

> Detalhe da Story 5.2 (AC5 runner + RLS): seção ["Story 5.2 — Auth + RBAC + AC5 e2e"](#story-52--auth--rbac--ac5-e2e) abaixo.

| Story | Data | Veredicto | Issues | Agente |
|---|---|---|---|---|
| 1.1 | 2026-06-25 | ⚠️ CONCERNS | 1 concern (falta teste automatizado AC4); 1 nit (catch amplo na migração) | tessera (crm-qa) |
| 1.2 | 2026-06-25 | ⚠️ CONCERNS | DROP+recreate destrutivo sem backup; NIT catch amplo (1.1) não resolvido; sem teste automatizado AC5 | tessera (crm-qa) |
| 1.3 | 2026-06-25 | ✅ PASS | janela de concorrência fechada na origem (task #12: `last_message_at` no claim); `incrementFollowUp` removido. Gap de teste automatizado AC5 → backlog cross-story | tessera (crm-qa) |
| 2.2 | 2026-06-25 | ✅ PASS | rewrite SQLite→Supabase; AC1–AC6 ok, e2e 29/29 + HTTP. 2 nits não-bloqueantes (UPDATEs secundários sem checagem de erro) | tessera (crm-qa) |
| 3.1 | 2026-06-25 | ✅ PASS | adapter Make: AC1–AC5 ok, AC4 (zero churn nos callers) e fronteira 3.3 confirmados, tsc EXIT=0. Concern p/ 3.3: hash de fallback dedupa só no mesmo segundo (depende de wamid `id` p/ dedup confiável) | tessera (crm-qa) |
| 3.2 | 2026-06-25 | ✅ PASS | scaffold serverless: 7 rotas fiéis ao Express + method guards (405)/id (400), stateless-safe, fronteira 3.3/3.4 ok, tsc EXIT=0. Concern: `comment` em `crons[]` do vercel.json pode falhar validação no deploy (AC5) [RESOLVIDO pelo lead]; 2 nits | tessera (crm-qa) |
| 3.3 | 2026-06-25 | ✅ PASS | webhook idempotente: síncrono (ADR-002), dedupe 1.1 preservado, WARN sem wamid, maxDuration 60, 22/22. **Concern de segurança: auth fail-open quando `MAKE_WEBHOOK_SECRET` ausente** (cron é fail-closed) → endurecer antes do go-live | tessera (crm-qa) |
| 3.4 | 2026-06-25 | ✅ PASS | cron followup: auth fail-closed (401 mesmo sem secret), batch limit 50 via `.limit()` + maxDuration 60, GET+POST exigem secret, node-cron dev-only. Jest 6/6 cobrindo AC6. tsc EXIT=0 | tessera (crm-qa) |
| 5.2 (config/dash) | 2026-06-28 | ✅ PASS | tela /config + dashboard: PATCH /api/profile escopa por auth.user.id (sem IDOR), role/email imutáveis (whitelist + trigger 006), upload avatar restrito à pasta própria por policy de Storage (009), dashboard só agrega (sem PII). 2 nits (avatar_url sem validar prefixo do bucket; limite de imagem só no client). Ver review-5.2-ac5-e-config.md | tessera (crm-qa) |
| Leva features (Novo Lead · Topbar · Interruptor IA · Agenda) | 2026-06-30 | ⚠️ CONCERNS | 0 Alto · 3 Médio · 6 Baixo. M1 "Novo Lead" com telefone existente sobrescreve status/interesse do lead; M2 editar evento ignora troca de "Lead vinculado" (PATCH não envia leadId); M3 kill-switch IA global é requireUser sem auditoria. tsc source-clean. Ver seção abaixo | tessera (crm-qa) |
| 5.2 (story toda) | 2026-06-28 | ⚠️ CONCERNS | AC1/AC2/AC4 ✅ + AC5 runner e2e RODADO (`scripts/test/ac5-negative.mjs`): N* 11/11 (401/redirect) · F* 14/14 (403 atendente em 12 rotas admin + 200 nos GET user) · R4 PASS (trigger 006 **confirmado aplicado**, `42501`). AC3 RLS **REPROVA**: R1/R2/R3 provam que anon key LÊ e INSERE em leads/messages (migration 005 não aplicada). Condição p/ PASS pleno: aplicar 005 e rodar com `STRICT_RLS=1` (R1–R3 → PASS); trocar senha temp admin | tessera (crm-qa) |

---

## Leva de features 2026-06-29/30 — Novo Lead · Topbar · Interruptor IA · Agenda

**Veredicto geral: ⚠️ CONCERNS** — Tessera (crm-qa) — 2026-06-30
Branch `feat/portal-epic-5`. Read-only no código de produção. `npx tsc --noEmit`: **source-clean**
(os únicos erros são de artefatos duplicados em `.next/` — arquivos `* 2.ts` gerados por file-sync,
não código). Achados: **0 Alto · 3 Médio · 6 Baixo**. Nada bloqueante; mediums são integridade de
dados/UX e uma decisão de autorização. Push liberado com as observações registradas.

### Veredictos por área
| Área | Veredicto | Resumo |
|---|---|---|
| Novo Lead (`POST /api/leads` + modal) | ⚠️ CONCERNS | gate requireUser ✅, phone só-dígitos ≥8 ✅, status validado, existed:true tratado. **M1**: telefone existente sobrescreve status/interesse do lead. |
| Topbar (4 botões) | ✅ PASS | logout reusa signOut ✅, ?lead/?stage validados antes de abrir drawer/filtrar ✅, sem exposição nova (mesmo dataset do kanban). Lows de perf. |
| Interruptor IA (backend + API + AiToggle) | ⚠️ CONCERNS | trava correta em handleInbound (persiste msg, não responde) ✅, default ligado ✅, optimistic revert ✅. **M3**: kill-switch global é requireUser sem auditoria. |
| Agenda (5.7 + cores + lado-a-lado + arrastar) | ⚠️ CONCERNS | colorId 1–11 validado ✅, drag PATCH+revert ✅, column-packing sem sobreposição incorreta ✅. **M2**: editar evento ignora troca de lead vinculado. |

### Achados — Médio
- **[M2] Editar evento ignora a troca de "Lead vinculado".** `app/api/agenda/events/[id]/route.ts:25-84`
  só lê `summary/start/end/description/attendees/colorId`; **não lê `leadId`** do body, e
  `AgendaEventPatch` (`src/crm/calendar.ts:297-305`) não tem `leadId`. Mas o modal de edição
  (`components/AgendaModule.tsx:441`) **envia** `leadId` e mostra o select "Lead vinculado" em modo
  edit. Resultado: vincular/trocar/remover o lead de um evento existente é **no-op silencioso** —
  `extendedProperties.private.leadId` nunca é atualizado no Google. (O e-mail do lead até entra em
  `attendees`, mas o vínculo não.) _Recomendação:_ tratar `leadId` no PATCH e atualizar
  `extendedProperties`, ou desabilitar/ocultar o select de lead em modo edição.
- **[M1] "Novo Lead" com telefone já existente sobrescreve o lead.** `app/api/leads/route.ts:65-85` —
  o modal sempre manda `status: etapa`; quando o telefone já existe, `updateLeadFields` **reescreve
  `status` e `service_interest`** do lead existente (ex.: um lead em `fechado` volta para `novo`). A UI
  mostra "já estava no funil — recarregando", mas a mutação já ocorreu. _Recomendação:_ em `existed`,
  não aplicar status/interesse (retornar o lead como está), ou exigir confirmação explícita.
- **[M3] Kill-switch global da IA é `requireUser` (qualquer membro) e sem trilha de auditoria.**
  `app/api/agente/status/route.ts:28` + `src/agent/config.ts:200`. Qualquer membro autenticado
  pausa/religa TODA a automação (afeta custo e atendimento de todos os leads) e não há registro de
  quem alterou. Defensável como controle operacional de equipe pequena, mas é um interruptor de alto
  impacto. _Recomendação (decisão do produto):_ avaliar `requireAdmin` e/ou logar autor+timestamp do
  toggle. Documentar a escolha.

### Achados — Baixo
- **[L1] `iniciarAtendimento` marca `em_atendimento` antes de checar o toggle.** `src/handler.ts:112`
  roda `setStatus(em_atendimento)` e só depois (`:116`) a guarda de IA desligada. Com a IA OFF, um lead
  outbound do Meta fica marcado "em atendimento" sem opener enviado e sem humano atuando — incoerente
  com `handleInbound`, que retorna antes do setStatus. Mover a checagem do toggle para antes do setStatus.
- **[L2] Telefone não é normalizado para E.164.** `app/api/leads/route.ts:42-49` guarda só-dígitos (sem
  `+`/DDI garantido), divergindo do CLAUDE.md e de `isSendablePhone` (`^\+?\d{8,15}$`). Lead manual sem
  DDI pode falhar num envio outbound futuro. `service_interest` também não tem cap de tamanho.
- **[L3] `sendUpdates=all` em todo arraste.** `src/crm/calendar.ts:330` — cada remarcação por drag (snap
  de 15 min) dispara e-mail de atualização aos convidados, inclusive o lead. Pode spammar em ajustes finos.
- **[L4] `getAgentEnabled` falha ABERTO.** `src/agent/config.ts:180-197` retorna `true` (IA respondendo)
  se a leitura de `integrations_config` der erro. Janela estreita (uma falha de banco quebraria
  `getOrCreateLead` antes), mas um kill-switch que falha religando merece atenção.
- **[L5] Topbar refaz `GET /api/leads` inteiro por busca e no mount.** `components/Topbar.tsx:167,209` —
  busca refaz o fetch da lista completa a cada query (debounce) e as notificações disparam 2 fetches no
  mount de toda página. Sem exposição nova (mesmo dataset do kanban, gate requireUser), só custo extra.
- **[L6] Todo evento manual pede sala do Google Meet.** `src/crm/calendar.ts:146-151` — `createEvent`
  sempre inclui `conferenceData.createRequest`, então até eventos internos/bloqueios ganham link do Meet.

### O que está OK (confirmado)
- Todas as rotas novas têm gate `requireUser` (leads POST, agente/status GET+POST, agenda GET/POST/PATCH/DELETE).
- Validação de input sólida: colorId restrito a "1".."11" no POST e no PATCH; `enabled` exige boolean;
  datas via `Date.parse`; `summary` não-vazio; status do lead validado contra `STATUS_LABELS`.
- IDOR/escopo: o modelo é **single-tenant** (uma conta Cranium, equipe interna) — leads/eventos não têm
  coluna de dono/tenant; qualquer membro opera o funil/agenda por design (coerente com `requireUser`).
  **Documentado como esperado**, não é defeito.
- Interruptor: `handleInbound` persiste a mensagem inbound e dedupa ANTES da checagem do toggle, e
  **não responde** quando OFF; default = ligado; AiToggle reverte o otimismo e avisa em erro.
- Agenda: `updateEvent` é PATCH parcial correto (drag manda só start/end → Google preserva colorId/Meet);
  `conferenceDataVersion=1` preserva o Meet; column-packing por clusters transitivos não produz
  sobreposição visual incorreta; drag reverte a posição e mostra toast em falha.
- `extendedProperties.private.leadId` grava o vínculo na **criação** (a falha é só na edição — M2).

**Próximo passo:** @devops push liberado (observações registradas). Endereçar M1/M2 (integridade/UX) e
decidir M3 (autorização do kill-switch) num follow-up.

---

## Story 5.2 — Auth + RBAC + AC5 e2e

**Veredicto: ⚠️ CONCERNS** (gate condicional: AC3/RLS depende de aplicar a migration 005) — Tessera (crm-qa) — 2026-06-28

### Runner executado
`scripts/test/ac5-negative.mjs` — runner HTTP que bate no dev server local (`npm run dev`), forja
sessão de **atendente** de teste via `@supabase/ssr` (cookies reais) e cria/promove o usuário de
teste com a service_role. **Rodado em 2026-06-28**, dev server `localhost:3000`, EXIT=0.

```
N*: 11 PASS · 0 FAIL · 0 PENDING   (não autenticado → 401 nas rotas /api · redirect /login na UI)
F*: 14 PASS · 0 FAIL · 0 PENDING   (atendente → 403 nos 12 endpoints requireAdmin · 200 nos GET user)
R*:  1 PASS · 0 FAIL · 3 PENDING   (R4 PASS=trigger 006 OK; R1/R2/R3 reprovam = RLS 005 não aplicada)
```

### Achado material — corrige premissa estaleira do contexto
- **Migration 006 (role-lock) ESTÁ aplicada** — R4 (atendente `PATCH /rest/v1/profiles {role:admin}`)
  retorna **403 / `42501`**. A story e a shared-context diziam "006 pendente": **desatualizado**.
- **Migration 005 (RLS) NÃO está aplicada** — provado com **sentinela**: semeei 1 lead + 1 message via
  service_role; a **anon key leu as duas linhas E conseguiu INSERIR** em `leads`. (O "0 linhas" de uma
  rodada anterior era falso-positivo: as tabelas estavam vazias.) Defense-in-depth de RLS está **off**;
  hoje a proteção dos dados de negócio é só o gate server-side (`lib/auth.ts`) + service_role.

### Acceptance Criteria
- **AC1 (login + middleware):** ✅ provado (N0 redirect `/login`; N1–N10 → 401 em `/api`).
- **AC2 (papéis persistidos + role-lock):** ✅ `profiles.role`; **trigger 006 confirmado aplicado** (R4).
- **AC3 (RLS em leads/messages):** ❌ **não atendido** — migration 005 não aplicada (R1–R3 provam vazamento via anon key).
- **AC4 (RBAC writes admin):** ✅ provado (F1–F12 → 403; F13a/b GET user → 200).
- **AC5 (teste negativo e2e):** ✅ **runner entregue e executado**; cobertura plena de N*/F*; RLS parcial (R4 ok, R1–R3 dependem de 005).

### Condição para PASS pleno (gate condicional)
1. **Aplicar `005-rls-business-tables.optional.sql`** no Supabase (RLS leads/messages/tags/…).
2. Re-rodar: `node scripts/test/ac5-negative.mjs` com `STRICT_RLS=1` → esperar **R1/R2/R3 → PASS** (anon 0 linhas + insert negado).
3. Pendência operacional: trocar a senha temporária do admin (`CraniumAdmin@2026`).

> O bloqueio de AC3/AC5-RLS é **migration não aplicada**, não defeito de código. N*/F* (o núcleo
> de auth+RBAC) passam 100% hoje. Sub-entrega config/dashboard de 2026-06-28 segue **✅ PASS** (linha própria).

---

## Story 3.3 — /api/webhook idempotente (god-node)

**Veredicto: ✅ PASS** (1 concern de segurança a endurecer antes do go-live; 1 nota de contrato) — Tessera (crm-qa) — 2026-06-25

### Checklist & gate
| Critério | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ EXIT=0 |
| Validação empírica (dev) | ✅ 22/22 |
| Sem regressão | ✅ `handleInbound` não alterado — herda dedupe (1.1), funil/AUTO_STATUSES, IA, reset follow-up |

### Respostas aos pontos do gate
- **(a) Síncrono antes do 200 (ADR-002):** ✅ `await handleInbound(messages[0])` e só então `ok(res)` (200). Sem fire-and-forget — correto para serverless (a função congela ao retornar).
- **(b) Dedupe real (1.1):** ✅ `handleInbound` → `addMessage(externalId)` → 23505 → `false` → encerra sem reprocessar nem responder. O webhook devolve **200 idempotente** na reentrega (handleInbound retorna sem throw). AC2 atendido.
- **(c) WARN sem `id` nativo:** ✅ `if (!req.body?.id) console.warn("[webhook] WARN: ... dedupe degradado; mapeie message.id ...")`. Endereça o concern do QA da 3.1.
- **(d) Header secret — segurança em prod:** ⚠️ **fail-open.** Quando `MAKE_WEBHOOK_SECRET` está vazio, o endpoint **aceita sem autenticação**. Documentado como conveniência de dev, mas é o ingress de produção (escreve leads/mensagens e dispara o agente Claude → custo). Se o secret for esquecido em prod, o webhook fica **aberto**. Inconsistente com o cron (3.4), que é **fail-closed**. Ver concern abaixo.
- **(e) Só processa `messages[0]`:** `parseMakeWebhook` sempre retorna **exatamente 1** item (constrói `[{...}]` a partir de `body.phone/text/id` de nível superior). Para o contrato definido (1 mensagem por POST) está correto. _Nota de contrato:_ se o cenário Make for configurado para enviar **batch** (>1 msg/POST), `parseMakeWebhook` + webhook precisariam iterar — hoje seria mal-interpretado. Documentar a premissa "1 mensagem por requisição".
- **(f) `maxDuration: 60`:** ✅ presente em `vercel.json` para `api/webhook.ts` (e cron).

### Observações
- **[CONCERN — segurança, endurecer antes do go-live] Auth do webhook é fail-open.** _Recomendação:_ em produção, exigir `MAKE_WEBHOOK_SECRET` (fail-closed) — ex.: se `NODE_ENV==='production'` e secret ausente → 401 (ou recusar boot com erro claro). Alinha com o padrão seguro já adotado no cron (3.4). Não-bloqueante para os ACs da story (que pedem só 405/400), mas é postura de segurança de um god-node de ingress. Pendência runtime `MAKE_WEBHOOK_SECRET` já rastreada na shared-context.
- **[NOTA] Contrato single-message** (item e) — documentar/forçar premissa de 1 msg/POST.

**Próximo passo:** @devops push (Wave 2). Endurecer auth fail-open antes do go-live de produção.

---

## Story 3.4 — /api/cron/followup + Vercel Cron

**Veredicto: ✅ PASS** — Tessera (crm-qa) — 2026-06-25

### Checklist & gate
| Critério | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ EXIT=0 |
| Jest (`src/followup/scheduler.test.ts`) | ✅ **6/6** (rodado por QA) |
| AC1–AC6 | ✅ cobertos |

### Respostas aos pontos do gate
- **(a) Auth sem bypass:** ✅ **fail-closed** — `if (!expected || authorization !== 'Bearer '+expected) return 401`. CRON_SECRET ausente → `!expected` → 401. Sem bypass. (Padrão seguro — o webhook 3.3 deveria seguir o mesmo.)
- **(b) Batch limit evita timeout:** ✅ `runFollowUpCheck(config.followupBatch=50)` → `listFollowUpCandidates(..., limit=50)` aplica `.limit(50)` no Supabase; `maxDuration: 60`. Limite documentado e configurável via `FOLLOWUP_BATCH`. _Nit:_ envios são sequenciais (`await` no laço) — 50 sends podem se aproximar do teto de 60s se o Make estiver lento; reduzir `FOLLOWUP_BATCH` ou aumentar a frequência se aparecer timeout.
- **(c) 6 testes cobrem os casos certos:** ✅ (1) intervalo vencido → 1 retomada; (2) claim falso (respondeu) → não envia, skip; (3) `count=2/max=3` → `perdido`; (4) dentro do intervalo → pulado sem claim; (5) falha de envio na última → `errors++` mas ainda `perdido`; (6) 2 leads → 2 retomadas independentes. Cobre AC6 + resiliência da 1.3.
- **(d) GET+POST exigem secret:** ✅ o gate de auth roda após o filtro de método, para ambos GET e POST — sem caminho method-specific que escape.
- **AC4:** `node-cron`/`startFollowUpEngine` marcados dev-only (só `src/index.ts`); nenhum handler `api/` os importa. ✅

### Observações
- **[NIT]** Envios sequenciais no lote (ver item b) — monitorar latência vs `maxDuration`.

**Próximo passo:** @devops push (Wave 2). **Fecha a Wave 2.**

---

## Story 3.2 — Scaffold serverless (Express → funções /api)

**Veredicto: ✅ PASS** (1 concern a verificar antes do deploy; 2 nits) — Tessera (crm-qa) — 2026-06-25

### 8-Point Checklist
| # | Critério | Resultado |
|---|---|---|
| 1 | Code review | ✅ helpers `_lib` enxutos, handlers uniformes, PT-BR |
| 2 | Unit tests | ⚠️ sem testes automatizados (AC5 = deploy preview, fora do gate → pendente) |
| 3 | Acceptance criteria | ✅ AC1–AC4 cobertos; AC5 (deploy) pendente (setup Vercel do usuário) |
| 4 | Sem regressões | ✅ 7 rotas fiéis ao `routes/api.ts`; frontend `public/app.js` casa com os paths |
| 5 | Performance | ✅ client Supabase reusado stateless-safe; sem node-cron no caminho serverless |
| 6 | Security | ✅ `serverError` loga server-side e devolve só `message` (sem stack) |
| 7 | Documentação | ✅ placeholders 501 documentados com a story-alvo |
| 8 | Contratos de API | ✅ paths e payloads preservados |

### `npx tsc --noEmit`: ✅ EXIT=0 (confirmado por QA)

### Respostas aos pontos do gate
1. **Fidelidade das 7 rotas:** comparadas 1:1 com `routes/api.ts` — `leads` (`{leads,statusLabels}`), `leads/:id` (`{lead,messages}`+404), `reply` (sendText+addMessage+humano, 400 texto vazio), `status` (`validateStatus`+404), `takeover`/`release` (setStatus+404), `edit` (updateLeadFields+404). Lógica idêntica, delegando ao `src/`. **Sem regressão** — e ainda endurecidas com `guardMethod` (405) e `requireId` (400), necessários no modelo serverless (Vercel roteia todos os métodos ao mesmo handler). ✅
2. **`requireId(req.query.id: string|string[])`:** `typeof id === "string" && id.length > 0 ? id : null` — narrowing correto; caso `string[]` (query duplicada) → `null` → 400 (rejeita defensivamente em vez de mal-interpretar). Para path param `[id]`, o Vercel entrega string. ✅
3. **guardMethod + try/catch:** todos os 7 handlers chamam `guardMethod` primeiro e envolvem a lógica em try/catch → `serverError`, que **loga `console.error` server-side e devolve só `e.message`** (sem stack trace vazado). ✅
4. **`_lib/supabase.ts` stateless-safe:** re-exporta o singleton de `src/db.ts` (`createClient` com `persistSession:false, autoRefreshToken:false`) — sem pool mutável, reusável entre invocações warm. Nenhum handler importa `followup/scheduler`/node-cron (grep confirma). ✅ AC4.
5. **vercel.json:** `functions` runtime `@vercel/node@5` válido; `_lib/` excluído do roteamento pela convenção de prefixo `_` (não vira endpoint); cron `path:/api/cron/followup` casa com `api/cron/followup.ts`. `public/` servido por static zero-config. ✅ — _exceto o item de concern abaixo._
6. **Placeholders 501:** `webhook.ts` e `cron/followup.ts` retornam 501 com mensagem clara apontando a story-alvo; não importam nada pesado, não quebram. ✅
7. AC5 (deploy preview) — **pendente** (setup Vercel do usuário, fora do gate). 501s não penalizados (3.3/3.4 em implementação).
8. `tsc` EXIT=0. ✅

### Observações
- **[CONCERN — verificar antes do deploy] `comment` em `crons[]` do `vercel.json`.** O schema de cron do Vercel aceita oficialmente apenas `path` e `schedule`; propriedade extra (`comment`) pode disparar erro de validação no deploy ("should NOT have additional properties") e **quebrar o AC5**. _Ação:_ mover a nota para um comentário fora do array `crons` (ou remover) antes do primeiro deploy. Falha barulhenta e trivial de corrigir — não-bloqueante para o scaffold, mas precisa ser resolvida antes de validar o deploy.
- **[NIT] Doc do placeholder `webhook.ts` desalinhada com a 3.1:** o comentário diz contrato `{ phone, name, text, external_id }`, mas a 3.1 definiu o contrato de entrada como `{ phone, name?, text, id? }` (campo `id`, não `external_id`). A 3.3 deve consumir `parseMakeWebhook` (que lê `id`). Alinhar para evitar divergência de campo.
- **[NIT] `health.ts` sem `guardMethod`:** responde a qualquer método. Trivial (liveness), severidade mínima; opcionalmente restringir a GET por consistência.

**Próximo passo:** @devops push (quando a Wave 2 fechar). Resolver o `comment` do `vercel.json` antes do deploy de preview (AC5).

---

## Story 3.1 — Adapter de canal: Evolution → Make

**Veredicto: ✅ PASS** (1 concern encaminhado p/ 3.3; 1 nit) — Tessera (crm-qa) — 2026-06-25

### 8-Point Checklist
| # | Critério | Resultado |
|---|---|---|
| 1 | Code review | ✅ branch claro, PT-BR, refactor in-place (zero churn de imports) |
| 2 | Unit tests | ✅ 27/27 assertions empíricas (dev); sem framework (decisão de equipe → backlog) |
| 3 | Acceptance criteria | ✅ AC1–AC5 cobertos |
| 4 | Sem regressões | ✅ AC4: assinatura/import de `sendText` inalterados nos 3 callers |
| 5 | Performance | ✅ N/A (1 fetch por envio) |
| 6 | Security | ✅ `makeWebhookSecret` só declarado (validação fica na 3.3); sem segredo no front |
| 7 | Documentação | ✅ contrato do Make + riscos do hash documentados no código |
| 8 | Contratos de API | ✅ contrato de entrada do Make definido sem implementar a rota (fronteira 3.3) |

### `npx tsc --noEmit`: ✅ EXIT=0 (confirmado por QA)

### Respostas aos pontos do gate
1. **AC4 (zero mudança nos callers):** `grep` confirma — `handler.ts`, `followup/scheduler.ts`, `routes/api.ts` mantêm `import { sendText } from ".../whatsapp/evolution"` e a chamada `sendText(phone, text)`. Assinatura `sendText(phone: string, text: string): Promise<void>` inalterada. ✅
2. **sendText branch Make:** payload exatamente `{ phone, text }` (`evolution.ts:30`). **D1:** o branch é *gated* por `if (config.makeSendUrl)` — não há como entrar no branch Make com `makeSendUrl` vazio (vazio → fallback Evolution). Logo, sem falha silenciosa *dentro* do branch. `makeSendUrl` truthy mas inválido → `fetch` rejeita → `throw` propagado ao caller (que trata). ✅ _Nit de observabilidade:_ em produção, se `MAKE_SEND_URL` for esquecido, `sendText` cai no Evolution silenciosamente (que então falha na conexão com mensagem "Evolution", não "Make") — confuso, mas não silencioso. Baixa severidade.
3. **parseMakeWebhook hash:** determinístico ✅ — `sha256(phone|text|floor(epochMs/1000))`: mesmo phone+text no **mesmo segundo** → mesmo `externalId`. Risco de falso-positivo (mensagem idêntica 2x no mesmo segundo → 2ª dropada) **documentado** no código. `fromMe:false` é seguro — Make só encaminha mensagens do lead; saídas vão por `sendText` (documentado). ✅ Payload inválido (sem phone/text) → `[]`. ✅
4. **Fronteira 3.3:** `parseMakeWebhook` só **exportada** (nenhum caller); `makeWebhookSecret` só **declarado** no config (sem lógica de validação); `routes/webhook.ts` **não** foi tocado (sem rota `/api/webhook`). 3.1 deixou o contrato pronto sem invadir a 3.3. ✅
5. `tsc` EXIT=0. ✅

### Observações
- **[CONCERN → encaminhar p/ Story 3.3] Dedup do fallback por hash é best-effort (só mesmo-segundo).** O hash quantiza por `epoch_segundos`, então um **retry do Make que chegue >1s depois** (cenário comum de retry) cai em outro bucket → `externalId` diferente → **não deduplica** → mensagem duplicada. A idempotência confiável depende do **wamid `id`** (caminho recomendado). A story documenta o falso-positivo, mas o **falso-negativo** (retry >1s não-deduplicado) é o risco prático. _Mitigação já rastreada:_ mapear `message.id` (wamid) como `id` no cenário Make (pendência do usuário na shared-context). **A Story 3.3 (webhook idempotente) deve assumir que `id` está presente; sem ele, o dedup é fraco.** Não-bloqueante para a 3.1 (que é só o adapter/contrato e cumpre seus ACs).

**Próximo passo:** @devops push (quando a Wave 2 fechar). Concern do dedup roteado para a 3.3.

---

## Story 2.2 — Rewrite da persistência para Supabase

**Veredicto: ✅ PASS** (aprovado para push, 2 nits não-bloqueantes) — Tessera (crm-qa) — 2026-06-25

### 8-Point Checklist
| # | Critério | Resultado |
|---|---|---|
| 1 | Code review | ✅ async/await consistente, colunas explícitas, semântica preservada |
| 2 | Unit tests | ✅ e2e contra Supabase real: 29/29 assertions (crm-data) + caminho HTTP confirmado pelo lead |
| 3 | Acceptance criteria | ✅ AC1–AC6 cobertos |
| 4 | Sem regressões | ✅ idempotência (1.1) e claim atômico+fix #12 (1.3) preservados no client JS |
| 5 | Performance | ✅ sem N+1; `listFollowUpCandidates` filtra no servidor; índices no schema (`idx_leads_followup`, `idx_messages_lead`) |
| 6 | Security | ✅ service_role só em `db.ts` (server); ausente em `public/`; `.env` gitignored (só `.env.example` rastreado) |
| 7 | Documentação | ✅ story documenta decisões D1–D4 e equivalências |
| 8 | Contratos de API | ✅ assinaturas públicas preservadas (sync→async); 7 rotas com try/catch |

### `npx tsc --noEmit`: ✅ EXIT=0 (confirmado por QA)

### Respostas aos pontos do gate
1. **Async:** todos os `await` presentes; nenhuma promise flutuante — entrypoints (`webhook`→`handleInbound`, cron→`runFollowUpCheck`) têm `.catch`. As 7 rotas em `api.ts` são `async` com `try/catch` repassando `500 {error}`. `handler.ts` ganhou guarda `if (!fresh) return`. _Sem `Promise.all` necessário_: não há query de "counts" (listLeads retorna só leads); em `/leads/:id` os dois reads são sequenciais (getLead serve de guard 404) — correto, oportunidade menor de paralelizar (não-bloqueante).
2. **D1 `claimFollowUp`:** `last_message_at: now` **presente** no SET (fix #12 não regrediu); optimistic lock completo (`.eq('follow_up_count', expectedCount)` + `.lt(..., maxCount)` + `last_direction='out'` + `last_message_at < intervalAgo`). Sob Postgres READ COMMITTED o lock é **robusto**: UPDATE concorrente bloqueado re-avalia o qual `follow_up_count = expectedCount` (EvalPlanQual) e atualiza 0 linhas → `data.length===0` → false. ✅
3. **D2 `getOrCreateLead`:** select→insert→fallback `23505` re-seleciona por `phone` com `.single()` (linha existe após violação de unique → exatamente 1). Erro não-23505 → `throw`. ✅
4. **D3 `addMessage`:** dedup por `error.code === '23505'` → `return false`; **qualquer outro erro → `throw error`** (relança). ✅
5. **Sem resquícios:** `grep` em `src/` não encontra `node:sqlite`/`DatabaseSync`/`parseSqliteDate`/`randomUUID`/`crm.db`/`prepare(`/`INSERT OR IGNORE` (apenas 1 comentário descritivo em `db.ts`). ✅
6. **Segurança:** service_role só server-side; `public/` sem referência a supabase/service_role; `.gitignore` cobre `.env` e `data/*.db`; só `.env.example` rastreado. ✅
7. **Colunas explícitas:** `LEAD_COLS`/`MSG_COLS` em todos os SELECTs; nenhum `select('*')`. ✅ (AC4)
8. `tsc --noEmit` EXIT=0. ✅

### Observações (nits não-bloqueantes — hardening de robustez)
- **[NIT] UPDATE secundário de `addMessage` sem checagem de erro** (`leads.ts:88-91`): após inserir a mensagem, o `update({last_direction,last_message_at})` não captura erro e a função retorna `true` de qualquer forma. Num cenário raro de erro nesse UPDATE, a mensagem é persistida mas `last_message_at` não avança — afeta a cadência de follow-up, sem corromper dados. Sugestão: checar `error` e logar/propagar.
- **[NIT] UPDATE de `name` em lead existente sem checagem de erro** (`leads.ts:28`): `existing.name` é atualizado em memória e retornado mesmo se o UPDATE falhar (divergência cosmética memória×DB). Baixa severidade.
- _Ambos são caminhos de erro raros; não impedem o PASS. Candidatos a hardening num follow-up._

### Validação de concorrência (revisão de código + modelo Postgres)
Não reexecutei teste empírico local (camada agora é Supabase remoto; e2e do crm-data já cobriu happy path + dedup `23505` + optimistic lock). A análise de corretude do claim sob READ COMMITTED confirma a semântica de claim único.

**Próximo passo:** @devops push. **Fecha a Wave 1.**

---

## Story 1.3 — Update atômico no motor de follow-up

**Veredicto: ✅ PASS** (revisado após correção do delta na task #12 — 2026-06-25)

> Histórico: 1ª passada = ⚠️ CONCERNS (janela de concorrência aberta). O delta foi corrigido na origem e re-verificado (ver "Re-verificação do delta" abaixo) → **upgrade para PASS**.

### Re-verificação do delta (task #12)
`claimFollowUp` agora inclui `last_message_at = datetime('now')` no SET do UPDATE atômico; `incrementFollowUp` removido. Re-rodado o suite empírico contra a lógica corrigida:
| Cenário | Resultado | Esperado |
|---|---|---|
| **WINDOW (janela fechada):** claim 0→1, depois claim sequencial imediato 1→2 | w1=**true**, w2=**FALSE**, count=1 | 2º claim rejeitado (após 1º, `last_message_at=now` → guard rejeita) ✅ |
| AC2: 2 claims simultâneos, mesmo `expectedCount=3` | a=true, b=**false**, count=4 | só 1 vence ✅ (sem regressão) |
| AC3: lead respondeu (`last_direction='in'`) | claim=**false**, count=2 | rejeitado ✅ (sem regressão) |
| **Cadência legítima:** claim 0→1; re-claim imediato; envelhece >intervalo; re-claim | r1=true, imediato=**false**, pós-intervalo=**true** | retomada legítima após intervalo ainda funciona ✅ |
| `incrementFollowUp` removido | `grep` → 0 referências | sem caller órfão ✅ |
| `npx tsc --noEmit` | EXIT=0 | ✅ |

**Conclusão:** a janela de envio múltiplo entre ciclos de cron sobrepostos está **fechada** — após um claim, `last_message_at=now` reinicia o relógio do intervalo, então o próximo claim só vence depois de decorrido `followupIntervalMs`. A cadência entre retomadas legítimas é preservada (o bump no claim antecede o de `addMessage` em milissegundos, irrelevante frente ao intervalo). Sem regressão em AC2/AC3.

### 8-Point Checklist
| # | Critério | Resultado |
|---|---|---|
| 1 | Code review | ✅ PT-BR, convenções mantidas; `claimFollowUp` claro, semântica Postgres documentada |
| 2 | Unit tests | ⚠️ Nenhum teste automatizado no repo (AC5) — gap cross-story, suprido por verificação empírica de QA |
| 3 | Acceptance criteria | ✅ AC1–AC4 implementados e verificados empiricamente; AC5 (concorrência) verificado por QA |
| 4 | Sem regressões | ✅ Fluxo follow-up intacto; `setStatus('perdido')` fora do try/catch |
| 5 | Performance | ✅ Pre-filtro JS evita round-trip; UPDATE único atômico, sem N+1 |
| 6 | Security | ✅ SQL parametrizado; sem PII em log |
| 7 | Documentação | ✅ Story descreve mecanismo + equivalência Postgres `UPDATE ... RETURNING` |
| 8 | Contratos de API | ✅ N/A (motor interno, sem endpoint) |

### `npx tsc --noEmit`: ✅ EXIT=0 (confirmado por QA)

### Verificação empírica (supre AC5) — reprodução com `node:sqlite`
| Cenário | Resultado | Esperado |
|---|---|---|
| AC2: 2 claims paralelos, mesmo `expectedCount=3` | claimA=true, claimB=**false**, count=4 | só 1 claima ✅ |
| AC3: lead respondeu (`last_direction='in'`) antes do claim | claim=**false**, count inalterado | rejeitado ✅ |
| AC4: claim com `follow_up_count = MAX` | claim=**false** | bloqueado por `count < max` ✅ |
| Intervalo não decorrido (10s < 60s) | claim=**false** | guard de intervalo ✅ |

### Respostas aos pontos do gate
1. **AC2 (optimistic lock):** `follow_up_count = expectedCount` na cláusula WHERE garante que, de dois claims lendo o mesmo estado pré-claim, só o primeiro encontra `count == expected`; o segundo vê `count = expected+1` → 0 linhas → `changes=0` → retorna false. ✅ `changes > 0` correto.
2. **AC3:** lead responde → webhook chama `addMessage(...,'in')` (vira `last_direction='in'`) + `resetFollowUp` (count=0). Claim falha por **duas** condições (`last_direction='out'` E `follow_up_count=expectedCount`). ✅
3. **AC4:** `setStatus('perdido')` está **fora** do try/catch → roda mesmo se `sendText` lança. Counter já incrementado pelo claim + status perdido → lead não é reselecionado (`count < max` falso E status fora de AUTO_STATUSES). ✅
4. **Race claim×send:** texto computado antes do claim; claim falho → `continue`, nada enviado. Sem duplicação **dentro de um ciclo**. ✅
5. **`newCount`:** `lead.follow_up_count + 1` derivado do valor pré-claim; como o claim só vence se DB == expectedCount, pós-claim o DB vale exatamente `newCount`. Não relê do banco → sem race de releitura. ✅
6. `tsc` EXIT=0. ✅

### Observações
- **[RESOLVIDO ✅] Janela de envio múltiplo entre ciclos de cron sobrepostos** — corrigido na task #12: `claimFollowUp` agora reescreve `last_message_at = datetime('now')` ao vencer, reiniciando o relógio do intervalo. Re-verificado: 2º claim sequencial imediato falha (teste WINDOW acima). Janela fechada também para o caso multi-instância (Story 3.4 não precisa mais carregar este risco).
- **[RESOLVIDO ✅] `incrementFollowUp` dead code** — removido na task #12; `grep` confirma 0 referências, sem caller órfão.
- **[CONCERN] AC5 sem teste automatizado** no repo (mesmo gap das 1.1/1.2); supri por reprodução empírica. Permanece como item de backlog cross-story (suíte de testes de regressão), **não-bloqueante**.

**Próximo passo:** @devops push. **Fecha a Wave 0** (sujeito ao cleanup #10 do db.ts, em paralelo).

---

## Story 1.2 — Lead.id / Message.id → string (UUID)

**Veredicto: ⚠️ CONCERNS** (aprovado para push, observações documentadas)

### 8-Point Checklist
| # | Critério | Resultado |
|---|---|---|
| 1 | Code review | ✅ PT-BR, convenções mantidas; `randomUUID` de `crypto`, INSERT com id explícito |
| 2 | Unit tests | ⚠️ Nenhum teste automatizado (AC5 "smoke test" sem regressão no repo) |
| 3 | Acceptance criteria | ✅ AC1–AC4 implementados; AC5 (smoke) verificado por QA empiricamente |
| 4 | Sem regressões | ✅ Todos os consumers de `id` (handler, agent, scheduler, api) usam id como valor opaco tipado; sem `parseInt`, sem comparação string×number |
| 5 | Performance | ✅ Sem impacto; PK TEXT |
| 6 | Security | ✅ UUID v4 (não sequencial → não enumerável); SQL parametrizado |
| 7 | Documentação | ✅ File List da story correta |
| 8 | Contratos de API | ✅ `GET/POST /leads/:id` agora aceita UUID string direto (sem parseInt) |

### `npx tsc --noEmit`: ✅ EXIT=0 (confirmado por QA) · Node v26 · target ES2021 · `@types/node ^24`
`crypto.randomUUID()` disponível e funcional (estável desde Node 16). ✅ AC4.

### Verificação empírica (supre AC5)
Reproduzido com `node:sqlite` + schema TEXT idêntico:
- Detecção de schema legado (PRAGMA `id`=INTEGER) → **true** na 1ª vez; após DROP+recreate (TEXT) → **false** (idempotente, dropa só 1x). ✅
- DB vazio/fresh → detecção **false**, cria schema TEXT sem dropar. ✅
- UUID insert/select round-trip + FK `messages.lead_id` (string) → OK. ✅

### Consistência de tipos (item 3)
Grafo de chamadas todo coerente: `lead.id`/`fresh.id` propagados para `addMessage`/`resetFollowUp`/`getMessages`/`setStatus`/`updateLeadFields`/`incrementFollowUp` — todas tipadas `string`. `block.id` em `agent/agent.ts:109` é `tool_use_id` da Anthropic (não relacionado a Lead). Nenhuma aritmética/comparação numérica de id. `routes/api.ts` removeu `parseInt`. ✅

### Observações
- **[CONCERN] DROP + recreate destrutivo sem backup** (`src/db.ts:15-27`): roda no boot; se detecta INTEGER PKs, **apaga `leads` e `messages`** e recria. Validado como migração one-time (idempotente após recriar). Aceitável no escopo de protótipo (decisão do lead: Wave 0 fica no protótipo, sem dados de produção) e **avisado no console**. _Risco:_ quem já rodou o protótipo perde os dados locais sem recuperação. _Sugestão (não-bloqueante):_ renomear para `leads_legacy_<ts>`/backup do arquivo `crm.db` em vez de DROP, ou guardar atrás de flag de ambiente, antes de qualquer ambiente com dados que importem.
- **[NIT não resolvido] catch amplo da migração** (`src/db.ts:59-63`): o NIT levantado na 1.1 **persiste**. Agora a coluna `external_id` já está no CREATE TABLE, tornando o `ALTER TABLE` redundante para schemas novos/recriados — o `try/catch {}` segue engolindo qualquer erro. Baixa severidade; candidato a limpeza no follow-up.
- **[CONCERN] AC5 sem teste automatizado** no repo (sem suíte/script `test`). Supri por verificação empírica; mesmo gap da 1.1.

**Próximo passo:** @devops push (observações documentadas).

---

## Story 1.1 — Idempotência por external_id

**Veredicto: ⚠️ CONCERNS** (aprovado para push, observações documentadas)

### 8-Point Checklist
| # | Critério | Resultado |
|---|---|---|
| 1 | Code review (patterns/legibilidade) | ✅ PT-BR, convenções mantidas, código limpo |
| 2 | Unit tests | ⚠️ Nenhum teste automatizado no repo (AC4 sem regressão automatizada) |
| 3 | Acceptance criteria | ✅ AC1/2/3/5 implementados; AC4 verificado por QA (manual) |
| 4 | Sem regressões | ✅ Fluxo receber→IA→responder→persistir intacto; callers de `addMessage` (followup, api, 'out') passam externalId nulo → inserem normalmente |
| 5 | Performance | ✅ Índice único parcial, sem N+1, sem blocking calls novos |
| 6 | Security | ✅ `INSERT OR IGNORE` parametrizado, sem injection; log expõe só external_id (não-PII) |
| 7 | Documentação | ✅ File List e Quality Gate da story corretos |
| 8 | Contratos de API | ✅ Webhook inalterado |

### Verificação empírica do mecanismo (QA, supre AC4)
Reproduzido com o mesmo engine `node:sqlite` + índice único parcial idêntico:
- Mesmo `external_id` 2x → 2ª inserção `changes=0` → dedup (1 linha). ✅ → handler faz early-return → **1 única resposta ao lead**.
- `external_id` NULL inserido 3x → 3 linhas (índice parcial não deduplica nulos). ✅ AC5.
- `external_id` diferente → insere. ✅
- Total: 5 linhas / ABC123: 1 / NULL: 3 — exatamente o esperado.

### Corretude do dedup
- **Race in-process:** `node:sqlite` (DatabaseSync) é síncrono; a decisão de dedup (`INSERT OR IGNORE` + checagem de `changes`) executa inteiramente **antes do primeiro `await`** em `handleInbound`. Duas entregas concorrentes não interleavam no nível JS → segunda vê o conflito. Race-safe.
- **Cross-process:** índice `UNIQUE` garante 1 linha independente de concorrência; apenas um INSERT obtém `changes=1`.
- **external_id null/vazio:** `key.id ?? ""` na borda → `msg.externalId || undefined` no handler → `null` no banco. Mensagens sem id **inserem** (não deduplicam demais) e **não quebram**. Fail-open correto (melhor não deduplicar que deduplicar demais).

### `npx tsc --noEmit`: ✅ EXIT=0 (confirmado por QA)

### Observações (não-bloqueantes)
- **[CONCERN] Sem teste automatizado para AC4** (`src/` não tem suíte de testes; `package.json` sem script `test`). AC4 é explicitamente "verificação manual ou por QA" — supri por reprodução empírica, mas como é **god-node crítico antes de ligar o canal real**, uma alteração futura em `leads.ts`/`db.ts` pode quebrar o dedup silenciosamente. _Sugestão:_ adicionar teste de integração (2x mesmo payload → 1 linha + 1 envio) numa próxima story de hardening.
- **[NIT] `catch {}` amplo na migração** (`src/db.ts:45-49`): engole qualquer erro do `ALTER TABLE`, não só "duplicate column". Idioma padrão para migração incremental SQLite; aceitável, mas mascara falhas reais. Baixa severidade.

**Próximo passo:** @devops push (observações documentadas).
