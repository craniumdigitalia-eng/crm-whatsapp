# Integrações — Google Calendar (agenda)

Conecta o portal a uma agenda do Google via **OAuth 2.0** para criar eventos
(reuniões com leads). O fluxo guarda um `refresh_token` que o backend usa para criar
eventos sem pedir login de novo.

## O que foi criado

| Arquivo | Função |
|---|---|
| `app/api/integrations/google/auth/route.ts` | GET (requireAdmin) — inicia o consentimento OAuth |
| `app/api/integrations/google/callback/route.ts` | GET — troca o `code` por tokens, salva o `refresh_token` (state CSRF) |
| `app/api/integrations/google/status/route.ts` | GET (requireUser) — `{ configured, connected }` |
| `app/api/integrations/google/route.ts` | Compat: redireciona para `/auth` |
| `src/crm/calendar.ts` | `createEvent(...)` + `agendarReuniaoLead(lead, start, opts)` |
| `src/crm/integrations.ts` | `getGoogleConfig()` / `getGoogleConnectionStatus()` + chaves no `integrations_config` |

`escopo OAuth`: `https://www.googleapis.com/auth/calendar.events`.

## Estado atual

As credenciais do Google **ainda não existem**. Enquanto `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` estiverem vazios:
- o card mostra **"Google não configurado"** e o botão fica desabilitado;
- `createEvent` lança `CalendarError` com mensagem clara (não quebra o app).

Assim que você criar o OAuth client (abaixo) e definir as variáveis, o card passa a
funcionar: **Conectar** → consentimento Google → volta como **Conectado**.

## Passo 1 — Criar o OAuth client no Google Cloud Console

1. Acesse <https://console.cloud.google.com/> e crie (ou selecione) um **projeto**.
2. **APIs & Services → Library** → procure **Google Calendar API** → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type **External** (ou Internal, se for Google Workspace da empresa).
   - Preencha nome do app, e-mail de suporte e de contato.
   - Em **Scopes**, adicione `.../auth/calendar.events`.
   - Em **Test users**, adicione o e-mail da conta Google que vai conectar a agenda
     (necessário enquanto o app estiver em modo *Testing*).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs** — cadastre as duas:
     - `http://localhost:3000/api/integrations/google/callback` (dev)
     - `https://SEU_DOMINIO_VERCEL/api/integrations/google/callback` (produção)
   - Crie e copie o **Client ID** e o **Client secret**.

## Passo 2 — Configurar as variáveis

No `.env` (ou salvando em `integrations_config` via tabela):

```bash
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx
# Opcional: se vazio, o portal deriva {origin}/api/integrations/google/callback.
# Se definir, use EXATAMENTE uma das redirect URIs cadastradas no passo 1.
GOOGLE_REDIRECT_URI=
# Opcional: calendário alvo ("primary" = agenda principal da conta conectada).
GOOGLE_CALENDAR_ID=primary
```

> **redirect_uri**: precisa bater exatamente com o que está no Google Cloud. Como o portal
> deriva a URI do host atual quando `GOOGLE_REDIRECT_URI` está vazio, basta cadastrar as URIs
> do passo 1 (localhost + Vercel) e não definir a variável.

## Passo 3 — Conectar

1. No portal → **Integrações** → card **Google Calendar** → **Conectar**.
2. Faça login no Google e conceda o acesso ao calendário.
3. Você volta para `/integracoes?google=conectado` e o badge vira **Conectado**.
   - O `refresh_token` é salvo em `integrations_config` (`google_refresh_token`).
   - Forçamos `access_type=offline` + `prompt=consent` para garantir o `refresh_token`.

### Erros possíveis (banner na volta)
| `?google=` | Significado |
|---|---|
| `nao_configurado` | Falta `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. |
| `state_invalido` | Falha de CSRF (cookie expirou) — clique em Conectar de novo. |
| `sem_refresh` | Google não devolveu `refresh_token`. Revogue o acesso do app em <https://myaccount.google.com/permissions> e reconecte. |
| `cancelado` / `erro` | Consentimento negado ou falha na troca de tokens (ver logs). |

## Uso no domínio

```ts
import { agendarReuniaoLead, createEvent } from "@/src/crm/calendar";

// Helper: agenda reunião com um lead (ex.: quando qualifica).
await agendarReuniaoLead(lead, "2026-07-01T14:00:00-03:00", {
  durationMin: 30,
  attendees: ["lead@email.com"],
});

// Genérico:
await createEvent({
  summary: "Call de proposta",
  start: "2026-07-01T14:00:00-03:00",
  end: "2026-07-01T14:30:00-03:00",
  attendees: ["lead@email.com"],
});
```

`createEvent` resolve o `access_token` a partir do `refresh_token`, cria o evento no
`GOOGLE_CALENDAR_ID` e retorna `{ id, htmlLink }`. Lança `CalendarError` se não conectado.

## Segurança
- `/auth` exige **admin**. O `/callback` é chamado pelo browser voltando do Google e é
  protegido por **state CSRF** (cookie httpOnly de uso único), não por sessão.
- `refresh_token` e `client_secret` vivem **server-side** (`integrations_config` / `.env`),
  nunca expostos ao browser. `/status` só devolve flags (`configured`, `connected`).
