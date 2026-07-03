---
title: "QA Review — Story 5.2 (AC5 + tela /config + dashboard)"
type: project
agent: tessera (crm-qa)
created: 2026-06-28
updated: 2026-06-28
tags: [qa, quality-gate, auth, rbac, rls, story-5.2, ac5, config, dashboard]
related: ["[[stories/active/5.2-auth-rbac-interno]]", "[[agents/qa/results]]", "[[shared-context]]"]
---

# QA Review — Story 5.2 · AC5 (teste negativo) + trabalho de hoje (config/dashboard)

> Revisão read-only. Nenhum código foi alterado. Data: 2026-06-28 · Tessera (crm-qa).

---

## TASK A — Desenho do AC5

> AC5: "Requisição não autenticada e usuário sem papel são negados (auth + RLS), validado e2e."

### A.1 — Matriz de gates por endpoint (`app/api/**`)

Auditado por contagem de chamadas **reais** `await requireUser()` / `await requireAdmin()`
(não por menção em comentário — três rotas citam `requireUser` só no comentário e foram
classificadas pelo seu mecanismo real de proteção).

| Endpoint | Métodos · Gate | Classe |
|---|---|---|
| `agente/config` | GET=user · POST=admin | misto |
| `agente/preview` | POST=admin | admin |
| `bi/metrics` | GET=user | user |
| `checklist/[itemId]` | PATCH,DELETE=user | user |
| `email/campaigns` | GET,POST=user | user |
| `email/campaigns/[id]` | GET,PATCH,DELETE=user | user |
| `email/campaigns/[id]/send` | POST=admin | admin |
| `email/config` | GET=user · PUT=admin | misto |
| `email/contacts/[id]` | DELETE=user | user |
| `email/lists` · `lists/[id]` · `lists/[id]/contacts` | user | user |
| `email/preview` | POST=user | user |
| `email/templates` · `templates/[id]` | user | user |
| `email/test` | POST=admin | admin |
| `followups` · `followups/[id]` | user | user |
| `followups/cadence` | GET=user · POST=admin | misto |
| `integrations/evolution/config` | GET=user · POST=admin | misto |
| `integrations/evolution/connect` | POST=admin | admin |
| `integrations/evolution/disconnect` | POST=admin | admin |
| `integrations/evolution/status` | GET=user | user |
| `integrations/google/auth` | GET=admin | admin |
| `integrations/google/status` | GET=user | user |
| `integrations/meta/config` | GET=user · POST=admin | misto |
| `integrations/meta/import` | POST=admin | admin |
| `leads` · `leads/[id]` · `leads/[id]/{edit,release,reply,status,takeover,tags,checklist}` | user | user |
| `profile` | GET,PATCH=user | user |
| `tags` · `tags/[id]` | user | user |

#### Públicos por design (sem `requireUser`, com auth de máquina própria)

| Endpoint | Proteção real | Veredicto |
|---|---|---|
| `health` | nenhuma (liveness) | OK |
| `leadgen` | HMAC `x-hub-signature-256` (Meta) **ou** `x-make-secret`/`?token=` em `timingSafeEqual` | OK |
| `webhook` | token Evolution (`?token=` / header `apikey`); **fail-closed em produção** | OK |
| `cron/followup` | `Authorization: Bearer CRON_SECRET`; **fail-closed** (401 se secret ausente) | OK |
| `email/unsubscribe` | público (link do e-mail) | OK |
| `email/track/click` · `email/track/open` | público (pixel/redirect de rastreio) | OK |
| `integrations/google/route` | só `redirect` → `/google/auth` (que é admin) — não executa ação | OK |
| `integrations/google/callback` | **CSRF state cookie httpOnly** setado no `/auth` (admin) — não usa `requireUser` | OK (ver A.4-C2) |

**Conclusão A.1:** nenhum endpoint sensível ficou sem gate. Todos os que GRAVAM
credenciais/segredos (evolution/meta/email config-write, connect/disconnect, import,
google/auth, agente/config-write, campaign send, email/test) exigem **admin**. Os GET de
config retornam **status mascarado** (`hasApiKey`, `hasAppSecret`, `hasMakeSecret`…
booleans) — **não vazam segredo** ao `atendente`. O `requireUser` que aparece nos
comentários de `webhook`/`cron/followup`/`google/callback` é texto explicativo, **não**
chamada — esses três têm auth de máquina própria.

