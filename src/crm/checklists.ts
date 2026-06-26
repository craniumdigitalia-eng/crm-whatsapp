import { supabase } from "../db";
import { ChecklistItem } from "../types";

// Colunas explicitas — evita SELECT * e garante paridade com a interface ChecklistItem.
const ITEM_COLS = "id,lead_id,text,done,position,created_at,updated_at";

// Itens de checklist de um lead, ordenados por position (e created_at como desempate).
export async function listChecklist(leadId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from("checklist_items")
    .select(ITEM_COLS)
    .eq("lead_id", leadId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChecklistItem[];
}

// Adiciona um item ao fim do checklist (position = max + 1).
export async function addChecklistItem(leadId: string, text: string): Promise<ChecklistItem> {
  // Descobre a maior position atual do lead para anexar no fim.
  const { data: last, error: maxErr } = await supabase
    .from("checklist_items")
    .select("position")
    .eq("lead_id", leadId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) throw maxErr;
  const nextPosition = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("checklist_items")
    .insert({ lead_id: leadId, text, position: nextPosition })
    .select(ITEM_COLS)
    .single();
  if (error) throw error;
  return data as ChecklistItem;
}

// Atualiza text, done e/ou position de um item. Retorna o item atualizado (ou undefined se nao existe).
export async function updateChecklistItem(
  itemId: string,
  fields: Partial<Pick<ChecklistItem, "text" | "done" | "position">>
): Promise<ChecklistItem | undefined> {
  const patch: Record<string, unknown> = {};
  if (fields.text !== undefined) patch.text = fields.text;
  if (fields.done !== undefined) patch.done = fields.done;
  if (fields.position !== undefined) patch.position = fields.position;
  if (Object.keys(patch).length === 0) {
    const { data } = await supabase.from("checklist_items").select(ITEM_COLS).eq("id", itemId).maybeSingle();
    return (data as ChecklistItem) ?? undefined;
  }
  const { data, error } = await supabase
    .from("checklist_items")
    .update(patch)
    .eq("id", itemId)
    .select(ITEM_COLS)
    .maybeSingle();
  if (error) throw error;
  return (data as ChecklistItem) ?? undefined;
}

// Remove um item do checklist.
export async function deleteChecklistItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("checklist_items").delete().eq("id", itemId);
  if (error) throw error;
}
