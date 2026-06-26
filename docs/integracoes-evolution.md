# Integrações — WhatsApp via Evolution API (ADR-004)

A Evolution API é **o canal de WhatsApp** do portal (ADR-004). O Make deixa de ser canal
de WhatsApp — fica apenas para o Facebook Lead Ads (frente `/api/leadgen`, não mexer).

Fluxo: a Evolution recebe as mensagens do WhatsApp pareado e as encaminha para
`POST /api/webhook` → `parseWebhook` normaliza o evento `messages.upsert` →
`handleInbound` (grava o lead, dispara o agente de IA, responde via `sendText`).

## O que foi criado

| Arquivo | Função |
|---|---|
| `app/(portal)/whatsapp/page.tsx` | Tela "Conectar via QR": QR, polling de status, número conectado, form de credenciais |
| `app/api/integrations/evolution/connect/route.ts` | POST (admin) — cria/conecta a instância e devolve o QR (base64) |
| `app/api/integrations/evolution/status/route.ts` | GET (user) — estado da conexão (`connected`/`connecting`/`disconnected`) + número |
| `app/api/integrations/evolution/disconnect/route.ts` | POST (admin) — logout/desconectar a sessão |
| `app/api/integrations/evolution/config/route.ts` | GET flags / POST (admin) salva URL+API key+instância+token do webhook |
| `src/whatsapp/evolution-admin.ts` | Proxy server-side da API de instâncias da Evolution (connect/status/logout) |
| `src/whatsapp/evolution.ts` | `sendText` (agora resolve credenciais via env+tabela) + `parseWebhook` |
| `src/crm/integrations.ts` | `getEvolutionConfig` / `getEvolutionConnectionStatus` (env primeiro, tabela override) |
| `api/webhook.ts` | **Re-rotado** para a Evolution (`parseWebhook` → `handleInbound`), valida o token |

**Importante:** o browser **nunca** fala direto com a Evolution. Todos os endpoints são
*proxied* no servidor e a `apikey` jamais é exposta ao navegador.

## O que o usuário precisa fornecer

1. **EVOLUTION_URL** — a URL pública onde a Evolution está rodando (ex.: Railway).
2. **EVOLUTION_API_KEY** — a `apikey` global da Evolution (header `apikey`).
3. **EVOLUTION_INSTANCE** — o nome da instância (você escolhe, ex.: `cranium`).
4. **EVOLUTION_WEBHOOK_TOKEN** — um segredo que você inventa; valida o webhook de entrada.

Pode ser por **variável de ambiente** (Railway/Vercel) **ou** pela tela
**Portal → WhatsApp → Credenciais da Evolution** (salva em `integrations_config`,
sobrescreve o env). A tabela é gravada só por **admin**.

## Passo 1 — Subir a Evolution no Railway

1. No [Railway](https://railway.app), **New Project → Deploy from Docker Image** e use a
   imagem oficial `atendai/evolution-api:latest` (ou `evoapicloud/evolution-api:latest`).
2. Adicione um **volume** montado em `/evolution/instances` (persiste a sessão do WhatsApp).
3. (Recomendado) adicione um **Postgres** e/ou **Redis** do Railway e aponte a Evolution
   para eles via env, para a sessão não se perder em redeploys.
4. Variáveis de ambiente da Evolution (no serviço Railway):
   - `AUTHENTICATION_API_KEY` = um segredo forte → **esta é a sua `EVOLUTION_API_KEY`**.
   - `SERVER_URL` = a URL pública do serviço (Railway gera em *Settings → Networking → Generate Domain*).
   - `CONFIG_SESSION_PHONE_CLIENT=Cranium` (nome que aparece em "Aparelhos conectados").
   - Database/Redis conforme o item 3 (ex.: `DATABASE_ENABLED=true`, `DATABASE_CONNECTION_URI=...`).
5. **Generate Domain** e anote a URL → **esta é a sua `EVOLUTION_URL`** (ex.:
   `https://sua-evolution.up.railway.app`).

## Passo 2 — Configurar o portal

Opção A (recomendada — sem editar `.env`): no portal, abra **WhatsApp**, preencha
**Credenciais da Evolution** (URL, instância, API key, token do webhook) e **Salvar**.

Opção B (env): defina no painel do deploy do portal (Vercel/Railway):
```
EVOLUTION_URL=https://sua-evolution.up.railway.app
EVOLUTION_API_KEY=<o AUTHENTICATION_API_KEY da Evolution>
EVOLUTION_INSTANCE=cranium
EVOLUTION_WEBHOOK_TOKEN=<um segredo que você escolhe>
```

## Passo 3 — Conectar via QR

1. Portal → **WhatsApp** → botão **Conectar**. A instância é criada/conectada e o **QR Code** aparece.
2. No celular do número de atendimento: **WhatsApp → Aparelhos conectados → Conectar um aparelho**
   e leia o QR. A tela faz *polling* a cada 3s; ao parear, o badge vira **Conectado · +55…**.
3. Se o QR expirar, clique em **Gerar novo QR**.

## Passo 4 — Configurar o webhook na Evolution

Aponte a Evolution para o portal, no evento `messages.upsert`. A URL a colar é:

```
https://SEU_PORTAL/api/webhook?token=SEU_EVOLUTION_WEBHOOK_TOKEN
```

(A tela do WhatsApp mostra essa URL já montada com o token que você digitou.)

Onde configurar na Evolution (qualquer um dos caminhos):
- No **Manager** da Evolution (`SEU_EVOLUTION_URL/manager`): instância → **Webhook** →
  URL acima, marque **messages.upsert**, habilite *Webhook by Events* se disponível.
- Ou via API:
  ```
  POST {EVOLUTION_URL}/webhook/set/{instance}
  headers: apikey: {EVOLUTION_API_KEY}
  body: {
    "webhook": {
      "enabled": true,
      "url": "https://SEU_PORTAL/api/webhook?token=SEU_EVOLUTION_WEBHOOK_TOKEN",
      "events": ["MESSAGES_UPSERT"]
    }
  }
  ```

### Validação de origem do webhook

`POST /api/webhook` aceita o token via query (`?token=...`) **ou** header `apikey`.
- Em **produção**, se `EVOLUTION_WEBHOOK_TOKEN` não estiver definido, o webhook **recusa** (401) —
  o ingress grava no banco e aciona a Claude (custo), não pode ficar aberto.
- Em **dev** (`NODE_ENV != production`) sem token, é *fail-open* para facilitar testes locais.

## Teste rápido

1. Status: `GET /api/integrations/evolution/status` (autenticado) deve retornar
   `{ "configured": false, "state": "disconnected" }` enquanto não houver credenciais — sem crashar.
2. Com a Evolution no ar e pareada, mande uma mensagem para o número: ela deve aparecer como
   lead novo no CRM e (nos estágios automáticos) o agente responde.

## Notas

- `sendText` resolve as credenciais via `getEvolutionConfig` (env primeiro, tabela override),
  então o que você salvar na tela do WhatsApp vale também para as respostas de saída.
- O servidor Express local (`src/index.ts`) continua expondo `POST /webhook/evolution` para dev;
  em produção (Vercel) o ingresso é `POST /api/webhook`.
- Não confundir com `/api/leadgen` (Facebook Lead Ads, via Make/Meta) — frente separada, intacta.
```
