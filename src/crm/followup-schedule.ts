import { supabase } from "../db";

// =====================================================================
// Follow-up agendado por lead (migration 008).
// "Lembrar o lead X em 2 dias com esta mensagem" — follow-ups especificos,
// programados manualmente pela equipe. Complementa (nao substitui) o
// follow-up AUTOMATICO generico em src/followup/scheduler.ts.
// =====================================================================

export type FollowUpScheduleStatus = "pendente" | "enviado" | "cancelado" | "erro";

export interface FollowUpSchedule {
  id: string;
  lead_id: string;
  scheduled_at: string; // ISO timestamptz
  message: string;
  status: FollowUpScheduleStatus;
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
}

// Linha com os dados do lead embutidos (join) — usada nas listagens e no cron.
export interface FollowUpScheduleWithLead extends FollowUpSchedule {
  lead: { id: string; name: string | null; phone: string } | null;
}

const COLS = "id,lead_id,scheduled_at,message,status,created_by,created_at,sent_at";
// leads(...) faz o join via FK lead_id -> leads.id (PostgREST embedding).
const COLS_WITH_LEAD = `${COLS},lead:leads(id,name,phone)`;

export interface ScheduleFollowUpInput {
  leadId: string;
  scheduledAt: string; // ISO timestamptz
  message: string;
  createdBy?: string | null;
}

// Programa um novo follow-up para um lead. Retorna a linha criada.
export async function scheduleFollowUp(
  input: ScheduleFollowUpInput
): Promise<FollowUpSchedule> {
  const { data, error } = await supabase
    .from("follow_up_schedule")
    .insert({
      lead_id: input.leadId,
      scheduled_at: input.scheduledAt,
      message: input.message,
      created_by: input.createdBy ?? null,
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as FollowUpSchedule;
}

// Todos os follow-ups de um lead (mais recentes primeiro pela data agendada).
// Usado na visao do lead (bonus).
export async function listForLead(leadId: string): Promise<FollowUpSchedule[]> {
  const { data, error } = await supabase
    .from("follow_up_schedule")
    .select(COLS)
    .eq("lead_id", leadId)
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FollowUpSchedule[];
}

// Proximos follow-ups pendentes de todos os leads (do mais proximo ao mais distante).
export async function listUpcoming(limit = 200): Promise<FollowUpScheduleWithLead[]> {
  const { data, error } = await supabase
    .from("follow_up_schedule")
    .select(COLS_WITH_LEAD)
    .eq("status", "pendente")
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as FollowUpScheduleWithLead[];
}

// Historico: follow-ups ja resolvidos (enviados/cancelados/erro), mais recentes primeiro.
export async function listHistory(limit = 100): Promise<FollowUpScheduleWithLead[]> {
  const { data, error } = await supabase
    .from("follow_up_schedule")
    .select(COLS_WITH_LEAD)
    .neq("status", "pendente")
    .order("scheduled_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as FollowUpScheduleWithLead[];
}

// Cancela um follow-up pendente. Idempotente: so afeta linhas ainda 'pendente'.
// Retorna true se algo foi cancelado, false caso ja estivesse resolvido.
export async function cancelFollowUp(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("follow_up_schedule")
    .update({ status: "cancelado" })
    .eq("id", id)
    .eq("status", "pendente")
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// Follow-ups vencidos a processar: pendentes com scheduled_at <= now.
// Inclui os dados do lead (phone/name) para o envio.
export async function getDueFollowUps(
  now: string,
  limit = 200
): Promise<FollowUpScheduleWithLead[]> {
  const { data, error } = await supabase
    .from("follow_up_schedule")
    .select(COLS_WITH_LEAD)
    .eq("status", "pendente")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as FollowUpScheduleWithLead[];
}

// Marca como enviado (apos o envio via canal). Retorna true se mudou de 'pendente'.
// Claim atomico: a guarda status='pendente' evita envio duplo se dois ciclos de
// cron rodarem em paralelo sobre o mesmo item.
export async function markSent(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("follow_up_schedule")
    .update({ status: "enviado", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pendente")
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// Marca como erro (falha de envio). Nao reagenda — a equipe reprograma manualmente.
export async function markError(id: string): Promise<void> {
  const { error } = await supabase
    .from("follow_up_schedule")
    .update({ status: "erro" })
    .eq("id", id);
  if (error) throw error;
}
