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

  evolutionUrl: (process.env.EVOLUTION_URL ?? "http://localhost:8080").replace(/\/$/, ""),
  evolutionInstance: required("EVOLUTION_INSTANCE"),
  evolutionApiKey: required("EVOLUTION_API_KEY"),

  followupMax, // quantas retomadas no maximo por lead
  followupIntervalMs: followupInterval * unitMs, // intervalo entre retomadas
  followupCron: process.env.FOLLOWUP_CRON ?? "*/5 * * * *",

  companyName: process.env.COMPANY_NAME ?? "nossa agencia",
};
