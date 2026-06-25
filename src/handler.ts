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

  const lead = await getOrCreateLead(msg.phone, msg.name);

  // Guarda de dedupe: se o external_id ja foi processado, encerra sem reprocessar.
  // Protege contra reentregas do Make/Evolution sem disparar multiplas respostas.
  const inserida = await addMessage(lead.id, "in", msg.text, msg.externalId || undefined);
  if (!inserida) {
    console.log(`[handler] Mensagem duplicada ignorada (external_id=${msg.externalId})`);
    return;
  }

  await resetFollowUp(lead.id); // lead respondeu -> zera follow-up

  // Recarrega para pegar status atual.
  const fresh = await getLead(lead.id);
  if (!fresh) return; // nunca deve acontecer, mas guarda defensiva

  // So responde automaticamente nos estagios do funil cobertos pelo agente.
  if (!AUTO_STATUSES.includes(fresh.status)) {
    console.log(`[handler] Lead ${fresh.phone} esta em '${fresh.status}', agente nao responde.`);
    return;
  }

  // Marca como "em atendimento" se ainda estava "novo".
  if (fresh.status === "novo") {
    await setStatus(fresh.id, "em_atendimento");
  }

  try {
    const history = await getMessages(fresh.id);
    const result = await generateReply(fresh, history);

    if (result.reply) {
      await sendText(fresh.phone, result.reply);
      await addMessage(fresh.id, "out", result.reply);
    }
  } catch (err) {
    console.error(`[handler] Erro ao gerar/enviar resposta para ${fresh.phone}:`, err);
  }
}
