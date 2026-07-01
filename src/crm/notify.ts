import { supabase } from "../db";
import { Lead } from "../types";

// =====================================================================
// Notificações de lead para o operador via WhatsApp.
// Config em integrations_config (chave JSON "notify_config"):
//   notify_enabled: bool — liga/desliga as notificações
//   notify_whatsapp: string — número do operador (só dígitos)
//
// Todas as funções são best-effort: NUNCA lançam nem bloqueiam o fluxo
// principal. Use import dinâmico neste módulo para evitar circular.
// =====================================================================

const CONFIG_KEY = "notify_config";

export interface NotifyConfig {
  enabled: boolean;
  whatsapp: string; // só dígitos; vazio = desabilitado
}

const CONFIG_DEFAULT: NotifyConfig = { enabled: false, whatsapp: "" };

// Lê a config de notificação. Tolerante: qualquer erro retorna o default desligado.
export async function getNotifyConfig(): Promise<NotifyConfig> {
  try {
    const { data, error } = await supabase
      .from("integrations_config")
      .select("value")
      .eq("key", CONFIG_KEY)
      .maybeSingle();
    if (error) {
      console.warn(`[notify] getNotifyConfig: ${error.message}`);
      return CONFIG_DEFAULT;
    }
    const raw = (data as { value: string | null } | null)?.value;
    if (!raw) return CONFIG_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<NotifyConfig>;
    return {
      enabled: parsed.enabled === true,
      whatsapp: typeof parsed.whatsapp === "string" ? parsed.whatsapp.replace(/\D/g, "") : "",
    };
  } catch (e) {
    console.warn("[notify] getNotifyConfig:", e);
    return CONFIG_DEFAULT;
  }
}

// Grava (upsert) a config de notificação.
export async function setNotifyConfig(cfg: NotifyConfig): Promise<void> {
  const { error } = await supabase
    .from("integrations_config")
    .upsert({ key: CONFIG_KEY, value: JSON.stringify(cfg) }, { onConflict: "key" });
  if (error) throw error;
}

// Garante o código do país (Brasil = 55). Se o número veio só com DDD+numero
// (10 ou 11 dígitos), prefixa 55. Sem isso a Evolution responde "número não existe".
function normalizarNumeroBr(n: string): string {
  const d = n.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

// Envia uma mensagem de texto ao número do operador. Best-effort — NUNCA lança.
export async function notificarWhatsapp(text: string): Promise<void> {
  try {
    const cfg = await getNotifyConfig();
    if (!cfg.enabled || !cfg.whatsapp) return;

    const numero = normalizarNumeroBr(cfg.whatsapp);
    // Import dinâmico evita import circular (notify ← sendText ← integrations ← ...).
    const { sendText } = await import("../whatsapp/evolution");
    await sendText(numero, text);
  } catch (e) {
    // Best-effort: loga mas nunca propaga.
    console.warn("[notify] notificarWhatsapp falhou:", e instanceof Error ? e.message : e);
  }
}

// Notifica o operador sobre um lead recém-criado.
export async function notificarLeadNovo(lead: Lead): Promise<void> {
  const nome = lead.name?.trim() || "-";
  const interesse = lead.service_interest?.trim() || "-";
  const texto =
    `🔔 Lead novo\nNome: ${nome}\nTelefone: ${lead.phone}\nInteresse: ${interesse}`;
  await notificarWhatsapp(texto);
}

// Notifica o operador que um lead precisa de atendimento humano.
export async function notificarHumano(lead: Lead): Promise<void> {
  const nome = lead.name?.trim() || "-";
  const texto =
    `🙋 Lead precisa de você (atendimento humano)\nNome: ${nome}\nTelefone: ${lead.phone}`;
  await notificarWhatsapp(texto);
}
