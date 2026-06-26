import dotenv from "dotenv";
dotenv.config();

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.warn(`[config] Variavel de ambiente ausente: ${name} (veja .env.example)`);
  }
  return v ?? "";
}

const unit = (process.env.FOLLOWUP_UNIT ?? "hours").toLowerCase();
const unitMs = unit === "minutes" ? 60 * 1000 : 60 * 60 * 1000;

// Numero maximo de retomadas por lead e o intervalo entre cada uma.
const followupMax = parseInt(process.env.FOLLOWUP_MAX ?? "30", 10);
const followupInterval = parseFloat(process.env.FOLLOWUP_INTERVAL ?? "24");

export const config = {
  port: parseInt(process.env.PORT ?? "3000", 10),

  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  agentModel: process.env.AGENT_MODEL ?? "claude-opus-4-8",

  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),

  evolutionUrl: (process.env.EVOLUTION_URL ?? "http://localhost:8080").replace(/\/$/, ""),
  evolutionInstance: required("EVOLUTION_INSTANCE"),
  evolutionApiKey: required("EVOLUTION_API_KEY"),
  // Token validado no webhook de entrada do WhatsApp (POST /api/webhook).
  // O usuario cola no painel da Evolution como ?token=... na URL do webhook
  // (ou envia no header "apikey"). Lido do env PRIMEIRO; a aba WhatsApp pode
  // sobrescrever via integrations_config (chave evolution_webhook_token).
  evolutionWebhookToken: process.env.EVOLUTION_WEBHOOK_TOKEN ?? "",

  followupMax, // quantas retomadas no maximo por lead
  followupIntervalMs: followupInterval * unitMs, // intervalo entre retomadas
  followupCron: process.env.FOLLOWUP_CRON ?? "*/5 * * * *",

  companyName: process.env.COMPANY_NAME ?? "nossa agencia",

  // ===== Meta / Facebook Lead Ads (Story 5.14) =====
  // Lidos primeiro do env; a aba "Integracoes" pode sobrescrever via
  // tabela integrations_config (merge em src/crm/integrations.ts).
  metaPageAccessToken: process.env.META_PAGE_ACCESS_TOKEN ?? "",
  metaAppSecret: process.env.META_APP_SECRET ?? "",
  metaVerifyToken: process.env.META_VERIFY_TOKEN ?? "",
  metaFormId: process.env.META_FORM_ID ?? "",
  // Versao da Graph API usada nas chamadas (GET /{form_id}/leads etc.).
  metaGraphVersion: process.env.META_GRAPH_VERSION ?? "v21.0",
  // Secret compartilhado com o cenario do Make (conector Facebook Lead Ads -> HTTP POST
  // /api/leadgen). O Make envia no header "x-make-secret" (ou ?token=). Lido do env
  // PRIMEIRO; a aba Integracoes pode sobrescrever via integrations_config (meta_make_secret).
  metaMakeSecret: process.env.META_MAKE_SECRET ?? "",

  // ===== Google Calendar OAuth (Parte B) =====
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  // Opcional: se vazio, os handlers derivam {origin}/api/integrations/google/callback
  // do request (funciona em localhost e na URL da Vercel sem configurar nada).
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
  // Calendario alvo dos eventos. "primary" = agenda principal da conta conectada.
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID ?? "primary",

  // Make como ponte de canal WhatsApp (producao).
  // Se MAKE_SEND_URL nao estiver definido, sendText cai no fallback Evolution (dev local).
  makeSendUrl: process.env.MAKE_SEND_URL ?? "",
  // Token enviado pelo Make em cada POST /api/webhook — validado pela Story 3.3.
  makeWebhookSecret: process.env.MAKE_WEBHOOK_SECRET ?? "",

  // Vercel Cron: segredo exigido no header Authorization: Bearer {CRON_SECRET}.
  cronSecret: process.env.CRON_SECRET ?? "",
  // Numero maximo de leads processados por ciclo de cron — evita estourar timeout da funcao.
  followupBatch: parseInt(process.env.FOLLOWUP_BATCH ?? "50", 10),
};
