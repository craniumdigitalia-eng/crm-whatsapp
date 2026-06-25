import { createHash } from "crypto";
import { config } from "../config";

export interface InboundMessage {
  phone: string; // numero do lead, somente digitos (ex: 5511999998888)
  name?: string;
  text: string;
  fromMe: boolean;
  externalId: string; // key.id da Evolution (ou ID repassado pelo Make) — base do dedupe
}

// Gera um external_id deterministico quando o Make nao fornece o wamid nativo.
// Janela de 1 segundo (epoch_segundos) protege contra reentregas rapidas do Make.
// Risco residual: mesma mensagem enviada duas vezes no mesmo segundo → falso positivo de dedupe.
// Solucao definitiva: mapear message.id (wamid) no cenario Make como campo "id".
function hashExternalId(phone: string, text: string, epochMs: number): string {
  return createHash("sha256")
    .update(`${phone}|${text}|${Math.floor(epochMs / 1000)}`)
    .digest("hex");
}

// Envia uma mensagem de texto. Se MAKE_SEND_URL estiver definido, usa o Make como canal;
// caso contrario, fala direto com a Evolution API (fallback para dev local).
export async function sendText(phone: string, text: string): Promise<void> {
  if (config.makeSendUrl) {
    // Branch Make: POST {MAKE_SEND_URL} com { phone, text }
    const res = await fetch(config.makeSendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Make sendText falhou (${res.status}): ${body}`);
    }
    return;
  }

  // Fallback Evolution (dev local / sem MAKE_SEND_URL).
  const url = `${config.evolutionUrl}/message/sendText/${config.evolutionInstance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.evolutionApiKey,
    },
    body: JSON.stringify({ number: phone, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Evolution sendText falhou (${res.status}): ${body}`);
  }
}

// Normaliza o payload do webhook da Evolution (evento messages.upsert).
// A Evolution pode mandar um objeto ou uma lista em body.data.
export function parseWebhook(body: any): InboundMessage[] {
  const out: InboundMessage[] = [];
  const items = Array.isArray(body?.data) ? body.data : [body?.data];

  for (const item of items) {
    if (!item) continue;
    const key = item.key ?? {};
    const remoteJid: string = key.remoteJid ?? "";
    // Ignora grupos e status; aceita apenas conversas individuais (@s.whatsapp.net).
    if (!remoteJid.endsWith("@s.whatsapp.net")) continue;

    const phone = remoteJid.split("@")[0];
    const fromMe: boolean = !!key.fromMe;
    const externalId: string = key.id ?? "";

    const msg = item.message ?? {};
    const text: string =
      msg.conversation ??
      msg.extendedTextMessage?.text ??
      msg.imageMessage?.caption ??
      msg.videoMessage?.caption ??
      "";

    if (!text.trim()) continue;

    out.push({ phone, name: item.pushName, text: text.trim(), fromMe, externalId });
  }
  return out;
}

// Normaliza o payload entregue pelo Make em POST /api/webhook.
// Contrato esperado: { phone, name?, text, id? }
// — phone: somente digitos (ex: "5511999998888")
// — id: wamid nativo do WhatsApp (configure no cenario Make: module WhatsApp Business Cloud
//        → campo message.id mapeado como "id"). Preferencia para dedupe exato.
//        Se ausente, gera hash deterministico como fallback (ver hashExternalId).
// — fromMe: sempre false — o Make so encaminha mensagens do lead; nossas saem via sendText.
export function parseMakeWebhook(body: any): InboundMessage[] {
  const phone = (body?.phone ?? "").toString().trim();
  const text = (body?.text ?? "").toString().trim();

  // Descarta payload invalido (sem telefone ou sem texto).
  if (!phone || !text) return [];

  const id: string | undefined = body?.id ? String(body.id) : undefined;
  const externalId = id ?? hashExternalId(phone, text, Date.now());

  return [
    {
      phone,
      name: body?.name ? String(body.name) : undefined,
      text,
      fromMe: false,
      externalId,
    },
  ];
}
