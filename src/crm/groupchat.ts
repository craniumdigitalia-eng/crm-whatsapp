import { supabase } from "../db";
import { fetchAllGroups, type EvoGroup } from "../whatsapp/evolution";

// =====================================================================
// Cache da lista de grupos. O endpoint fetchAllGroups da Evolution é MUITO
// lento (chega a 25s+), o que estoura o timeout da função serverless. Então
// guardamos a lista num JSON em integrations_config e lemos do cache (rápido);
// a atualização (lenta) roda sob demanda (botão Atualizar) ou quando chega
// mensagem de grupo novo.
// =====================================================================
const GROUPS_CACHE_KEY = "groups_cache";

export interface CachedGroup { jid: string; name: string; size: number; pictureUrl?: string | null }

export async function getCachedGroups(): Promise<CachedGroup[]> {
  try {
    const { data } = await supabase
      .from("integrations_config")
      .select("value")
      .eq("key", GROUPS_CACHE_KEY)
      .maybeSingle();
    const raw = (data as { value: string | null } | null)?.value;
    if (!raw) return [];
    const arr = JSON.parse(raw) as CachedGroup[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function setCachedGroups(groups: CachedGroup[]): Promise<void> {
  await supabase
    .from("integrations_config")
    .upsert({ key: GROUPS_CACHE_KEY, value: JSON.stringify(groups) }, { onConflict: "key" });
}

// Atualiza o cache buscando na Evolution (LENTO). Use sob demanda.
export async function refreshGroupsCache(): Promise<number> {
  const groups: EvoGroup[] = await fetchAllGroups();
  if (groups.length === 0) return 0; // nao sobrescreve o cache com vazio (falha/timeout)
  const clean = groups.map((g) => ({ jid: g.jid, name: g.name, size: g.size, pictureUrl: g.pictureUrl ?? null }));
  await setCachedGroups(clean);
  return clean.length;
}

// Garante que um grupo (visto numa mensagem) esteja no cache, sem chamar a Evolution.
// pictureUrl opcional: quando disponivel (ex: evento de atualizacao), persiste no cache.
export async function ensureGroupCached(jid: string, name?: string, pictureUrl?: string | null): Promise<void> {
  try {
    const cur = await getCachedGroups();
    const existing = cur.find((g) => g.jid === jid);
    if (existing) {
      // Atualiza pictureUrl se fornecida e diferente do que esta no cache.
      if (pictureUrl !== undefined && existing.pictureUrl !== pictureUrl) {
        existing.pictureUrl = pictureUrl;
        await setCachedGroups(cur);
      }
      return;
    }
    cur.push({ jid, name: name?.trim() || "Grupo", size: 0, pictureUrl: pictureUrl ?? null });
    await setCachedGroups(cur);
  } catch { /* best-effort */ }
}

// =====================================================================
// Histórico de mensagens dos grupos (inbox da aba Grupos). Guardado a
// partir do momento em que passamos a receber (a Evolution não persiste
// histórico de grupo). Tolerante: se a tabela não existe, vira no-op/[].
// =====================================================================

export interface GroupChatMessage {
  id: string;
  external_id: string | null;
  group_jid: string;
  direction: "in" | "out";
  sender_phone: string | null;
  sender_name: string | null;
  body: string;
  created_at: string;
}

const COLS = "id,external_id,group_jid,direction,sender_phone,sender_name,body,created_at";

// Grava uma mensagem de grupo. Dedupe por external_id (reentrega/eco fromMe).
export async function storeGroupMessage(m: {
  externalId?: string | null;
  groupJid: string;
  direction: "in" | "out";
  senderPhone?: string | null;
  senderName?: string | null;
  body: string;
}): Promise<void> {
  try {
    if (m.externalId) {
      const { data } = await supabase
        .from("group_messages")
        .select("id")
        .eq("external_id", m.externalId)
        .maybeSingle();
      if (data) return; // ja gravada
    }
    const { error } = await supabase.from("group_messages").insert({
      external_id: m.externalId || null,
      group_jid: m.groupJid,
      direction: m.direction,
      sender_phone: m.senderPhone ?? null,
      sender_name: m.senderName ?? null,
      body: m.body,
    });
    if (error && (error as { code?: string }).code !== "23505") {
      console.warn("[groupchat] storeGroupMessage:", error.message);
    }
  } catch (e) {
    console.warn("[groupchat] storeGroupMessage:", e);
  }
}

// Mensagens de um grupo, ordem cronológica (mais antigas primeiro).
export async function listGroupMessages(groupJid: string, limit = 200): Promise<GroupChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from("group_messages")
      .select(COLS)
      .eq("group_jid", groupJid)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[groupchat] listGroupMessages:", error.message);
      return [];
    }
    return ((data ?? []) as GroupChatMessage[]).reverse();
  } catch {
    return [];
  }
}

// Remove uma mensagem pelo id da linha (UUID). Retorna os dados da linha para que o
// chamador decida se tambem precisa apagar no WhatsApp (direction='out' + external_id).
export async function deleteGroupMessage(rowId: string): Promise<{
  found: boolean;
  direction?: string;
  group_jid?: string;
  external_id?: string | null;
}> {
  try {
    const { data } = await supabase
      .from("group_messages")
      .select("direction,group_jid,external_id")
      .eq("id", rowId)
      .maybeSingle();
    if (!data) return { found: false };
    await supabase.from("group_messages").delete().eq("id", rowId);
    return { found: true, direction: data.direction, group_jid: data.group_jid, external_id: data.external_id };
  } catch (e) {
    console.warn("[groupchat] deleteGroupMessage:", e);
    return { found: false };
  }
}

// Remove mensagem de grupo pelo external_id (key.id do WhatsApp). Usada no webhook de
// revogacao: quando o WhatsApp notifica que uma mensagem foi apagada, buscamos pelo
// external_id e removemos do historico (best-effort, sem lancar excecao).
export async function deleteGroupMessageByExternalId(groupJid: string, externalId: string): Promise<void> {
  try {
    await supabase
      .from("group_messages")
      .delete()
      .eq("group_jid", groupJid)
      .eq("external_id", externalId);
  } catch (e) {
    console.warn("[groupchat] deleteGroupMessageByExternalId:", e);
  }
}

// Última mensagem por grupo (para a lista do inbox: preview + horário).
export async function getLastMessageByGroup(): Promise<Record<string, { body: string; at: string; direction: string }>> {
  try {
    // Pega as mais recentes e reduz para a primeira de cada grupo.
    const { data } = await supabase
      .from("group_messages")
      .select("group_jid,body,direction,created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    const map: Record<string, { body: string; at: string; direction: string }> = {};
    for (const r of (data ?? []) as { group_jid: string; body: string; direction: string; created_at: string }[]) {
      if (!map[r.group_jid]) map[r.group_jid] = { body: r.body, at: r.created_at, direction: r.direction };
    }
    return map;
  } catch {
    return {};
  }
}
