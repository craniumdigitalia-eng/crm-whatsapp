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
import { AUTO_STATUSES, Lead, Message } from "./types";

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

// Telefone "real" (so digitos, com DDI/DDD) — distingue de marcadores sinteticos meta:xxx
// criados quando o formulario nao trouxe telefone. So abrimos atendimento com numero real.
function isSendablePhone(phone: string): boolean {
  return /^\+?\d{8,15}$/.test(phone);
}

// Monta o contexto do primeiro contato a partir das respostas do formulario, simulando
// a "chegada" do lead. O agente le isso como a fala inicial e responde acolhendo + 1 pergunta.
function openerContext(formData?: Record<string, string>): string {
  const linhas = Object.entries(formData ?? {})
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `• ${k}: ${v}`);
  const respostas = linhas.length ? `\nRespostas que preencheu:\n${linhas.join("\n")}` : "";
  return `[Lead recem-chegado pelo formulario do Facebook/Instagram (Lead Ads).${respostas}\nInicie o atendimento: cumprimente pelo nome quando souber e faca a primeira pergunta de qualificacao.]`;
}

// Dispara o opener outbound de um lead que entrou por anuncio (Meta Lead Ads via Make).
// Diferente de handleInbound: nao ha mensagem do lead — nos iniciamos a conversa.
// Reusa o agente (mesma personalidade/qualificacao) e envia via sendText (Make/Evolution).
// Idempotencia: o chamador so dispara em lead recem-criado (created === true).
export async function iniciarAtendimento(
  lead: Lead,
  formData?: Record<string, string>
): Promise<void> {
  const fresh = (await getLead(lead.id)) ?? lead;

  // Numero sintetico (formulario sem telefone) — nao da pra abrir conversa. Loga e sai.
  if (!isSendablePhone(fresh.phone)) {
    console.warn(`[handler] iniciarAtendimento: lead ${fresh.id} sem telefone valido (${fresh.phone}); opener nao enviado.`);
    return;
  }

  // So abre nos estagios cobertos pelo agente (lead novo de anuncio = "novo").
  if (!AUTO_STATUSES.includes(fresh.status)) {
    console.log(`[handler] iniciarAtendimento: lead ${fresh.phone} em '${fresh.status}', opener ignorado.`);
    return;
  }
  if (fresh.status === "novo") await setStatus(fresh.id, "em_atendimento");

  try {
    // Historico sintetico (NAO persistido): da o contexto do anuncio ao agente.
    const synthetic: Message[] = [
      {
        id: "synthetic-opener",
        lead_id: fresh.id,
        direction: "in",
        body: openerContext(formData),
        external_id: null,
        created_at: new Date().toISOString(),
      },
    ];
    const result = await generateReply(fresh, synthetic);
    if (result.reply) {
      await sendText(fresh.phone, result.reply);
      await addMessage(fresh.id, "out", result.reply);
    }
  } catch (err) {
    console.error(`[handler] iniciarAtendimento: erro ao abrir conversa com ${fresh.phone}:`, err);
  }
}
