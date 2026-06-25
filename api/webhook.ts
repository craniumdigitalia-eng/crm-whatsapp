import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getOrCreateLead, addMessage, getMessages, resetFollowUp, setStatus } from "../lib/leads";
import { generateReply } from "../lib/agent";
import { sendText } from "../lib/whatsapp";
import { AUTO_STATUSES } from "../lib/types";

// Entrada de mensagens do WhatsApp, via Make.
// O cenario do Make deve fazer POST aqui com JSON: { phone, name?, text }.
// Responde a mensagem do lead com o agente de IA (quando aplicavel).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "use POST" });
    return;
  }

  const { phone, name, text } = (req.body ?? {}) as {
    phone?: string;
    name?: string;
    text?: string;
  };

  if (!phone || !text || !text.trim()) {
    res.status(400).json({ error: "phone e text sao obrigatorios" });
    return;
  }

  // Responde rapido ao Make e processa em seguida.
  res.status(200).json({ ok: true });

  try {
    const lead = await getOrCreateLead(phone, name);
    await addMessage(lead.id, "in", text.trim());
    await resetFollowUp(lead.id); // lead respondeu -> zera follow-up

    // So responde automaticamente nos estagios cobertos pelo agente.
    if (!AUTO_STATUSES.includes(lead.status)) {
      console.log(`[webhook] Lead ${phone} em '${lead.status}', agente nao responde.`);
      return;
    }

    if (lead.status === "novo") {
      await setStatus(lead.id, "em_atendimento");
      lead.status = "em_atendimento";
    }

    const history = await getMessages(lead.id);
    const result = await generateReply(lead, history);

    if (result.reply) {
      await sendText(phone, result.reply);
      await addMessage(lead.id, "out", result.reply);
    }
  } catch (err) {
    console.error(`[webhook] erro ao processar ${phone}:`, err);
  }
}

// TODO(time): deduplicar por id da mensagem (Make pode reenviar). Sugestao:
// receber tambem { messageId } e ignorar se ja gravado (ex: tabela processed_messages).
