import OpenAI from "openai";
import { supabase } from "../db";
import { config } from "../config";
import { sendText, fetchGroupSubject, type GroupMessage } from "../whatsapp/evolution";

// =====================================================================
// Quadro de Demandas dos grupos de WhatsApp.
// Cliente posta "demanda ..." num grupo; a IA resume + classifica e vira
// card no kanban (aba Demandas). A IA SEMPRE promete retorno em ate 30 min.
// =====================================================================

const client = new OpenAI({ apiKey: config.openaiApiKey || "sk-missing-openai-key" });

// Lista de categorias (confirmada com o usuario). Usada no prompt da IA e nos filtros.
export const DEMAND_CATEGORIES = [
  "Criativo / Arte",
  "Tráfego / Campanha",
  "Landing / Site",
  "Relatório / Resultados",
  "Reunião / Alinhamento",
  "Financeiro / Pagamento",
  "Dúvida / Suporte",
  "Outro",
] as const;

export type DemandStatus = "aberta" | "andamento" | "concluida";

export interface Demand {
  id: string;
  external_id: string | null;
  group_jid: string;
  group_name: string | null;
  sender_phone: string | null;
  sender_name: string | null;
  category: string;
  summary: string;
  original_text: string | null;
  status: DemandStatus;
  created_at: string;
  updated_at: string;
}

const COLS =
  "id,external_id,group_jid,group_name,sender_phone,sender_name,category,summary,original_text,status,created_at,updated_at";

// Janela do estado "pendente": aciona "demanda", tem 30 min pra descrever.
const PENDING_TTL_MS = 30 * 60 * 1000;

// ---- CRUD (usado pela API/board) ------------------------------------
export async function listDemands(): Promise<Demand[]> {
  try {
    const { data, error } = await supabase
      .from("demands")
      .select(COLS)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[demands] listDemands:", error.message);
      return [];
    }
    return (data ?? []) as Demand[];
  } catch (e) {
    console.warn("[demands] listDemands:", e);
    return [];
  }
}

export async function updateDemandStatus(id: string, status: DemandStatus): Promise<void> {
  const { error } = await supabase
    .from("demands")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDemand(id: string): Promise<void> {
  const { error } = await supabase.from("demands").delete().eq("id", id);
  if (error) throw error;
}

// ---- Estado pendente -------------------------------------------------
async function getPending(groupJid: string, senderPhone: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("demand_pending")
      .select("created_at")
      .eq("group_jid", groupJid)
      .eq("sender_phone", senderPhone)
      .maybeSingle();
    if (!data) return false;
    const age = Date.now() - new Date((data as { created_at: string }).created_at).getTime();
    return age <= PENDING_TTL_MS;
  } catch {
    return false;
  }
}
async function setPending(groupJid: string, senderPhone: string): Promise<void> {
  await supabase
    .from("demand_pending")
    .upsert(
      { group_jid: groupJid, sender_phone: senderPhone, created_at: new Date().toISOString() },
      { onConflict: "group_jid,sender_phone" }
    );
}
async function clearPending(groupJid: string, senderPhone: string): Promise<void> {
  await supabase.from("demand_pending").delete().eq("group_jid", groupJid).eq("sender_phone", senderPhone);
}

// ---- Classificacao por IA -------------------------------------------
async function classifyDemand(text: string): Promise<{ category: string; summary: string }> {
  const prompt = `Você organiza demandas de clientes de uma agência de marketing.
A partir da mensagem do cliente no grupo, devolva SÓ um JSON puro:
{"category": "<uma das categorias>", "summary": "<resumo curto e claro da demanda, 1 frase, em português, sem travessão>"}

Categorias possíveis (escolha a mais próxima): ${DEMAND_CATEGORIES.join(" | ")}.

Mensagem do cliente:
"""${text}"""`;
  try {
    const resp = await client.chat.completions.create({
      model: config.agentModel,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = (resp.choices[0]?.message?.content ?? "").trim();
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]) as { category?: string; summary?: string };
      const category =
        (DEMAND_CATEGORIES as readonly string[]).find((c) => c === p.category) ??
        (DEMAND_CATEGORIES as readonly string[]).find((c) => (p.category ?? "").toLowerCase().includes(c.split(" ")[0].toLowerCase())) ??
        "Outro";
      const summary = (p.summary ?? "").trim() || text.slice(0, 140);
      return { category, summary };
    }
  } catch (e) {
    console.warn("[demands] classifyDemand:", e instanceof Error ? e.message : e);
  }
  // Fallback: sem IA, guarda o texto cru como resumo.
  return { category: "Outro", summary: text.slice(0, 140) };
}

