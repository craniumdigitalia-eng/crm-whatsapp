import { supabase } from "../db";
import { Lead, Message, LeadStatus, LeadAttribution } from "../types";

// Colunas explicitas — evita SELECT * e garante paridade com a interface Lead.
const LEAD_COLS =
  "id,phone,name,email,status,service_interest,budget,notes,follow_up_count,last_direction,last_message_at,created_at,updated_at";
const MSG_COLS = "id,lead_id,direction,body,external_id,created_at";
// Colunas da migration 003 — selecionadas a parte (podem nao existir antes da migration).
const ATTRIBUTION_COLS = "source,form_id,leadgen_id,ad_id,campaign_id,form_data";

export async function findLeadByPhone(phone: string): Promise<Lead | undefined> {
  const { data } = await supabase.from("leads").select(LEAD_COLS).eq("phone", phone).maybeSingle();
  return (data as Lead) ?? undefined;
}

export async function getLead(id: string): Promise<Lead | undefined> {
  const { data } = await supabase.from("leads").select(LEAD_COLS).eq("id", id).maybeSingle();
  return (data as Lead) ?? undefined;
}

export async function getOrCreateLead(phone: string, name?: string): Promise<Lead> {
  // 1) tenta achar pelo telefone
  const { data: existing } = await supabase
    .from("leads")
    .select(LEAD_COLS)
    .eq("phone", phone)
    .maybeSingle();
  if (existing) {
    if (name && !existing.name) {
      const { error: nameErr } = await supabase.from("leads").update({ name }).eq("id", existing.id);
      if (nameErr) {
        // Nao-critico: lead retornado mesmo sem o update; loga para visibilidade.
        console.error(`[leads] getOrCreateLead: falha ao atualizar name do lead ${existing.id}:`, nameErr.message);
      } else {
        existing.name = name;
      }
    }
    return existing as Lead;
  }

  // 2) cria (id via gen_random_uuid() default — nao passe id)
  const { data: created, error } = await supabase
    .from("leads")
    .insert({ phone, name: name ?? null, status: "novo" })
    .select(LEAD_COLS)
    .single();

  // 3) race: outro processo criou o mesmo telefone entre o select e o insert (23505 = unique violation)
  if (error?.code === "23505") {
    const { data } = await supabase.from("leads").select(LEAD_COLS).eq("phone", phone).single();
    return data as Lead;
  }
  if (error) throw error;
  return created as Lead;
}

export async function listLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Lead[];
}

export async function getMessages(leadId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MSG_COLS)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

// Insere uma mensagem e atualiza o lead. Retorna true se inserida, false se duplicata (external_id ja existe).
// Mensagens sem externalId (respostas 'out' do agente) inserem normalmente — o indice e parcial (WHERE external_id IS NOT NULL).
export async function addMessage(
  leadId: string,
  direction: "in" | "out",
  body: string,
  externalId?: string
): Promise<boolean> {
  const { error } = await supabase.from("messages").insert({
    lead_id: leadId,
    direction,
    body,
    external_id: externalId ?? null,
  });

  // 23505 = duplicate key — external_id ja existe (idempotencia de mensagens recebidas)
  if (error?.code === "23505") return false;
  if (error) throw error;

  const { error: updErr } = await supabase
    .from("leads")
    .update({ last_direction: direction, last_message_at: new Date().toISOString() })
    .eq("id", leadId);
  if (updErr) {
    // Insert confirmado; UPDATE secundario falhou (erro raro). Loga para visibilidade sem reverter.
    console.error(`[leads] addMessage: falha ao atualizar lead ${leadId} apos insert:`, updErr.message);
  }

  return true;
}

// Quando o lead responde, zera o contador de follow-up.
export async function resetFollowUp(leadId: string): Promise<void> {
  const { error } = await supabase.from("leads").update({ follow_up_count: 0 }).eq("id", leadId);
  if (error) throw error;
}

