import { supabase } from "../db";
import { Tag } from "../types";

// Colunas explicitas — evita SELECT * e garante paridade com a interface Tag.
const TAG_COLS = "id,name,color,created_at";

// Erro de chave duplicada (nome de etiqueta unico) — o route handler traduz para 409.
export class DuplicateTagError extends Error {
  constructor(message = "etiqueta ja existe") {
    super(message);
    this.name = "DuplicateTagError";
  }
}

// Catalogo completo de etiquetas, ordenado por nome.
export async function listTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("tags")
    .select(TAG_COLS)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Tag[];
}

// Cria uma etiqueta. color default '#7C3AED' (definido no banco se omitido).
export async function createTag(name: string, color?: string): Promise<Tag> {
  const insert: Record<string, unknown> = { name };
  if (color) insert.color = color;
  const { data, error } = await supabase.from("tags").insert(insert).select(TAG_COLS).single();
  // 23505 = unique violation — nome de etiqueta ja usado.
  if (error?.code === "23505") throw new DuplicateTagError();
  if (error) throw error;
  return data as Tag;
}

// Atualiza name e/ou color de uma etiqueta. Retorna a etiqueta atualizada (ou undefined se nao existe).
export async function updateTag(
  id: string,
  fields: Partial<Pick<Tag, "name" | "color">>
): Promise<Tag | undefined> {
  const patch: Record<string, unknown> = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.color !== undefined) patch.color = fields.color;
  if (Object.keys(patch).length === 0) {
    const { data } = await supabase.from("tags").select(TAG_COLS).eq("id", id).maybeSingle();
    return (data as Tag) ?? undefined;
  }
  const { data, error } = await supabase
    .from("tags")
    .update(patch)
    .eq("id", id)
    .select(TAG_COLS)
    .maybeSingle();
  if (error?.code === "23505") throw new DuplicateTagError();
  if (error) throw error;
  return (data as Tag) ?? undefined;
}

// Remove uma etiqueta do catalogo. As linhas em lead_tags caem por ON DELETE CASCADE.
export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) throw error;
}

// Etiquetas aplicadas a um lead, ordenadas por nome.
export async function getLeadTags(leadId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("lead_tags")
    .select(`tags(${TAG_COLS})`)
    .eq("lead_id", leadId);
  if (error) throw error;
  // PostgREST embeda a relacao many-to-one como objeto unico; o supabase-js
  // infere como array no tipo, por isso o cast via unknown.
  const tags = ((data ?? []) as unknown as Array<{ tags: Tag | null }>)
    .map((row) => row.tags)
    .filter((t): t is Tag => t !== null);
  tags.sort((a, b) => a.name.localeCompare(b.name));
  return tags;
}

// Mapa lead_id -> etiquetas, para anexar os chips na listagem do kanban numa unica query.
export async function getTagsByLeadIds(leadIds: string[]): Promise<Record<string, Tag[]>> {
  const map: Record<string, Tag[]> = {};
  if (leadIds.length === 0) return map;
  const { data, error } = await supabase
    .from("lead_tags")
    .select(`lead_id,tags(${TAG_COLS})`)
    .in("lead_id", leadIds);
  if (error) throw error;
  for (const row of (data ?? []) as unknown as Array<{ lead_id: string; tags: Tag | null }>) {
    if (!row.tags) continue;
    (map[row.lead_id] ??= []).push(row.tags);
  }
  for (const id of Object.keys(map)) {
    map[id].sort((a, b) => a.name.localeCompare(b.name));
  }
  return map;
}

// Atribui uma etiqueta a um lead. Idempotente: se ja existe, nao faz nada.
export async function addLeadTag(leadId: string, tagId: string): Promise<void> {
  const { error } = await supabase.from("lead_tags").insert({ lead_id: leadId, tag_id: tagId });
  // 23505 = PK composta (lead_id, tag_id) ja existe — atribuicao repetida, ok.
  if (error?.code === "23505") return;
  if (error) throw error;
}

// Remove uma etiqueta de um lead.
export async function removeLeadTag(leadId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from("lead_tags")
    .delete()
    .eq("lead_id", leadId)
    .eq("tag_id", tagId);
  if (error) throw error;
}
