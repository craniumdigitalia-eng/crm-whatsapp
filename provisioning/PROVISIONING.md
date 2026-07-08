# Kit de provisionamento — subir um cliente novo

Modelo: **uma base de código só, um deploy por cliente**. Cada cliente tem o próprio
Supabase (banco isolado) e o próprio Vercel (site), rodando o MESMO código. Este guia
faz nascer um cliente novo em poucos minutos, sem bagunça.

> Regra de ouro: **cada cliente tem suas próprias variáveis de ambiente e seu próprio
> número de WhatsApp (instância Evolution)**. O código é idêntico; só muda o `.env`.

---

## 0. Antes de começar (contas do cliente)
- **Supabase**: 1 projeto novo (banco isolado do cliente).
- **Vercel**: 1 projeto novo (deploy do cliente) apontando pra este repositório.
- **Evolution**: 1 instância nova (o número de WhatsApp do cliente) na Railway.
- **OpenAI**: pode reusar a mesma chave (ou uma por cliente pra ver o custo separado).
- **Gmail** (envio de e-mail) e **Google Calendar** (agenda): opcionais, se o cliente for usar.

---

## 1. Supabase do cliente
1. Crie um projeto novo no Supabase. Anote **Project URL**, **anon key** e **service_role key** (Settings → API).
2. No **SQL Editor**, cole e rode o arquivo **`provisioning/schema.sql`** inteiro. Isso cria todas as tabelas (32) de uma vez.

## 2. `.env` do cliente
1. Copie `.env.example` para `.env` e preencha com os dados DESTE cliente:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (do passo 1)
   - `OPENAI_API_KEY` + `AGENT_MODEL=gpt-4o-mini`
   - `EVOLUTION_URL` / `EVOLUTION_INSTANCE` / `EVOLUTION_API_KEY` / `EVOLUTION_WEBHOOK_TOKEN` (instância do cliente)
   - `CRON_SECRET` e `SITE_LEAD_SECRET` (gere valores aleatórios: `openssl rand -hex 16`)
   - `COMPANY_NAME` (nome do cliente) e `FOLLOWUP_*`
   - E-mail (`EMAIL_PROVIDER=gmail`, `EMAIL_USER`, `EMAIL_APP_PASSWORD`, `EMAIL_FROM`) e Google/Meta se for usar.

## 3. Setup (buckets + admin)
Com o `.env` preenchido, rode o script de setup. Ele cria os buckets de imagem
(`avatars`, `agent-assets`), valida as tabelas e cria o **usuário admin** (o login do dono):
```
ADMIN_EMAIL="dono@cliente.com" ADMIN_PASSWORD="SenhaForte123!" \
  node_modules/.bin/tsx provisioning/setup.ts
```
Guarde o e-mail/senha do admin: é com ele que o cliente entra no portal.

## 4. Vercel do cliente
1. Crie um projeto novo na Vercel apontando pra este repositório.
2. Em **Settings → Environment Variables**, cadastre TODAS as variáveis do `.env` (produção).
3. Faça o deploy (`vercel --prod`). Anote a URL do cliente (ex.: `crm-cliente.vercel.app`).

## 5. WhatsApp (Evolution) do cliente
1. Na instância Evolution do cliente, configure o **webhook** apontando para:
   `https://<url-do-cliente>/api/webhook?token=<EVOLUTION_WEBHOOK_TOKEN>` (evento `MESSAGES_UPSERT`).
2. No portal do cliente (aba **WhatsApp**), leia o **QR** e pareie o número dele.

## 6. Configurar no portal (logado como admin)
- **Agente IA**: persona, tom, abordagem e (se tiver) os prints/provas.
- **Integrações**: e-mail, Google Calendar, Meta (se usar).
- **Notificações**: número do operador do cliente.

## 7. Conferir
- Entre no portal com o admin. Mande uma mensagem de teste no WhatsApp e veja o lead cair.
- (Opcional) Configure o **UptimeRobot** batendo em
  `https://<url-do-cliente>/api/cron/evolution-health?token=<CRON_SECRET>` (alerta de queda).

---

## Atualizar um cliente já existente (quando você melhora o código)
1. **Deploy**: no projeto Vercel do cliente, `vercel --prod` (ou push, se ligado ao git).
2. **Migrations novas**: se você adicionou uma migration nova (ex.: `015-...sql`), rode ELA
   no SQL Editor do Supabase daquele cliente. O `provisioning/schema.sql` é só pra clientes
   NOVOS; nos existentes, aplique só a migration nova.

> Dica: mantenha uma planilha simples com cada cliente (URL Vercel, projeto Supabase,
> número WhatsApp, última migration aplicada). Facilita o dia a dia.

## Checklist rápido (copiar por cliente)
```
[ ] Supabase criado + schema.sql rodado
[ ] .env preenchido
[ ] setup.ts rodado (buckets + admin)
[ ] Vercel criado + env vars + deploy
[ ] Webhook Evolution apontando pro cliente
[ ] WhatsApp pareado (QR)
[ ] Agente + integrações configurados
[ ] Teste de ponta a ponta ok
[ ] UptimeRobot (alerta) configurado
```
