import { supabase } from "../db";

// =====================================================================
// Materiais/provas que o agente envia ao lead (prints de campanha,
// resultados, "como o lead chega"). Imagens no bucket público
// 'agent-assets'; metadata na tabela agent_assets (migration 014).
// Tolerante: sem tabela/bucket → []/no-op.
// =====================================================================

export type AssetCategory = "campanha" | "resultado" | "como_chega" | "depoimento" | "outro";

export const ASSET_CATEGORIES: { value: AssetCategory; label: string; hint: string }[] = [
  { value: "campanha", label: "Print de campanha", hint: "anúncio/campanha rodando" },
  { value: "resultado", label: "Resultado de cliente", hint: "quantos leads chegaram, crescimento, números" },
  { value: "como_chega", label: "Como o lead chega", hint: "exemplo de como o lead cai pro corretor (conversa/fluxo)" },
  { value: "depoimento", label: "Depoimento", hint: "print/mensagem de cliente satisfeito" },
  { value: "outro", label: "Outro", hint: "material diverso" },
];

const BUCKET = "agent-assets";

export interface AgentAsset {
  id: string;
  category: string;
  label: string;
  caption: string | null;
  url: string;
  path: string;
  active: boolean;
  sort: number;
  created_at: string;
}

const COLS = "id,category,label,caption,url,path,active,sort,created_at";

export async function listAssets(): Promise<AgentAsset[]> {
  try {
    const { data, error } = await supabase
      .from("agent_assets")
      .select(COLS)
      .order("category", { ascending: true })
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) { console.warn("[assets] listAssets:", error.message); return []; }
    return (data ?? []) as AgentAsset[];
  } catch { return []; }
}

export async function listActiveByCategory(category: string): Promise<AgentAsset[]> {
  try {
    const { data } = await supabase
      .from("agent_assets")
      .select(COLS)
      .eq("category", category)
      .eq("active", true)
      .order("sort", { ascending: true })
      .limit(3);
    return (data ?? []) as AgentAsset[];
  } catch { return []; }
}

// Cria um material: sobe a imagem no Storage e grava a metadata.
export async function createAsset(input: {
  category: AssetCategory;
  label: string;
  caption?: string;
  bytes: Uint8Array;
  contentType: string;
  ext: string;
}): Promise<AgentAsset> {
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const path = `${input.category}/${rand}.${input.ext.replace(/[^a-z0-9]/gi, "") || "png"}`;
  const up = await supabase.storage.from(BUCKET).upload(path, input.bytes, {
    contentType: input.contentType,
    upsert: false,
  });
  if (up.error) throw up.error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { data, error } = await supabase
    .from("agent_assets")
    .insert({
      category: input.category,
      label: input.label.trim(),
      caption: input.caption?.trim() || null,
      url: pub.publicUrl,
      path,
      active: true,
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as AgentAsset;
}

export async function deleteAsset(id: string): Promise<void> {
  const { data } = await supabase.from("agent_assets").select("path").eq("id", id).maybeSingle();
  const path = (data as { path?: string } | null)?.path;
  if (path) await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
  const { error } = await supabase.from("agent_assets").delete().eq("id", id);
  if (error) throw error;
}

export async function updateAsset(id: string, patch: Partial<Pick<AgentAsset, "label" | "caption" | "active" | "category" | "sort">>): Promise<void> {
  const row: Record<string, unknown> = {};
  for (const k of ["label", "caption", "active", "category", "sort"] as const) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from("agent_assets").update(row).eq("id", id);
  if (error) throw error;
}

// Resumo dos materiais disponíveis, para injetar no system prompt (a IA precisa
// saber o que tem para poder usar a ferramenta enviar_material com a categoria certa).
export async function assetsSummaryForPrompt(): Promise<string> {
  const all = (await listAssets()).filter((a) => a.active);
  if (all.length === 0) return "";
  const byCat = new Map<string, number>();
  for (const a of all) byCat.set(a.category, (byCat.get(a.category) ?? 0) + 1);
  const linhas = ASSET_CATEGORIES.filter((c) => byCat.get(c.value))
    .map((c) => `  • ${c.value} — ${c.label} (${c.hint}): ${byCat.get(c.value)} disponível(is)`);
  return `\n\nMATERIAIS QUE VOCÊ PODE ENVIAR (imagens/provas)
Você tem materiais visuais para mandar ao lead pela ferramenta "enviar_material" (passe a categoria):
${linhas.join("\n")}
Envie no MOMENTO CERTO, não de cara: quando o lead pedir prova/resultado, estiver em dúvida ou cético, ou quando você estiver mostrando valor antes de propor a call. Comente a imagem em 1 frase curta antes ou depois. Não mande a mesma categoria duas vezes.`;
}