### A.2 — Suíte de testes negativos do AC5

#### (a) 401 — não autenticado nos endpoints `requireUser`
Sem cookie de sessão Supabase, todo handler `requireUser` deve responder `401 {"error":"nao autenticado"}`.

| # | Entrada | Esperado |
|---|---|---|
| N1 | `GET /api/leads` sem cookie | 401 |
| N2 | `GET /api/leads/{id}` sem cookie | 401 |
| N3 | `POST /api/leads/{id}/reply` sem cookie | 401 |
| N4 | `GET /api/bi/metrics` sem cookie | 401 |
| N5 | `PATCH /api/profile` sem cookie | 401 |
| N6 | `GET /api/tags` · `POST /api/tags` sem cookie | 401 |
| N7 | `GET /api/followups` sem cookie | 401 |
| N8 | `GET /api/email/templates` sem cookie | 401 |
| N9 | `GET /api/integrations/evolution/status` sem cookie | 401 |
| N10 | (amostra de regressão) qualquer rota `user` da matriz sem cookie | 401 |

#### (b) 403 — autenticado **não-admin** (`atendente`) nos endpoints `requireAdmin`
Com sessão de um usuário `role='atendente'`, todo handler `requireAdmin` deve responder `403 {"error":"requer admin"}`.

| # | Entrada (sessão atendente) | Esperado |
|---|---|---|
| F1 | `POST /api/integrations/evolution/connect` | 403 |
| F2 | `POST /api/integrations/evolution/disconnect` | 403 |
| F3 | `POST /api/integrations/evolution/config` | 403 |
| F4 | `POST /api/integrations/meta/config` | 403 |
| F5 | `POST /api/integrations/meta/import` | 403 |
| F6 | `GET /api/integrations/google/auth` | 403 |
| F7 | `PUT /api/email/config` | 403 |
| F8 | `POST /api/email/test` | 403 |
| F9 | `POST /api/email/campaigns/{id}/send` | 403 |
| F10 | `POST /api/agente/config` | 403 |
| F11 | `POST /api/agente/preview` | 403 |
| F12 | `POST /api/followups/cadence` | 403 |
| F13 | **Contraprova:** mesma sessão atendente em `GET /api/agente/config` / `GET /api/email/config` | 200 (GET é `user`) |

#### (c) RLS — negação com anon key (defense-in-depth) — **PENDENTE de migration 005**
Depende da `005-rls-business-tables.optional.sql` ser aplicada (hoje **não aplicada**).

| # | Entrada (anon key direta na Data API) | Esperado pós-005 |
|---|---|---|
| R1 | `select * from leads` com anon key | 0 linhas |
| R2 | `select * from messages` com anon key | 0 linhas |
| R3 | `insert into leads` com anon key | negado/0 |
| R4 | **Auto-escalonamento (migration 006):** sessão atendente → `PATCH /rest/v1/profiles?id=eq.{self}` body `{"role":"admin"}` | erro `42501` (role só por service_role) |
| R5 | `profiles_self_select`: sessão usuário A → `select` da linha do usuário B | 0 linhas |

### A.3 — O que dá para rodar JÁ vs. o que precisa de DB/e2e

**Obstáculo de harness (relevante):** os gates vivem em `lib/auth.ts` (raiz, fora de
`src/`) e dependem de `@/lib/supabase/server` → `next/headers` (`cookies()`). O
`jest.config.js` atual só compila `src/**/*.test.ts` com `tsconfig.backend.json`
(`rootDir: src`, CommonJS) e **exclui `api/`**. Portanto:

- **NÃO roda no jest atual:** teste unitário direto de `requireUser`/`requireAdmin`
  (estão fora de `src/` e usam APIs de runtime do Next — `cookies()` não existe no
  ambiente node do ts-jest). Tentar importar quebra o typecheck do backend.
- **Roda já (unit, sem DB):** lógica pura extraível — `secretMatches`/`timingSafeEqual`
  do leadgen, `verifySignature` (Meta HMAC), validação de token do webhook/cron. (Parte
  já coberta em `src/crm/meta.test.ts`.) Útil como prova de que a auth de máquina é
  fail-closed.
