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
import { getAgentEnabled } from "./agent/config";
import { getCadence } from "./followup/cadence";
import { AUTO_STATUSES, Lead, Message } from "./types";

// Processa uma mensagem recebida do lead: registra, e (se for o caso) responde com a IA.
export async function handleInbound(msg: InboundMessage): Promise<void> {
  if (msg.fromMe) {
    // Mensagem que SAIU do nosso numero: pode ser eco da propria IA/plataforma (ja gravada
    // com external_id) ou o HUMANO respondendo direto no WhatsApp (fora da plataforma).
    if (!msg.text) return;
    const lead = await getOrCreateLead(msg.phone, msg.name);
    const nova = await addMessage(lead.id, "out", msg.text, msg.externalId || undefined);
    if (!nova) return; // eco de algo que NOS enviamos (dedup por external_id) — IA nao recua
    // Mensagem nova nao reconhecida: humano respondeu diretamente pelo WhatsApp → IA recua.
    if (lead.status !== "humano") {
      await setStatus(lead.id, "humano");
      console.log(`[handler] Humano respondeu no WhatsApp; lead ${lead.phone} -> 'humano' (IA recuou).`);
    }
    return;
  }

  const lead = await getOrCreateLead(msg.phone, msg.name);

  // Guarda de dedupe: se o external_id ja foi processado, encerra sem reprocessar.
  // Protege contra reentregas do Make/Evolution sem disparar multiplas respostas.
  const inserida = await addMessage(lead.id, "in", msg.text, msg.externalId || undefined);
  if (!inserida) {
    console.log(`[handler] Mensagem duplicada ignorada (external_id=${msg.externalId})`);
    return;
  }

  // Lead respondeu -> sai da cadencia (last_direction vira 'in', deixa de ser
  // candidato no scheduler). No modelo de CADENCIA (agendamento absoluto por
  // dueDay), PRESERVAMOS o follow_up_count: a cadencia apenas PAUSA e retoma no
  // toque certo se a conversa esfriar — zera-lo reiniciaria do dia 1 (toques da
  // fase 1) de forma errada. No fallback (ROTATION), zeramos como antes para o
  // lead reiniciar a contagem de retomadas.
  const cadence = await getCadence();
  if (!(cadence.enabled && cadence.steps.length > 0)) {
    await resetFollowUp(lead.id);
  }

  // Interruptor global: se o agente estiver desligado, persiste a mensagem
  // (o humano ve no CRM) mas nao gera nem envia resposta automatica.
  if (!(await getAgentEnabled())) {
    console.log("[handler] agente DESLIGADO, nao responde");
    return;
  }

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
      await enviarEmPartes(fresh.phone, fresh.id, result.reply);
    }
  } catch (err) {
    console.error(`[handler] Erro ao gerar/enviar resposta para ${fresh.phone}:`, err);
  }
}

// Quebra a resposta da IA em mensagens curtas (separadas por linha em branco) e envia
// cada parte como uma mensagem propria no WhatsApp, com um pequeno intervalo entre elas
// (fica mais natural, como uma pessoa digitando). Cada parte e gravada com o external_id
// do envio, para o eco fromMe continuar sendo deduplicado (mantem o recuo automatico da IA).
async function enviarEmPartes(phone: string, leadId: string, texto: string): Promise<void> {
  const partes = texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 4); // no maximo 4 mensagens, evita flood
  const lista = partes.length > 0 ? partes : [texto.trim()];
  for (let i = 0; i < lista.length; i++) {
    const parte = lista[i];
    if (!parte) continue;
    const sentId = await sendText(phone, parte);
    await addMessage(leadId, "out", parte, sentId || undefined);
    if (i < lista.length - 1) {
      await new Promise((r) => setTimeout(r, 600));
    }
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

  // Interruptor global: se o agente estiver desligado, nao envia o opener.
  // O lead ja foi criado/registrado pelo chamador; o humano ve no CRM.
  if (!(await getAgentEnabled())) {
    console.log("[handler] agente DESLIGADO, opener nao enviado");
    return;
  }

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
      await enviarEmPartes(fresh.phone, fresh.id, result.reply);
    }
  } catch (err) {
    console.error(`[handler] iniciarAtendimento: erro ao abrir conversa com ${fresh.phone}:`, err);
  }
}
