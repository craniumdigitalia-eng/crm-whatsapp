import { config } from "../config";

export interface InboundMessage {
  phone: string; // numero do lead, somente digitos (ex: 5511999998888)
  name?: string;
  text: string;
  fromMe: boolean;
  externalId: string; // key.id da Evolution (ou ID repassado pelo Make) — base do dedupe
}

// Envia uma mensagem de texto via Evolution API (formato v2).
export async function sendText(phone: string, text: string): Promise<void> {
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