- **Precisa de servidor rodando (e2e HTTP):** os casos N* e F* — subir `next dev`/preview
  e bater nos endpoints com/sem cookie e com sessão atendente. É o caminho fiel ao texto
  do AC5 ("validado e2e"). Recomendo um runner HTTP simples (script node/`fetch` ou
  Playwright) **fora** do jest do backend, OU um segundo projeto jest com `testEnvironment`
  apropriado e mocks de `next/headers`.
- **Precisa de DB + migration:** R1–R5 — só após aplicar **005** (RLS) e confirmar **006**
  (trigger role-lock, R4) no Supabase. Hoje: **bloqueado/pendente**.

**Recomendação de caminho mínimo para PASS do AC5:**
1. Aplicar 005 + confirmar 006 aplicada.
2. Script e2e cobrindo ≥1 caso por classe: N1, N5 (401), F1, F7, F9 (403), R4 (auto-escalonamento), R1 (anon key → 0 linhas).
3. Registrar saída no `results.md`.

### A.4 — Achados de segurança da matriz (informacionais)

- **[C1 · resolvido na origem]** Auto-escalonamento de `role`: a policy `profiles_self_update`
  (004) não restringe coluna; a **migration 006** (trigger `prevent_role_self_escalation`)
  fecha isso. **Confirmar que 006 está aplicada** (shared-context lista 002/003/004 como
  aplicadas, mas 006 não é citada).
- **[C2 · aceitável]** `google/callback` não usa `requireUser` — protegido por `state`
  CSRF (cookie httpOnly de uso único setado no `/auth`, que é admin). Padrão OAuth correto;
  o `code` só vale para o seu `client_id/secret`. Sem ação.
- **[NIT]** `GET /api/email/config` devolve `user`/`from` (usuário SMTP e remetente) em
  claro para qualquer autenticado. É username/e-mail, baixa sensibilidade — aceitável.

---

## TASK B — Review de segurança do trabalho de hoje (config + dashboard)

Arquivos: `app/api/profile/route.ts`, `components/ConfigModule.tsx`,
`app/(portal)/config/page.tsx`, `app/(portal)/page.tsx`, `components/DashboardHome.tsx`,
apoio `supabase/migrations/009-profile-settings.sql`.

### B.1 — IDOR / escopo por dono — OK
`PATCH /api/profile` lê `auth.user.id` do gate e aplica `.update(patch).eq('id', auth.user.id)`.
**Não aceita `id` do body** — impossível editar perfil alheio. GET idêntico (`.eq('id', auth.user.id)`).
Defense-in-depth: roda com anon key + sessão, sujeito à policy `profiles_self_update`.

### B.2 — Imutabilidade de `role` e `email` — OK
`PATCH` só monta `patch` a partir de `nome` e `avatar_url`; `role`/`email` **nunca** são
montados nem enviados. Mesmo se forjados no body, são ignorados (whitelist). Em profundidade:
trigger **006** bloqueia troca de `role` por não-service_role. `email` é `readOnly/disabled`
na UI e não tratado no handler. **Imutável aqui.**

### B.3 — Upload de avatar restrito à pasta própria — OK
Path do cliente: `${profile.id}/avatar-${Date.now()}.${ext}`. As policies de Storage
(009) `avatars_insert/update/delete_own` exigem `(storage.foldername(name))[1] = auth.uid()`
— a pasta é **forçada pelo banco**, não confiando no cliente. Mesmo trocando `profile.id`
no client, o insert numa pasta alheia é negado por RLS de Storage. `ext` sanitizado
(`replace(/[^a-z0-9]/g,'')`). Bucket é público só para **leitura** (avatar na sidebar).

### B.4 — Validação de input — OK (com nit)
- **nome:** server valida `typeof string`, `trim`, `1..80` chars → 400. UI espelha `maxLength={80}`.
- **avatar_url:** server aceita `string | null`. **[NIT]** não valida que é URL do bucket
  `avatars` — um autenticado poderia gravar um `avatar_url` arbitrário (ex.: URL externa)
  no **próprio** perfil. Impacto baixo (só o próprio avatar; sem XSS — renderizado via
  `<img src>`, não `dangerouslySetInnerHTML`). Sugestão futura: validar prefixo do bucket.
