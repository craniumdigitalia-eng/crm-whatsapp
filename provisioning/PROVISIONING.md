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

## Atualizar TODOS os clientes de uma vez (mass-update)
Quando você melhora o código, use o script pra subir pra todos os clientes:

1. Copie `provisioning/clients.example.json` para **`provisioning/clients.json`** e
   preencha um objeto por cliente (`vercelOrgId`, `vercelProjectId` de `.vercel/project.json`
   ou do painel Vercel; `supabaseUrl`/`supabaseServiceKey` do painel Supabase).
   `clients.json` **não vai pro git** (tem segredos).
2. Gere um **VERCEL_TOKEN** em vercel.com/account/tokens.
3. Rode (na raiz do repo):
   ```
   VERCEL_TOKEN=xxx node_modules/.bin/tsx provisioning/update-all.ts
   ```
   Isso faz o **deploy do código atual pra cada cliente**. Opções:
   - `--only=NomeDoCliente` → só um cliente.
   - `--no-deploy --verify-table=fin_clients` → só confere se a tabela existe em cada Supabase
     (útil DEPOIS de aplicar uma migration nova, pra saber quem já rodou).

### Migrations novas nos clientes existentes
O deploy sobe o **código**. Se a atualização tem uma **migration nova** (ex.: `015-...sql`),
ela precisa ser rodada no **SQL Editor de cada Supabase** (não dá pra automatizar sem a senha
do Postgres de cada um). Fluxo recomendado:
1. Rode a migration nova no SQL editor de cada cliente.
2. Confirme com `... --no-deploy --verify-table=<tabela_nova>` (mostra ✅/❌ por cliente).
3. Depois `update-all.ts` normal pra subir o código.

O `provisioning/schema.sql` é só pra clientes **NOVOS**; nos existentes, aplique só a migration nova.

> Dica: mantenha o `clients.json` como sua "planilha" central (cada cliente com projeto Vercel
> e Supabase). É a fonte de verdade do mass-update.

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
