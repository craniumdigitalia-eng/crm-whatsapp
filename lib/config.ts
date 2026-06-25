// Configuracao das funcoes serverless, lida do ambiente (Vercel env vars).
const unit = (process.env.FOLLOWUP_UNIT ?? "hours").toLowerCase();
const unitMs = unit === "minutes" ? 60 * 1000 : 60 * 60 * 1000;

export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  agentModel: process.env.AGENT_MODEL ?? "claude-opus-4-8",
  companyName: process.env.COMPANY_NAME ?? "nossa agencia",

  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  // Webhook do Make que envia a mensagem no WhatsApp.
  makeSendUrl: process.env.MAKE_SEND_URL ?? "",

  // Protege a rota de cron contra chamadas externas.
  cronSecret: process.env.CRON_SECRET ?? "",

  followupMax: parseInt(process.env.FOLLOWUP_MAX ?? "30", 10),
  followupIntervalMs: parseFloat(process.env.FOLLOWUP_INTERVAL ?? "24") * unitMs,
};
