# DEPLOY — Supabase → Vercel → Make

Guia passo a passo para colocar o CRM no ar em produção. Tempo estimado: ~30–45 min.

> Ordem importa por causa de uma dependência circular: o **Make** gera a URL de envio (`MAKE_SEND_URL`) que vai nas variáveis da **Vercel**; e a **Vercel** gera a URL (`/api/webhook`) que vai no cenário de entrada do **Make**. Por isso fazemos: Supabase → Make (criar webhooks) → Vercel (env + deploy) → Make (conectar a URL final).

---

## 0) Pré-requisitos (contas)

- [ ] Anthropic (chave da Claude) — https://console.anthropic.com
- [ ] Supabase — https://supabase.com
- [ ] Vercel — https://vercel.com (conectada à conta do GitHub `craniumdigitalia-eng`)
- [ ] Make — https://make.com (com WhatsApp conectado: número não-oficial via Evolution, 360dialog, ou o módulo que vocês usam)
- [ ] Repo: https://github.com/craniumdigitalia-eng/crm-whatsapp

---

## 1) Supabase (banco)

1. **New project** → escolha org, nome `crm-whatsapp`, defina a senha do banco, região mais próxima (ex: South America / São Paulo).
2. Aguarde provisionar (~2 min).
3. Menu lateral → **SQL Editor** → **New query** → cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) → **Run**. Deve criar as tabelas `leads` e `messages`.
4. Menu lateral → **Project Settings** → **API**. Anote:
   - **Project URL** → vira `SUPABASE_URL`.
   - **service_role** (em *Project API keys*, clique em "reveal") → vira `SUPABASE_SERVICE_ROLE_KEY`.
   - ⚠️ A `service_role` é **secreta** — só no servidor (Vercel). Nunca no front-end.

---

## 2) Make — criar o webhook de SAÍDA (envio no WhatsApp)

Esse cenário recebe `{ phone, text }` da Vercel e envia no WhatsApp.

1. **Create a new scenario**.
2. Primeiro módulo: **Webhooks → Custom webhook** → **Add** → nome `crm-enviar-whatsapp` → **Save**.
3. Copie a **URL do webhook** que o Make mostrar (ex: `https://hook.make.com/abc123...`). **Essa URL é o `MAKE_SEND_URL`.**
4. Segundo módulo: o módulo do **WhatsApp** que vocês usam → ação **enviar mensagem**.
   - Campo *número/para*: mapeie o `phone` que vem do webhook.
   - Campo *mensagem/texto*: mapeie o `text` que vem do webhook.
   - (O Make mostra esses campos depois que você dispara um teste; se precisar, clique em "Redetermine data structure" e mande um POST de teste com `{ "phone": "...", "text": "oi" }`.)
5. **Save** e deixe o cenário **ON** (ligado).

> Guarde o `MAKE_SEND_URL` — vai na Vercel no próximo passo.

---

## 3) Vercel (deploy das funções)

1. **Add New… → Project** → **Import** o repo `craniumdigitalia-eng/crm-whatsapp`.
2. Em **Framework Preset**, deixe **Other** (as funções ficam em `/api`, detectadas automaticamente). Não precisa de build command.
3. **Environment Variables** — adicione (Production):

   | Name | Value |
   |------|-------|
   | `ANTHROPIC_API_KEY` | sua chave da Claude |
   | `AGENT_MODEL` | `claude-opus-4-8` (ou `claude-sonnet-4-6` p/ baratear) |
   | `COMPANY_NAME` | `Cranium Digital` |
   | `SUPABASE_URL` | do passo 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | do passo 1 (secreta) |
   | `MAKE_SEND_URL` | do passo 2 |
   | `CRON_SECRET` | um valor aleatório (ex: gere com `openssl rand -hex 24`) |
   | `FOLLOWUP_MAX` | `30` |
   | `FOLLOWUP_INTERVAL` | `24` |
   | `FOLLOWUP_UNIT` | `hours` |

4. **Deploy**. Ao terminar, anote o domínio (ex: `https://crm-whatsapp.vercel.app`).
   - **URL de entrada (webhook):** `https://SEU-APP.vercel.app/api/webhook`

> **Vercel Cron:** o agendamento já está em [`vercel.json`](vercel.json) (de hora em hora). A Vercel injeta automaticamente `Authorization: Bearer <CRON_SECRET>` nas chamadas do cron, e a rota [`api/cron/followup.ts`](api/cron/followup.ts) valida isso. ⚠️ No plano **Hobby**, cron roda no máximo 1×/dia e só em Production; para de hora em hora, precisa do plano **Pro**.

---

## 4) Make — cenário de ENTRADA (mensagem recebida → Vercel)

Esse cenário escuta o WhatsApp e manda a mensagem pra Vercel.

1. **Create a new scenario**.
2. Primeiro módulo: o gatilho do **WhatsApp** que vocês usam → **watch messages / nova mensagem recebida**.
3. Segundo módulo: **HTTP → Make a request**:
   - **URL:** `https://SEU-APP.vercel.app/api/webhook`
   - **Method:** `POST`
   - **Body type:** `Raw` / `JSON (application/json)`
   - **Content:**
     ```json
     {
       "phone": "{{numero_do_lead}}",
       "name": "{{nome_do_lead}}",
       "text": "{{texto_da_mensagem}}"
     }
     ```
     (mapeie os 3 campos a partir dos dados do gatilho do WhatsApp; `phone` só com dígitos, ex: `5511999998888`.)
4. **Save** e deixe **ON**.

---

## 5) Testes

**Webhook (entrada) manual** — simule uma mensagem chegando:
```bash
curl -X POST https://SEU-APP.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511999998888","name":"Teste","text":"oi, queria um site"}'
```
Esperado: `{"ok":true}` e, em segundos, uma resposta do agente chegando no WhatsApp (via Make). Confira o lead criado no Supabase (Table Editor → `leads`).

**Cron (follow-up) manual** — força o disparo das retomadas:
```bash
curl https://SEU-APP.vercel.app/api/cron/followup \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```
Esperado: `{"ok":true,"candidatos":N,"enviados":M}`.

> Para testar follow-up rápido sem esperar 24h: na Vercel, mude temporariamente `FOLLOWUP_UNIT=minutes` e `FOLLOWUP_INTERVAL=1`, e rode o curl do cron.

---

## 6) Ajustes comuns

- **Baratear no volume:** troque `AGENT_MODEL` para `claude-sonnet-4-6`.
- **Mais/menos retomadas:** `FOLLOWUP_MAX` (padrão 30) e `FOLLOWUP_INTERVAL`.
- **Pausar a IA num lead:** mude o `status` do lead para `humano` no Supabase (o agente não responde nesse estágio).

## 7) O que ainda falta (ver CLAUDE.md)

- Idempotência no `/api/webhook` (deduplicar reenvios do Make).
- Dashboard de produção (o kanban em `public/` é do protótipo; portar para a Vercel/Next.js).
- Ao qualificar, agendar reunião (Cal.com/Google via Make) e notificar a equipe — é o que "substitui o SDR" de ponta a ponta.
