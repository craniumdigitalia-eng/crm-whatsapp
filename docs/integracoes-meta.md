# Integrações — Facebook Ads / Meta Lead Ads (Story 5.14)

Importação de leads dos **formulários instantâneos** (Lead Ads) do Facebook/Instagram
para o CRM. Dois caminhos: **importação sob demanda** (botão na aba Integrações) e
**webhook leadgen** (em tempo real, quando um lead preenche o formulário).

## O que foi criado

| Arquivo | Função |
|---|---|
| `app/integracoes/page.tsx` | Aba "Integrações" com os 3 cards (Google, Meta, WhatsApp) |
| `app/api/integrations/meta/config/route.ts` | GET status / POST salvar credenciais (sem expor segredos) |
| `app/api/integrations/meta/import/route.ts` | POST — importa leads via `GET /{form_id}/leads` |
| `app/api/leadgen/route.ts` | GET handshake + POST webhook (valida `X-Hub-Signature-256`) |
| `app/api/integrations/google/route.ts` | Stub OAuth do Google Calendar |
| `src/crm/meta.ts` | Graph API, parsing de `field_data`, upsert idempotente, assinatura |
| `src/crm/integrations.ts` | Config key/value (env primeiro, tabela como override) |
| `src/crm/leads.ts` | `getLeadAttribution`, `findLeadByLeadgenId`, `setLeadAttribution` |
| `supabase/migrations/003-lead-attribution.sql` | **APLICAR NO BANCO** (colunas + `integrations_config`) |

## Passo 1 — Aplicar a migration 003

Sem isso a importação grava nos leads mas os campos de atribuição ficam nulos.
No **SQL Editor do Supabase**, rode o conteúdo de
`supabase/migrations/003-lead-attribution.sql`. Ele adiciona em `leads`:
`source, form_id, leadgen_id (unique), ad_id, campaign_id, form_data (jsonb)` e
cria a tabela `integrations_config`.

## Passo 2 — Credenciais do Meta (onde tirar cada uma)

As credenciais podem ir no **`.env`** OU serem salvas pela aba Integrações
(o backend lê o env primeiro; a tabela `integrations_config` sobrescreve).

1. **App Meta** — em <https://developers.facebook.com/apps> crie/abra um app do tipo
   *Business*. Adicione o produto **Webhooks** e **Facebook Login** (ou use um
   *System User* no Business Manager para o token).

2. **`META_PAGE_ACCESS_TOKEN`** (Page Access Token) — token **da Página** que roda os
   anúncios, com as permissões `leads_retrieval`, `pages_show_list`,
   `pages_read_engagement`, `pages_manage_metadata`.
   - Rápido (teste): **Graph API Explorer** → selecione o app → "Get Page Access Token"
     → escolha a Página → conceda as permissões → copie o token.
   - Produção: gere um **token de longa duração** (System User no Business Settings →
     Users → System Users → Generate Token), que não expira.

3. **`META_FORM_ID`** (Form ID) — ID do formulário instantâneo.
   - **Meta Business Suite** → *All Tools* → **Instant Forms** (Formulários
     Instantâneos), abra o formulário e copie o ID; ou
   - via Graph API: `GET /{page_id}/leadgen_forms` (com o Page Access Token) lista os
     formulários e seus `id`.

4. **`META_APP_SECRET`** (App Secret) — em **App Settings → Basic** do seu app.
   Usado só para validar a assinatura do webhook (`X-Hub-Signature-256`).

5. **`META_VERIFY_TOKEN`** (Verify Token) — **você inventa** uma string secreta. A aba
   Integrações sugere uma (`cranium_...`). Use o **mesmo valor** no painel do Meta ao
   configurar o webhook.

## Passo 3 — Importação sob demanda (mais simples; sem domínio público)

1. Abra **Integrações** no portal.
2. No card *Facebook Ads · Meta Lead Ads*, preencha **Page Access Token** e **Form ID**
   (App Secret e Verify Token só são necessários para o webhook).
3. **Salvar conexão** → o badge vira *Conectado*.
4. **Importar leads agora** → chama `GET /{form_id}/leads` e cria/atualiza os leads.
   Idempotente: rodar de novo só traz os novos (dedupe por `leadgen_id`).

Resultado: cada lead aparece no Kanban com `source = meta_lead_ads`, telefone e nome
extraídos do `field_data`, e todas as respostas em `form_data`. Abra o lead no drawer
para ver a seção **📋 Origem / Formulário**.

## Passo 4 — Webhook leadgen (tempo real; requer URL pública)

1. Faça deploy (Vercel) para ter uma URL pública.
2. No app Meta → **Webhooks** → objeto **Page** → *Callback URL*:
   `https://SEU_DOMINIO/api/leadgen` e *Verify Token*: o mesmo `META_VERIFY_TOKEN`.
   O Meta chama o GET de handshake; respondemos o `hub.challenge`.
3. Assine o campo **`leadgen`** e conecte a Página.
4. Cada novo lead dispara um POST; validamos a assinatura com o App Secret, buscamos o
   lead na Graph API e gravamos no CRM (idempotente por `leadgen_id`).

## Teste local

```bash
npm run dev
# Status (env vazio -> connected:false):
curl localhost:3000/api/integrations/meta/config
# Importação sem token -> 400 com mensagem clara:
curl -X POST localhost:3000/api/integrations/meta/import
# Webhook sem assinatura -> 401:
curl -X POST localhost:3000/api/leadgen -d '{"entry":[]}'
```

Para uma importação real, exporte `META_PAGE_ACCESS_TOKEN` e `META_FORM_ID` válidos
no `.env` (ou salve pela UI) e clique em *Importar leads agora*.

## Google Calendar (Parte 3)

`app/api/integrations/google/route.ts` é um stub: com `GOOGLE_CLIENT_ID` +
`GOOGLE_REDIRECT_URI` no `.env` ele redireciona para o consentimento OAuth do Google;
sem isso retorna *Não configurado*. Falta implementar o handler de callback
(`/api/integrations/google/callback`) para trocar o `code` por tokens e persisti-los.
