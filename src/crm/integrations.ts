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
  | "meta_form_id";

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

// Status "seguro" para a UI: diz SE cada credencial existe, sem revelar o valor.
export async function getMetaConnectionStatus(): Promise<{
  connected: boolean;
  hasPageAccessToken: boolean;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
  formId: string; // form id nao e segredo — pode aparecer na UI
}> {
  const cfg = await getMetaConfig();
  return {
    connected: Boolean(cfg.pageAccessToken && cfg.formId),
    hasPageAccessToken: Boolean(cfg.pageAccessToken),
    hasAppSecret: Boolean(cfg.appSecret),
    hasVerifyToken: Boolean(cfg.verifyToken),
    formId: cfg.formId,
  };
}
