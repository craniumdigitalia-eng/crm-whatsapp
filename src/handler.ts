import { InboundMessage, sendText } from "./whatsapp/evolution";
import {
  getOrCreateLead,
  addMessage,
  getMessages,
  resetFollowUp,
  getLead,
  setStatus,
} from "./crm/leads";
import { generateReply } from "./agent/agent";
import { AUTO_STATUSES } from "./types";

// Processa uma mensagem recebida do lead: registra, e (se for o caso) responde com a IA.
export async function handleInbound(msg: InboundMessage): Promise<void> {
  if (msg.fromMe) return; // ignora mensagens enviadas por nos

  const lead = getOrCreateLead(msg.phone, msg.name);
  addMessage(lead.id, "in", msg.text);
  resetFollowUp(lead.id); // lead respondeu -> zera follow-up

  // Recarrega para pegar status atual.
  const fresh = getLead(lead.id)!;

  // So responde automaticamente nos estagios do funil cobertos pelo agente.
  if (!AUTO_STATUSES.includes(fresh.status)) {
    console.log(`[handler] Lead ${fresh.phone} esta em '${fresh.status}', agente nao responde.`);
    return;
  }

  // Marca como "em atendimento" se ainda estava "novo".
  if (fresh.status === "novo") {
    setStatus(fresh.id, "em_atendimento");
  }

  try {
    const history = getMessages(fresh.id);
    const result = await generateReply(getLead(fresh.id)!, history);

    if (result.reply) {
      await sendText(fresh.phone, result.reply);
      addMessage(fresh.id, "out", result.reply);
    }
  } catch (err) {
    console.error(`[handler] Erro ao gerar/enviar resposta para ${fresh.phone}:`, err);
  }
}
