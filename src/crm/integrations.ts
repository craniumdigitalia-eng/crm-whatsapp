import { supabase } from "../db";
import { config } from "../config";

// =====================================================================
// Configuracao das integracoes (Story 5.14).
// Credenciais vem do env PRIMEIRO; a aba "Integracoes" pode sobrescrever
// salvando na tabela integrations_config (key/value). Tudo server-side —
// nunca exponha estes valores ao client.
// =====================================================================

// Chaves usadas na tabela integrations_config (espelha o config do Meta).
export type IntegrationKey =
  | "meta_page_access_token"
  | "meta_app_secret"
  | "meta_verify_token"
  | "meta_form_id"
  // Secret do POST do Make (conector Facebook Lead Ads -> /api/leadgen).
  | "meta_make_secret"
  // ===== WhatsApp / Evolution (ADR-004) =====
  | "evolution_url"
  | "evolution_api_key"
  | "evolution_instance"
  | "evolution_webhook_token"
  // ===== Google Calendar OAuth (Parte B) =====
  | "google_client_id"
  | "google_client_secret"
  | "google_refresh_token"
  | "google_calendar_id"
  // ===== Email Marketing (migration 007) =====
  // ESP plugável: 'dev' (default, só loga) | 'resend' | 'sendgrid' | 'brevo' | 'ses' ...
  | "email_provider"
  | "email_api_key"
  | "email_from";

// Le um valor da tabela integrations_config. Tolerante: se a tabela ainda
// nao existe (migration 003 nao aplicada), retorna undefined sem quebrar.
export async function getConfigValue(key: IntegrationKey): Promise<string | undefined> {
  const { data, error } = await supabase
    .from("integrations_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.warn(`[integrations] getConfigValue(${key}): ${error.message}`);
    return undefined;
  }
  const value = (data as { value: string | null } | null)?.value;
  return value && value.trim() ? value : undefined;
}

