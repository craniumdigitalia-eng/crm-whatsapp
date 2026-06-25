import { config } from "./config";

// Envia uma mensagem de WhatsApp atraves do Make.
// O cenario do Make recebe { phone, text } e dispara o envio no WhatsApp.
export async function sendText(phone: string, text: string): Promise<void> {
  if (!config.makeSendUrl) {
    throw new Error("MAKE_SEND_URL nao configurada");
  }
  const res = await fetch(config.makeSendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Make sendText falhou (${res.status}): ${body}`);
  }
}
