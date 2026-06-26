# Integrações — Facebook Lead Ads VIA MAKE

Os leads dos **formulários instantâneos** (Lead Ads) do Facebook/Instagram entram no CRM
através do **Make**: o conector nativo *Facebook Lead Ads* do Make captura cada lead e faz
um **POST** no nosso endpoint `/api/leadgen`. **Não** usamos o app de desenvolvedor do Meta
neste fluxo — quem fala com a Graph API é o Make.

Ao receber o lead, o portal:
1. cria o contato (idempotente por `leadgen_id`, senão por telefone) com `source = meta_lead_ads`
   e `form_data` = todas as respostas do formulário;
2. **dispara a mensagem de abertura** (opener) automaticamente — o agente de IA inicia a
   conversa no WhatsApp via `sendText` (Make/Evolution).

> Caminho legado (webhook direto do Meta com assinatura `X-Hub-Signature-256`) continua
> suportado pelo mesmo endpoint, mas o caminho recomendado é o Make.

## O que foi criado / alterado

| Arquivo | Função |
|---|---|
| `app/api/leadgen/route.ts` | POST do Make (valida secret) + webhook direto do Meta (HMAC) + GET handshake |
| `src/crm/meta.ts` | `parseMakeLead` (objeto plano ou `field_data`) + `upsertMakeLead` idempotente |
| `src/handler.ts` | `iniciarAtendimento(lead, formData)` — opener outbound via agente |
| `src/crm/integrations.ts` | `getMakeSecret()` + `meta_make_secret` em `integrations_config` |
| `app/api/integrations/meta/config/route.ts` | POST aceita `make_secret` (requireAdmin) |
| `app/(portal)/integracoes/page.tsx` | Card "Facebook Ads" no fluxo Make (URL + secret + guia) |

Sem mudança de schema: o secret é uma linha em `integrations_config` (migration 003 já existe).

## Passo a passo

### 1. No portal (aba Integrações)
1. Abra **Integrações** → card **Facebook Ads · Meta Lead Ads**.
2. **Copie a URL do webhook** exibida (ex.: `https://SEU_PORTAL/api/leadgen`).
3. Clique em **Gerar secret** → **Copiar secret** → **Salvar secret** (requer admin).
   - O secret é salvo em `integrations_config` (`meta_make_secret`). Ele **não** é exibido
     de novo depois — guarde o valor copiado para colar no Make.
   - Alternativa: definir `META_MAKE_SECRET` no `.env`.

### 2. No Make (cenário)
1. **Module 1 — Facebook Lead Ads → Watch Leads**: conecte sua conta, escolha a Página e o
   formulário instantâneo. (O Make pede a conexão OAuth com o Facebook — feita uma vez.)
2. **Module 2 — HTTP → Make a request**:
   - **URL**: a URL do webhook copiada do portal.
   - **Method**: `POST`.
   - **Headers**: `x-make-secret` = o secret gerado no portal.
     *(alternativa: anexar `?token=SECRET` na URL).*
   - **Body type**: `Raw` → Content type `JSON (application/json)`.
   - **Request content**: mapeie os campos do lead (veja o payload abaixo).
3. **Salve e ative** o cenário. Cada novo lead dispara o POST.

### 3. Payload que o Make deve enviar

Aceitamos **dois formatos** (use o que for mais simples de mapear no Make):

**a) Objeto plano** (recomendado — mapeie cada campo do módulo Watch Leads):

```json
{
  "name": "Maria Souza",
  "phone": "5511998765432",
  "Qual serviço você procura?": "Tráfego pago",
  "Orçamento": "5 mil",
  "leadgen_id": "{{1.id}}",
  "form_id": "{{1.form_id}}",
  "ad_id": "{{1.ad_id}}",
  "campaign_id": "{{1.campaign_id}}"
}
```

- `name` / `phone`: também reconhecemos `full_name`, `first_name`+`last_name`,
  `phone_number`, `telefone`, `whatsapp`, etc. O telefone é normalizado para dígitos (+DDI).
- Qualquer **outra chave** vira uma resposta em `form_data` (preserva o rótulo original).
- `leadgen_id`, `form_id`, `ad_id`, `campaign_id`: atribuição (não entram em `form_data`).
  `leadgen_id` garante a idempotência (o mesmo lead não entra duas vezes).

**b) Lead cru do Meta** (se o Make repassar `field_data`):

```json
{
  "id": "1234567890",
  "form_id": "F1",
  "field_data": [
    { "name": "full_name", "values": ["Maria Souza"] },
    { "name": "phone_number", "values": ["+5511998765432"] },
    { "name": "qual_servico", "values": ["Tráfego pago"] }
  ]
}
```

### Importante sobre o telefone
Para o opener ser enviado, o telefone precisa ser um número real (8–15 dígitos, com DDI/DDD).
Sem telefone, o lead ainda é criado (com marcador sintético `meta:<leadgen_id>`), mas a
mensagem de abertura **não** é enviada (logamos um aviso).

## Teste local

```bash
npm run dev
# Sem secret configurado -> 401:
curl -i -X POST localhost:3000/api/leadgen -H 'Content-Type: application/json' \
  -d '{"phone":"5511999998888","name":"Teste"}'

# Com secret (defina META_MAKE_SECRET=abc no .env e reinicie):
curl -i -X POST localhost:3000/api/leadgen \
  -H 'Content-Type: application/json' -H 'x-make-secret: abc' \
  -d '{"name":"Maria","phone":"5511999998888","Servico":"Site","leadgen_id":"LG1"}'
# -> 201/200 { ok:true, lead_id, created:true } e dispara o opener no WhatsApp.
```

## Segurança
- `/api/leadgen` é endpoint de **máquina**: não exige sessão (o middleware já exclui `/api/*`).
  A proteção é o **secret** (comparação em tempo constante) ou a **assinatura HMAC** do Meta.
- Os endpoints de **configuração** (`/api/integrations/meta/config` POST) exigem **admin**.