// Grava (upsert) varios valores de uma vez. Ignora valores vazios/undefined
// (assim a UI nao apaga um segredo ja salvo ao enviar o campo em branco).
export async function setConfigValues(
  values: Partial<Record<IntegrationKey, string | undefined | null>>
): Promise<void> {
  const rows = Object.entries(values)
    .filter(([, v]) => typeof v === "string" && v.trim() !== "")
    .map(([key, value]) => ({ key, value: (value as string).trim() }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("integrations_config").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}

export interface MetaConfig {
  pageAccessToken: string;
  appSecret: string;
  verifyToken: string;
  formId: string;
  graphVersion: string;
}

// Resolve a config efetiva do Meta: env como base, tabela como override.
// A versao da Graph API vem so do env (nao e segredo de UI).
export async function getMetaConfig(): Promise<MetaConfig> {
  const [token, secret, verify, form] = await Promise.all([
    getConfigValue("meta_page_access_token"),
    getConfigValue("meta_app_secret"),
    getConfigValue("meta_verify_token"),
    getConfigValue("meta_form_id"),
  ]);
  return {
    pageAccessToken: token ?? config.metaPageAccessToken,
    appSecret: secret ?? config.metaAppSecret,
    verifyToken: verify ?? config.metaVerifyToken,
    formId: form ?? config.metaFormId,
    graphVersion: config.metaGraphVersion,
  };
}

// Secret compartilhado com o cenario do Make (conector Facebook Lead Ads -> /api/leadgen).
// Env como base; a aba Integracoes sobrescreve via integrations_config (meta_make_secret).
export async function getMakeSecret(): Promise<string> {
  return (await getConfigValue("meta_make_secret")) ?? config.metaMakeSecret;
}

// =====================================================================
// WhatsApp / Evolution (ADR-004 — Evolution e o canal de WhatsApp).
// Mesma estrategia do Meta: env como base, integrations_config como override
// salvo pela aba WhatsApp. Tudo server-side; a apikey NUNCA vai ao browser.
// =====================================================================

export interface EvolutionConfig {
  url: string; // sem barra no final
  apiKey: string;
  instance: string;
  webhookToken: string; // valida a origem do POST /api/webhook
}

// Resolve a config efetiva da Evolution. Tabela sobrescreve o env quando preenchida.
export async function getEvolutionConfig(): Promise<EvolutionConfig> {
  const [url, apiKey, instance, webhookToken] = await Promise.all([
    getConfigValue("evolution_url"),
    getConfigValue("evolution_api_key"),
    getConfigValue("evolution_instance"),
    getConfigValue("evolution_webhook_token"),
  ]);
  return {
    url: (url ?? config.evolutionUrl).replace(/\/$/, ""),
    apiKey: apiKey ?? config.evolutionApiKey,
    instance: instance ?? config.evolutionInstance,
    webhookToken: webhookToken ?? config.evolutionWebhookToken,
  };
}

// Status "seguro" para a UI: diz SE cada credencial existe, sem revelar o valor.
// A url e o instance NAO sao segredos — podem aparecer na tela.
export async function getEvolutionConnectionStatus(): Promise<{
  configured: boolean;
  url: string;
  instance: string;
  hasApiKey: boolean;
  hasWebhookToken: boolean;
}> {
  const cfg = await getEvolutionConfig();
  return {
    configured: Boolean(cfg.url && cfg.apiKey && cfg.instance),
    url: cfg.url,
    instance: cfg.instance,
    hasApiKey: Boolean(cfg.apiKey),
    hasWebhookToken: Boolean(cfg.webhookToken),
  };
}

// Status "seguro" para a UI: diz SE cada credencial existe, sem revelar o valor.
// Fluxo Make (principal): a conexao esta "conectada" quando o secret do Make existe
// (o Make posta os leads em /api/leadgen validando esse secret). Os has* do Page Access
// Token / App Secret continuam expostos para o caminho de importacao direta (legado).
export async function getMetaConnectionStatus(): Promise<{
  connected: boolean;
  hasMakeSecret: boolean;
  hasPageAccessToken: boolean;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
  formId: string; // form id nao e segredo — pode aparecer na UI
}> {
  const cfg = await getMetaConfig();
  const makeSecret = await getMakeSecret();
  return {
    connected: Boolean(makeSecret),
    hasMakeSecret: Boolean(makeSecret),
    hasPageAccessToken: Boolean(cfg.pageAccessToken),
    hasAppSecret: Boolean(cfg.appSecret),
    hasVerifyToken: Boolean(cfg.verifyToken),
    formId: cfg.formId,
  };
}

// =====================================================================
// Google Calendar (Parte B). Mesma estrategia: env como base, integrations_config
// como override. O refresh_token NASCE do fluxo OAuth (callback) e vive so na tabela
// (nunca no env). client_id/secret podem vir do env OU da aba Integracoes.
// =====================================================================

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string; // obtido no OAuth; vazio = nao conectado
  redirectUri: string; // vazio = derivar do request ({origin}/.../callback)
  calendarId: string;
}

export async function getGoogleConfig(): Promise<GoogleConfig> {
  const [id, secret, refresh, cal] = await Promise.all([
    getConfigValue("google_client_id"),
    getConfigValue("google_client_secret"),
    getConfigValue("google_refresh_token"),
    getConfigValue("google_calendar_id"),
  ]);
  return {
    clientId: id ?? config.googleClientId,
    clientSecret: secret ?? config.googleClientSecret,
    refreshToken: refresh ?? "",
    redirectUri: config.googleRedirectUri,
    calendarId: cal ?? config.googleCalendarId,
  };
}

// Status "seguro" para a UI: configured = ha client_id/secret (da pra iniciar o OAuth);
// connected = ha refresh_token salvo (da pra criar eventos).
export async function getGoogleConnectionStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  calendarId: string;
}> {
  const cfg = await getGoogleConfig();
  return {
    configured: Boolean(cfg.clientId && cfg.clientSecret),
    connected: Boolean(cfg.refreshToken),
    calendarId: cfg.calendarId,
  };
}

// =====================================================================
// Email Marketing (migration 007). Mesma estrategia: env como base,
// integrations_config como override salvo pela aba "Email". A api key
// NUNCA vai ao browser — so o getEmailConnectionStatus (has*) e exposto.
// =====================================================================

export interface EmailConfig {
  provider: string; // 'dev' (default) | 'resend' | 'sendgrid' | 'brevo' | 'ses' ...
  apiKey: string; // credencial do ESP (vazio no provider 'dev')
  from: string; // remetente "Nome <email@dominio>"
}

export async function getEmailConfig(): Promise<EmailConfig> {
  const [provider, apiKey, from] = await Promise.all([
    getConfigValue("email_provider"),
    getConfigValue("email_api_key"),
    getConfigValue("email_from"),
  ]);
  return {
    provider: (provider ?? config.emailProvider ?? "dev").toLowerCase(),
    apiKey: apiKey ?? config.emailApiKey,
    from: from ?? config.emailFrom,
  };
}

// Status "seguro" para a UI: o provider e o remetente nao sao segredos;
// a api key so e reportada como presente/ausente. configured = da pra enviar
// de verdade ('dev' sempre pode "enviar" (loga); ESP real exige apiKey+from).
export async function getEmailConnectionStatus(): Promise<{
  provider: string;
  from: string;
  hasApiKey: boolean;
  configured: boolean;
}> {
  const cfg = await getEmailConfig();
  const isDev = cfg.provider === "dev" || !cfg.provider;
  return {
    provider: cfg.provider || "dev",
    from: cfg.from,
    hasApiKey: Boolean(cfg.apiKey),
    configured: isDev ? true : Boolean(cfg.apiKey && cfg.from),
  };
}