// ---- Mensagens que a IA manda no grupo ------------------------------
function primeiroNome(n?: string | null): string {
  const t = (n ?? "").trim().split(/\s+/)[0];
  return t ? `, ${t}` : "";
}
function menuMessage(): string {
  return (
    "Oi! Me conta a sua demanda numa mensagem que eu já registro aqui. 📋\n\n" +
    "Se ajudar, diz também a categoria: " +
    DEMAND_CATEGORIES.join(", ") +
    ".\n\n" +
    "Assim que registrar, em até 30 minutos a gente te retorna com o prazo."
  );
}
function confirmMessage(summary: string, category: string, name?: string | null): string {
  return (
    `Demanda registrada${primeiroNome(name)}! ✅\n\n` +
    `📌 ${summary}\n` +
    `🏷️ ${category}\n\n` +
    "Em até 30 minutos a gente te retorna com o prazo."
  );
}

async function replyToGroup(groupJid: string, text: string): Promise<void> {
  try {
    await sendText(groupJid, text);
  } catch (e) {
    console.warn("[demands] replyToGroup:", e instanceof Error ? e.message : e);
  }
}

async function demandExists(externalId: string): Promise<boolean> {
  try {
    const { data } = await supabase.from("demands").select("id").eq("external_id", externalId).maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

// Registra a demanda (classifica, cria card, confirma no grupo). Dedupe por external_id.
async function registrarDemanda(msg: GroupMessage, text: string): Promise<void> {
  if (msg.externalId && (await demandExists(msg.externalId))) return; // reentrega
  const { category, summary } = await classifyDemand(text);
  const groupName = await fetchGroupSubject(msg.groupJid).catch(() => undefined);
  const row = {
    external_id: msg.externalId || null,
    group_jid: msg.groupJid,
    group_name: groupName ?? null,
    sender_phone: msg.senderPhone || null,
    sender_name: msg.senderName ?? null,
    category,
    summary,
    original_text: text,
    status: "aberta" as DemandStatus,
  };
  const { error } = await supabase.from("demands").insert(row);
  if (error) {
    if ((error as { code?: string }).code === "23505") return; // corrida/reentrega
    console.error("[demands] insert:", error.message);
    return;
  }
  await replyToGroup(msg.groupJid, confirmMessage(summary, category, msg.senderName));
}

// ---- Handler principal do grupo (chamado pelo webhook) --------------
export async function handleGroupMessage(msg: GroupMessage): Promise<void> {
  if (msg.fromMe) return; // ignora as nossas proprias mensagens
  const text = msg.text.trim();
  if (!text) return;

  const hasTrigger = /\bdemanda\b/i.test(text);

  // Sender ja acionou e agora esta descrevendo (sem repetir "demanda").
  if (!hasTrigger) {
    if (await getPending(msg.groupJid, msg.senderPhone)) {
      await clearPending(msg.groupJid, msg.senderPhone);
      await registrarDemanda(msg, text);
    }
    return; // papo normal de grupo: ignora
  }

  // Tem o gatilho. Ve se ja veio descricao junto ("demanda: preciso de ...").
  const semGatilho = text.replace(/demanda/gi, "").replace(/[:\-–—,.!?]/g, " ").trim();
  if (semGatilho.length >= 8) {
    await registrarDemanda(msg, text);
  } else {
    await setPending(msg.groupJid, msg.senderPhone);
    await replyToGroup(msg.groupJid, menuMessage());
  }
}