- **imagem:** validação client-side `type.startsWith('image/')` + `≤ 3 MB`. **[NIT]** o
  limite de tamanho/tipo é **só no cliente**; o gate real é a policy de Storage (pasta) e
  o `MAX_AVATAR_BYTES`. Considerar limite de tamanho no bucket no futuro. Não-bloqueante.
- **senha:** `≥ 8` + confirmação, via `supabase.auth.updateUser` (anon+sessão) — o servidor
  Supabase aplica a política real.

### B.5 — Vazamento de dado sensível no dashboard — OK
`DashboardHome` consome só `GET /api/bi/metrics` (gateado `requireUser`), que retorna
**agregados** (contagens, taxas, pipeline) — sem PII de lead. `firstName` vem do **próprio**
perfil (`.eq('id', user.id)`). Páginas `config` e `page` server-side fazem `getUser()` +
`redirect('/login')` se anônimo (redundante com o middleware — defense-in-depth). Sem mock:
banco vazio renderiza estado honesto.

### B.6 — Checklist 8 pontos (trabalho de hoje)
| # | Critério | Resultado |
|---|---|---|
| 1 | Code review / patterns | OK — whitelist de campos, escopo por `user.id`, comentários fiéis |
| 2 | Unit tests | **Ausentes** para `/api/profile` (limitação de harness, ver A.3) |
| 3 | Acceptance criteria | tela /config (foto+nome+senha) e dashboard atendem ao escopo |
| 4 | Sem regressões | não toca CRM/handler; isolado |
| 5 | Performance | sem N+1; `maybeSingle` por id (PK) |
| 6 | Security | sem IDOR, role/email imutáveis, storage por pasta, sem stack trace exposto |
| 7 | Documentação | migration 009 e comentários claros |
| 8 | Contratos de API | `/api/profile` novo, coerente |

---

## VEREDICTOS

### (1) Trabalho config/dashboard de hoje — ✅ PASS
```
VEREDICTO: PASS
Escopo: app/api/profile, ConfigModule, config/page, dashboard (page + DashboardHome), migration 009
Checklist: 7/8 (item 2 testes automatizados ausentes por limitação de harness — não-bloqueante)
Issues bloqueantes: nenhum
Nits (não-bloqueantes):
 - avatar_url aceita URL arbitrária do próprio usuário (sem validar prefixo do bucket)
 - limite de tipo/tamanho de imagem só no client (gate real é a policy de Storage)
Pré-condição operacional: aplicar migration 009 (bucket avatars + policies) no Supabase
Próximo passo: @devops pode prosseguir (nits documentados)
```

### (2) Story 5.2 como um todo — ⚠️ CONCERNS
```
VEREDICTO: CONCERNS
AC1 (login + middleware): ✅ middleware redireciona anônimo; matcher exclui /api, /login, estáticos
AC2 (papéis persistidos): ✅ profiles.role (admin|atendente), trigger handle_new_user
AC3 (RLS leads/messages): ⚠️ PENDENTE — migration 005 (opcional) NÃO aplicada; hoje a proteção é
     só o gate server-side + service_role. Defense-in-depth de RLS não está ligada.
AC4 (RBAC na UI/ações): ✅ ações sensíveis exigem requireAdmin nos endpoints; GET de config mascara segredos
AC5 (teste negativo e2e): ❌ NÃO há suíte automatizada executada — desenhada nesta review (A.2),
     mas não rodada. Falta e2e dos 401/403 + RLS (R4 auto-escalonamento, R1 anon key).

O QUE FALTA PARA PASS PLENO:
 1. Aplicar migration 005 (RLS leads/messages/tags/...) e confirmar 006 (role-lock) aplicada.
 2. Rodar a suíte AC5 (mín.: N1, N5 → 401 · F1, F7, F9 → 403 · R4, R1 → RLS) e registrar saída.
 3. Trocar a senha temporária do admin (CraniumAdmin@2026) — pendência operacional do go-live.
```

> Sem PASS pleno da 5.2, mas o **trabalho de hoje** está liberado. O bloqueio do AC5/AC3
> é de migration aplicada + e2e executado, não de defeito de código.
