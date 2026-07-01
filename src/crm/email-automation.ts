import { supabase } from "../db";
import { Lead, LeadStatus } from "../types";
import { getTemplate, getSuppressedSet, recordEvent } from "./email";
import { getEmailProvider } from "./email-provider";

// =====================================================================
// Automação de e-mail por etapa do funil.
// Quando um lead ENTRA numa etapa configurada, envia automaticamente o
// e-mail (modelo) daquela etapa — se o lead tiver e-mail e não estiver
// suprimido. A config vive em integrations_config (chave email_automation)
// como JSON serializado. NÃO precisa de migration nova.
// =====================================================================

// Chave na tabela integrations_config onde a config fica serializada como JSON.
const CONFIG_KEY = "email_automation";

export interface EmailAutomationConfig {
  enabled: boolean;
  // Mapa estágio → template_id. String vazia ou ausente = sem e-mail para esse estágio.
  map: Record<string, string>;
}

const DEFAULT_CONFIG: EmailAutomationConfig = { enabled: false, map: {} };

// Le a config de automação. Tolerante: qualquer erro retorna o default desligado.
export async function getEmailAutomation(): Promise<EmailAutomationConfig> {
  try {
    const { data, error } = await supabase
      .from("integrations_config")
      .select("value")
      .eq("key", CONFIG_KEY)
      .maybeSingle();
    if (error) {
      console.warn(`[email-automation] getEmailAutomation: ${error.message}`);
      return DEFAULT_CONFIG;
    }
    const raw = (data as { value: string | null } | null)?.value;
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<EmailAutomationConfig>;
    return {
      enabled: parsed.enabled === true,
      map:
        typeof parsed.map === "object" && parsed.map !== null
          ? (parsed.map as Record<string, string>)
          : {},
    };
  } catch (e) {
    console.warn("[email-automation] getEmailAutomation:", e);
    return DEFAULT_CONFIG;
  }
}

// Grava (upsert) a config de automação.
export async function setEmailAutomation(cfg: EmailAutomationConfig): Promise<void> {
  const { error } = await supabase
    .from("integrations_config")
    .upsert({ key: CONFIG_KEY, value: JSON.stringify(cfg) }, { onConflict: "key" });
  if (error) throw error;
}

// Envia o e-mail de automação para o lead ao entrar num estágio.
// Personaliza {nome} e {interesse} no subject/html do template.
// Nunca lança — todo erro é capturado e logado (best-effort).
export async function enviarEmailDeEtapa(
  lead: Lead,
  status: LeadStatus,
  templateId: string
): Promise<void> {
  try {
    const template = await getTemplate(templateId);
    if (!template) {
      console.warn(
        `[email-automation] template ${templateId} não encontrado para etapa "${status}" (lead ${lead.id})`
      );
      return;
    }

    const email = (lead.email ?? "").trim().toLowerCase();
    if (!email) return;

    // Checa supressão global antes de enviar.
    const suprimidos = await getSuppressedSet([email]);
    if (suprimidos.has(email)) {
      console.log(
        `[email-automation] e-mail ${email} suprimido — envio ignorado (etapa: "${status}")`
      );
      return;
    }

    // Substitui variáveis {nome} e {interesse} no subject e html.
    const nome = lead.name ?? "";
    const interesse = lead.service_interest ?? "";
    const substituir = (s: string) =>
      s.replace(/\{nome\}/gi, nome).replace(/\{interesse\}/gi, interesse);

    const subject = substituir(template.subject ?? "");
    const html = substituir(template.html ?? "");

    const provider = await getEmailProvider();
    const { id: messageId } = await provider.send({ to: email, subject, html });

    // Registra o evento de envio (best-effort — erro aqui não bloqueia o fluxo).
    recordEvent("automation", email, "sent", {
      lead_id: lead.id,
      status,
      template_id: templateId,
      message_id: messageId,
      provider: provider.name,
    }).catch((e) => {
      console.error(
        "[email-automation] recordEvent:",
        e instanceof Error ? e.message : e
      );
    });
  } catch (e) {
    console.error(
      `[email-automation] enviarEmailDeEtapa(lead=${lead.id}, status="${status}"):`,
      e instanceof Error ? e.message : e
    );
  }
}
