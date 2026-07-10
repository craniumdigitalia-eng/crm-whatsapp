import { createHash } from "crypto";
import { config } from "../config";
import { getEvolutionConfig } from "../crm/integrations";

export interface InboundMessage {
  phone: string; // numero do lead, somente digitos (ex: 5511999998888)
  name?: string;
  text: string;
  fromMe: boolean;
  externalId: string; // key.id da Evolution (ou ID repassado pelo Make) — base do dedupe
}

// Mensagem vinda de um GRUPO de WhatsApp (...@g.us). Usada pelo quadro de Demandas.
export interface GroupMessage {
  groupJid: string; // id do grupo (remoteJid, ...@g.us)
  senderPhone: string; // participante que enviou (key.participant), so digitos
  senderName?: string; // pushName do remetente
  text: string;
  fromMe: boolean;
  externalId: string; // key.id
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

// Envia uma mensagem de texto. Retorna o key.id da mensagem enviada (Evolution) para
// deduplicar o eco fromMe que a Evolution reenvia ao webhook. Retorna null no Make
// (nao ha eco fromMe) ou se o parse da resposta falhar (nao quebra o envio).
// Se MAKE_SEND_URL estiver definido, usa o Make como canal; caso contrario, fala
// direto com a Evolution API (ADR-004).
// delayMs: se > 0, a Evolution mostra "digitando..." por esse tempo antes de
// entregar a mensagem (presença composing). Deixa a IA parecer gente digitando.
// Timeout padrao para chamadas a Evolution/Make: 10s.
// Somado ao timeout do cliente OpenAI (25s x 2 iteracoes comuns = 50s),
// cabe dentro do maxDuration de 60s do webhook.
const EVO_TIMEOUT_MS = 10_000;

export async function sendText(phone: string, text: string, delayMs = 0): Promise<string | null> {
  if (config.makeSendUrl) {
    // Branch Make: POST {MAKE_SEND_URL} com { phone, text }
    const res = await fetch(config.makeSendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, text }),
      signal: AbortSignal.timeout(EVO_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Make sendText falhou (${res.status}): ${body}`);
    }
    return null; // Make nao ecoa fromMe — sem id para dedup
  }

  // Canal Evolution (ADR-004). Credenciais via env + override da aba WhatsApp.
  const evo = await getEvolutionConfig();
  const url = `${evo.url}/message/sendText/${evo.instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: evo.apiKey,
    },
    body: JSON.stringify(
      delayMs > 0 ? { number: phone, text, delay: delayMs } : { number: phone, text }
    ),
    signal: AbortSignal.timeout(EVO_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Evolution sendText falhou (${res.status}): ${body}`);
  }
  // Retorna key.id para que o eco fromMe seja deduplicado em addMessage.
  // Tolerante: parse falha → null (nao quebra o envio; eco nao sera deduplicado).
  const json = await res.json().catch(() => null);
  return (json?.key?.id as string) ?? null;
}

// Busca a URL da foto de perfil do WhatsApp de um contato via Evolution.
// Tolerante: qualquer falha (rede, !res.ok, timeout, contato sem foto) retorna null, nunca lanca.
// Branch Make (config.makeSendUrl): sem suporte — retorna null.
export async function fetchProfilePictureUrl(phone: string): Promise<string | null> {
  if (config.makeSendUrl) return null;
  try {
    const evo = await getEvolutionConfig();
    const url = `${evo.url}/chat/fetchProfilePictureUrl/${evo.instance}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evo.apiKey,
      },
      body: JSON.stringify({ number: phone }),
      signal: AbortSignal.timeout(EVO_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return (json?.profilePictureUrl as string) ?? null;
  } catch {
    return null;
  }
}

// Estado da conexao da instancia: 'open' (conectado), 'connecting', 'close'
// (desconectado) ou 'unreachable' (servidor fora/erro/timeout). Base do alerta de queda.
export async function getEvolutionState(): Promise<string> {
  if (config.makeSendUrl) return "open"; // canal Make, sem instancia Evolution
  try {
    const evo = await getEvolutionConfig();
    const res = await fetch(`${evo.url}/instance/connectionState/${evo.instance}`, {
      headers: { apikey: evo.apiKey },
      signal: AbortSignal.timeout(EVO_TIMEOUT_MS),
    });
    if (!res.ok) return "unreachable";
    const json = await res.json().catch(() => null);
    return (json?.instance?.state as string) ?? "unreachable";
  } catch {
    return "unreachable";
  }
}

export interface EvoGroup {
  jid: string;
  name: string;
  size: number;
  pictureUrl?: string | null;
}

// Lista TODOS os grupos em que o numero (instancia) participa. Best-effort: [] em erro/timeout.
export async function fetchAllGroups(): Promise<EvoGroup[]> {
  if (config.makeSendUrl) return [];
  try {
    const evo = await getEvolutionConfig();
    const url = `${evo.url}/group/fetchAllGroups/${evo.instance}?getParticipants=false`;
    const res = await fetch(url, {
      headers: { apikey: evo.apiKey },
      signal: AbortSignal.timeout(EVO_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    const arr = Array.isArray(json) ? json : Array.isArray(json?.groups) ? json.groups : [];
    return (arr as any[])
      .map((g) => ({
        jid: (g.id ?? g.jid ?? "").toString(),
        name: ((g.subject ?? g.name ?? "") as string).trim() || "Grupo sem nome",
        size: Number(g.size ?? (Array.isArray(g.participants) ? g.participants.length : 0)) || 0,
        pictureUrl: (g.pictureUrl ?? g.profilePicUrl ?? null) as string | null,
      }))
      .filter((g) => g.jid.endsWith("@g.us"));
  } catch {
    return [];
  }
}

// Busca o nome/assunto de um grupo pela Evolution (best-effort; undefined se falhar/timeout).
export async function fetchGroupSubject(groupJid: string): Promise<string | undefined> {
  if (config.makeSendUrl) return undefined;
  try {
    const evo = await getEvolutionConfig();
    const url = `${evo.url}/group/findGroupInfos/${evo.instance}?groupJid=${encodeURIComponent(groupJid)}`;
    const res = await fetch(url, {
      headers: { apikey: evo.apiKey },
      signal: AbortSignal.timeout(EVO_TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    const json = await res.json().catch(() => null);
    const subject = json?.subject ?? (Array.isArray(json) ? json[0]?.subject : undefined);
    return typeof subject === "string" && subject.trim() ? subject.trim() : undefined;
  } catch {
    return undefined;
  }
}

// Normaliza o payload do webhook da Evolution (evento messages.upsert).
// A Evolution pode mandar um objeto ou uma lista em body.data.
// Envia uma imagem (por URL) ao número/grupo pela Evolution. Best-effort: loga e
// segue em erro/timeout (não quebra o atendimento). Usada pelo agente para provas/prints.
export async function sendMedia(phone: string, media: string, caption?: string): Promise<void> {
  if (config.makeSendUrl) return; // canal Make não trata mídia aqui
  try {
    const evo = await getEvolutionConfig();
    const res = await fetch(`${evo.url}/message/sendMedia/${evo.instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evo.apiKey },
      body: JSON.stringify({ number: phone, mediatype: "image", media, caption: caption || undefined }),
      signal: AbortSignal.timeout(EVO_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[evolution] sendMedia falhou (${res.status}): ${body.slice(0, 200)}`);
    }
  } catch (e) {
    console.warn("[evolution] sendMedia:", e instanceof Error ? e.message : e);
  }
}

// Apaga uma mensagem de grupo para todos (fromMe=true) via Evolution API.
// Limite do WhatsApp: so e possivel apagar-para-todos mensagens enviadas pelo PROPRIO
// numero (direction='out'), dentro da janela de tempo permitida (~60h). Mensagens
// recebidas (direction='in') nao podem ser apagadas do WhatsApp dos outros.
// Best-effort: retorna { ok, error } sem lancar excecao — a UI decide como avisar.
// Endpoint: POST /chat/deleteMessageForEveryone/{instance}
//   body: { id: string, remoteJid: string, fromMe: boolean, participant?: string }
export async function deleteGroupMessageForEveryone(
  groupJid: string,
  messageId: string,
  fromMe: boolean,
  participant?: string
): Promise<{ ok: boolean; error?: string }> {
  if (config.makeSendUrl) return { ok: false, error: "canal Make nao suporta delecao" };
  try {
    const evo = await getEvolutionConfig();
    const url = `${evo.url}/chat/deleteMessageForEveryone/${evo.instance}`;
    const bodyPayload: Record<string, unknown> = { id: messageId, remoteJid: groupJid, fromMe };
    if (participant) bodyPayload.participant = participant;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evo.apiKey },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(EVO_TIMEOUT_MS),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `Evolution ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Extrai eventos de REVOGACAO de mensagem de grupo de um payload da Evolution.
// A Evolution pode sinalizar revogacao de formas diferentes dependendo da versao:
//   - messages.update com messageStubType = 'REVOKE' ou key.messageStubType
//   - messages.delete com key do grupo
// Retorna lista de { groupJid, externalId } para remocao do historico (best-effort).
export interface GroupRevoke { groupJid: string; externalId: string }
export function parseGroupRevoke(body: any): GroupRevoke[] {
  const out: GroupRevoke[] = [];
  // Suporte a messages.update (array ou objeto em body.data)
  const items = Array.isArray(body?.data) ? body.data : [body?.data];
  for (const item of items) {
    if (!item) continue;
    const key = item.key ?? {};
    const remoteJid: string = key.remoteJid ?? "";
    if (!remoteJid.endsWith("@g.us")) continue;

    const externalId: string = key.id ?? "";
    if (!externalId) continue;

    // Detecta revogacao: messageStubType presente com valor REVOKE, ou evento = messages.delete
    const stubType: string | undefined =
      item.messageStubType ?? item.message?.messageStubType ?? body?.event;
    const isRevoke =
      stubType === "REVOKE" ||
      stubType === "messages.delete" ||
      (typeof stubType === "string" && stubType.toLowerCase().includes("revok"));
    if (!isRevoke) continue;

    out.push({ groupJid: remoteJid, externalId });
  }
  return out;
}

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

// Extrai as mensagens de GRUPO (...@g.us) de um payload messages.upsert da Evolution.
// Espelha parseWebhook, mas guarda o grupo (remoteJid) e o remetente (key.participant).
export function parseGroupWebhook(body: any): GroupMessage[] {
  const out: GroupMessage[] = [];
  const items = Array.isArray(body?.data) ? body.data : [body?.data];
  for (const item of items) {
    if (!item) continue;
    const key = item.key ?? {};
    const remoteJid: string = key.remoteJid ?? "";
    if (!remoteJid.endsWith("@g.us")) continue;

    const senderJid: string = key.participant ?? "";
    const senderPhone = senderJid.split("@")[0] || "";
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

    out.push({
      groupJid: remoteJid,
      senderPhone,
      senderName: item.pushName,
      text: text.trim(),
      fromMe,
      externalId,
    });
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
