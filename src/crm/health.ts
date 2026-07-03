import { supabase } from "../db";
import { getEvolutionState } from "../whatsapp/evolution";
import { getEmailProvider } from "./email-provider";

// =====================================================================
// Alerta de queda da Evolution (WhatsApp). Um cron chama checkEvolutionHealth()
// de tempos em tempos. Se a conexao cair, avisa por E-MAIL (canal independente
// da Evolution — WhatsApp nao serve, pois e justamente ele que caiu). So avisa
// na TRANSICAO (cai -> avisa uma vez; volta -> avisa uma vez), sem spam.
// =====================================================================

const ALERT_STATE_KEY = "evolution_alert_state"; // 'up' | 'down'
const ALERT_EMAIL_KEY = "alert_email"; // e-mail que recebe os alertas
const PORTAL_URL = "https://crm-cranium.vercel.app";

async function getConfig(key: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("integrations_config").select("value").eq("key", key).maybeSingle();
    const v = (data as { value: string | null } | null)?.value?.trim();
    return v || null;
  } catch {
    return null;
  }
}
async function setConfig(key: string, value: string): Promise<void> {
  await supabase.from("integrations_config").upsert({ key, value }, { onConflict: "key" });
}

function alertHtml(kind: "down" | "up", state: string, quando: string): string {
  const down = kind === "down";
  const cor = down ? "#B91C1C" : "#047857";
  const titulo = down ? "WhatsApp da Cranium caiu" : "WhatsApp da Cranium reconectado";
  const corpo = down
    ? `A conexão da Evolution está <strong>${state}</strong>. Enquanto isso, o atendimento da IA, as demandas dos grupos e o envio de mensagens ficam parados.`
    : `A conexão voltou ao normal (<strong>open</strong>). O atendimento já está funcionando de novo.`;
  const cta = down
    ? `<a href="${PORTAL_URL}/whatsapp" style="display:inline-block;margin-top:14px;background:${cor};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Reconectar agora</a>`
    : "";
  return `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#f4f1fb;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;padding:24px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e1f3">
      <div style="background:${cor};padding:18px 24px;color:#fff;font-size:17px;font-weight:700">${down ? "⚠️" : "✅"} ${titulo}</div>
      <div style="padding:22px 24px;color:#1f2937;font-size:15px;line-height:1.6">
        <p style="margin:0 0 8px">${corpo}</p>
        <p style="margin:8px 0 0;font-size:13px;color:#6b7280">Detectado em ${quando}.</p>
        ${cta}
      </div>
    </div></body></html>`;
}

async function sendAlert(kind: "down" | "up", state: string): Promise<boolean> {
  const to = await getConfig(ALERT_EMAIL_KEY);
  if (!to) {
    console.warn("[health] alert_email nao configurado — alerta nao enviado");
    return false;
  }
  try {
    const provider = await getEmailProvider();
    const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    await provider.send({
      to,
      subject: kind === "down" ? "⚠️ WhatsApp da Cranium caiu (Evolution desconectada)" : "✅ WhatsApp da Cranium reconectado",
      html: alertHtml(kind, state, quando),
    });
    return true;
  } catch (e) {
    console.error("[health] sendAlert falhou:", e instanceof Error ? e.message : e);
    return false;
  }
}

export interface HealthResult {
  state: string;
  up: boolean;
  changed: boolean; // houve transicao (cai/volta)
  alertSent: boolean;
}

export async function checkEvolutionHealth(): Promise<HealthResult> {
  const state = await getEvolutionState();
  const up = state === "open";
  const last = (await getConfig(ALERT_STATE_KEY)) ?? "up";

  if (!up && last !== "down") {
    const alertSent = await sendAlert("down", state);
    await setConfig(ALERT_STATE_KEY, "down");
    return { state, up, changed: true, alertSent };
  }
  if (up && last === "down") {
    const alertSent = await sendAlert("up", state);
    await setConfig(ALERT_STATE_KEY, "up");
    return { state, up, changed: true, alertSent };
  }
  return { state, up, changed: false, alertSent: false };
}
