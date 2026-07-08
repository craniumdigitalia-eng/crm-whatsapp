import { InboundMessage, sendText, fetchProfilePictureUrl } from "./whatsapp/evolution";
import {
  getOrCreateLead,
  addMessage,
  getMessages,
  resetFollowUp,
  getLead,
  setStatus,
  setLeadPhoto,
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
    // IMPORTANTE: NAO passar msg.name aqui. Em mensagem fromMe (enviada por nos),
    // o pushName e o NOSSO perfil do WhatsApp, nao o do cliente. Passar isso
    // sobrescreveria o nome do lead com o nome do atendente.
    const lead = await getOrCreateLead(msg.phone);
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

  // Busca e persiste a foto de perfil do WhatsApp — apenas quando ainda nao temos.
  // Best-effort: erros nao bloqueiam o atendimento.
  if (!lead.photo_url && isSendablePhone(msg.phone)) {
    fetchProfilePictureUrl(msg.phone)
      .then((fotoUrl) => {
        if (fotoUrl) return setLeadPhoto(lead.id, fotoUrl);
      })
      .catch((err) => console.warn("[handler] busca foto perfil falhou:", err));
  }

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
    // Timing humano: "digitando..." por um tempo proporcional ao tamanho da
    // mensagem antes de enviar (a Evolution mostra a presença durante o delay).
    const delay = delayDigitacao(parte);
    const sentId = await sendText(phone, parte, delay);
    await addMessage(leadId, "out", parte, sentId || undefined);
    if (i < lista.length - 1) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}

// Tempo de "digitação" humano por mensagem: base + ~45ms por caractere,
// limitado entre 1,4s e 6s. Mensagem curta digita rápido; longa, mais devagar.
function delayDigitacao(texto: string): number {
  const ms = 900 + texto.length * 45;
  return Math.min(6000, Math.max(1400, ms));
}

// Telefone "real" (so digitos, com DDI/DDD) — distingue de marcadores sinteticos meta:xxx
// criados quando o formulario nao trouxe telefone. So abrimos atendimento com numero real.
function isSendablePhone(phone: string): boolean {
  return /^\+?\d{8,15}$/.test(phone);
}

// De onde o lead entrou — muda a ABERTURA do opener.
// 'meta' = anúncio (Lead Ads); 'site' = formulário do site (testou algo antes de deixar os dados).
export type OpenerOrigin = "site" | "meta";

// Descreve, em linguagem natural, O QUE a pessoa fez no site antes de deixar os dados —
// pra abordagem puxar assunto pelo teste específico (não abertura genérica de anúncio).
// Deriva do que o site manda em form_data (origem_form / interest / source / produto / pagina).
function descreveTesteSite(formData?: Record<string, string>): string {
  const f = formData ?? {};
  const src = `${f.origem_form ?? ""} ${f.interest ?? ""} ${f.source ?? ""}`.toLowerCase();
  const pagina = (f.pagina ?? "").trim();

  if (src.includes("corretor"))
    return "testou a nossa IA de atendimento na landing de corretores, ou seja, viu na prática a IA que atende, qualifica e agenda os clientes dele no automático";
  if (src.includes("proposta"))
    return "pediu uma proposta pelo site";
  if (src.includes("home") || src.includes("testar ia") || src.includes("teste"))
    return "testou a nossa IA de atendimento pelo site";
  if ((f.produto ?? "").trim())
    return `demonstrou interesse em "${f.produto}" pelo site`;
  if (pagina)
    return `preencheu o formulário na página ${pagina}`;
  return "interagiu com o nosso site e deixou os dados";
}

// Campos que NÃO entram no dump de "dados deixados" (ou são ruído técnico, ou têm
// tratamento próprio, como o resumo da conversa que ganha um bloco dedicado).
const OPENER_HIDE_KEYS = new Set([
  "conversa", "conversation", "resumo", "transcript",
  "defer_opener", "pagina", "origem_form", "interest", "source", "produto",
]);

// Monta o contexto do primeiro contato a partir das respostas do formulario, simulando
// a "chegada" do lead. O agente le isso como a fala inicial e responde acolhendo + 1 pergunta.
function openerContext(formData?: Record<string, string>, origin: OpenerOrigin = "meta"): string {
  const linhas = Object.entries(formData ?? {})
    .filter(([k, v]) => v && v.trim() && !OPENER_HIDE_KEYS.has(k))
    .map(([k, v]) => `• ${k}: ${v}`);
  const respostas = linhas.length ? `\nDados que deixou:\n${linhas.join("\n")}` : "";

  if (origin === "site") {
    const f = formData ?? {};
    const teste = descreveTesteSite(formData);
    // Resumo da conversa que a pessoa teve com a nossa IA NO SITE (Marina/Rafaela) antes
    // de virar lead — é o material mais rico pra uma abordagem específica.
    const conversa = (f.conversa ?? f.conversation ?? f.resumo ?? f.transcript ?? "").trim();
    const blocoConversa = conversa
      ? `\n\nRESUMO DA CONVERSA QUE ELA TEVE COM A NOSSA IA NO SITE (use os detalhes reais dela pra abrir, é ouro):\n${conversa}`
      : "";
    return `[Lead que ACABOU de chegar pelo SITE da Cranium (NÃO é lead frio de anúncio). Contexto do que aconteceu: a pessoa ${teste}.${respostas}${blocoConversa}
Abra a conversa fazendo referência DIRETA e ESPECÍFICA ao que ela fez/perguntou no site (cite um detalhe real do resumo acima quando houver, é o seu gancho). NÃO use abertura genérica de anúncio nem invente o que ela disse. Cumprimente pelo nome, conecte com o que ela testou e faça UMA única pergunta que dê sequência natural (ex.: o que achou, o que motivou a testar). Objetivo: entender se ela realmente quer avançar e conduzir pro SPIN até a sessão estratégica.]`;
  }

  return `[Lead recem-chegado pelo formulario do Facebook/Instagram (Lead Ads).${respostas}\nInicie o atendimento: cumprimente pelo nome quando souber e faca a primeira pergunta de qualificacao.]`;
}

// Dispara o opener outbound de um lead que entrou por anuncio (Meta Lead Ads via Make).
// Diferente de handleInbound: nao ha mensagem do lead — nos iniciamos a conversa.
// Reusa o agente (mesma personalidade/qualificacao) e envia via sendText (Make/Evolution).
// Idempotencia: o chamador so dispara em lead recem-criado (created === true).
export async function iniciarAtendimento(
  lead: Lead,
  formData?: Record<string, string>,
  origin: OpenerOrigin = "meta"
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
  // Interruptor global: se o agente estiver desligado, nao envia o opener.
  // O lead permanece "novo" para o humano pegar na fila.
  if (!(await getAgentEnabled())) {
    console.log("[handler] agente DESLIGADO, opener nao enviado");
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
        body: openerContext(formData, origin),
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
