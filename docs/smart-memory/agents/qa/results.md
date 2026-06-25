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

| Story | Data | Veredicto | Issues | Agente |
|---|---|---|---|---|
| 1.1 | 2026-06-25 | ⚠️ CONCERNS | 1 concern (falta teste automatizado AC4); 1 nit (catch amplo na migração) | tessera (crm-qa) |
| 1.2 | 2026-06-25 | ⚠️ CONCERNS | DROP+recreate destrutivo sem backup; NIT catch amplo (1.1) não resolvido; sem teste automatizado AC5 | tessera (crm-qa) |
| 1.3 | 2026-06-25 | ✅ PASS | janela de concorrência fechada na origem (task #12: `last_message_at` no claim); `incrementFollowUp` removido. Gap de teste automatizado AC5 → backlog cross-story | tessera (crm-qa) |

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