// Candidatos ao proximo ciclo de follow-up:
// status em statuses, ultimo envio foi 'out', last_message_at existente e abaixo do limite.
// limit: maximo de linhas retornadas por ciclo — evita lotes grandes em funcoes serverless.
export async function listFollowUpCandidates(
  statuses: string[],
  maxCount: number,
  limit = 50
): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLS)
    .in("status", statuses)
    .eq("last_direction", "out")
    .not("last_message_at", "is", null)
    .lt("follow_up_count", maxCount)
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Lead[];
}

// Claim atomico de um slot de follow-up (padrao "claim-then-send").
// Incrementa follow_up_count SOMENTE se o lead ainda esta elegivel no momento do claim:
//   - last_direction = 'out'          (lead nao respondeu desde o ultimo envio)
//   - last_message_at expirou         (intervalo de followupIntervalMs ja passou)
//   - follow_up_count == expectedCount (optimistic lock — evita duplo-claim em corrida de cron)
//   - follow_up_count < maxCount      (limite de retomadas ainda nao atingido)
// Ao vencer, reescreve last_message_at para agora — reinicia o relogio do intervalo,
// fechando a janela de claims sequenciais rapidos (fix #12).
// Retorna true se o claim foi bem-sucedido, false caso contrario.
export async function claimFollowUp(
  leadId: string,
  expectedCount: number,
  maxCount: number,
  intervalMs: number
): Promise<boolean> {
  const intervalAgo = new Date(Date.now() - intervalMs).toISOString();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("leads")
    .update({ follow_up_count: expectedCount + 1, last_message_at: now })
    .eq("id", leadId)
    .eq("last_direction", "out")
    .not("last_message_at", "is", null)
    .lt("last_message_at", intervalAgo)
    .eq("follow_up_count", expectedCount)
    .lt("follow_up_count", maxCount)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function updateLeadFields(
  leadId: string,
  fields: Partial<Pick<Lead, "name" | "email" | "status" | "service_interest" | "budget" | "notes">>
): Promise<void> {
  const allowed = ["name", "email", "status", "service_interest", "budget", "notes"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) patch[key] = fields[key];
  }
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) throw error;
}

export async function setStatus(leadId: string, status: LeadStatus): Promise<void> {
  await updateLeadFields(leadId, { status });
}

// =====================================================================
// Atribuicao / origem (Story 5.14 — Meta Lead Ads).
// As colunas vivem na migration 003; estas funcoes sao tolerantes a
// migration ausente (retornam null / nao-op) para nao quebrar o CRM.
// =====================================================================

// Le os campos de atribuicao do lead. Se a migration 003 nao foi aplicada
// (coluna inexistente -> erro 42703), retorna null silenciosamente.
export async function getLeadAttribution(id: string): Promise<LeadAttribution | null> {
  const { data, error } = await supabase
    .from("leads")
    .select(ATTRIBUTION_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn(`[leads] getLeadAttribution(${id}): ${error.message}`);
    return null;
  }
  return (data as LeadAttribution) ?? null;
}

// Acha um lead pelo leadgen_id do Meta (dedupe idempotente da importacao).
export async function findLeadByLeadgenId(leadgenId: string): Promise<Lead | undefined> {
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLS)
    .eq("leadgen_id", leadgenId)
    .maybeSingle();
  if (error) {
    console.warn(`[leads] findLeadByLeadgenId(${leadgenId}): ${error.message}`);
    return undefined;
  }
  return (data as Lead) ?? undefined;
}

// Grava os campos de atribuicao em um lead existente.
export async function setLeadAttribution(
  leadId: string,
  attr: Partial<LeadAttribution>
): Promise<void> {
  const allowed = ["source", "form_id", "leadgen_id", "ad_id", "campaign_id", "form_data"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (attr[key] !== undefined) patch[key] = attr[key];
  }
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) throw error;
}
