import { supabase } from "./supabase";
import { Lead, Message, LeadStatus } from "./types";

export async function getOrCreateLead(phone: string, name?: string): Promise<Lead> {
  const { data: existing } = await supabase
    .from("leads")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    if (name && !existing.name) {
      await supabase.from("leads").update({ name }).eq("id", existing.id);
      existing.name = name;
    }
    return existing as Lead;
  }

  const { data: created, error } = await supabase
    .from("leads")
    .insert({ phone, name: name ?? null, status: "novo" })
    .select()
    .single();
  if (error) throw error;
  return created as Lead;
}

export async function getMessages(leadId: string): Promise<Message[]> {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Message[];
}

export async function addMessage(
  leadId: string,
  direction: "in" | "out",
  body: string
): Promise<void> {
  await supabase.from("messages").insert({ lead_id: leadId, direction, body });
  await supabase
    .from("leads")
    .update({ last_direction: direction, last_message_at: new Date().toISOString() })
    .eq("id", leadId);
}

export async function resetFollowUp(leadId: string): Promise<void> {
  await supabase.from("leads").update({ follow_up_count: 0 }).eq("id", leadId);
}

export async function setFollowUpCount(leadId: string, count: number): Promise<void> {
  await supabase.from("leads").update({ follow_up_count: count }).eq("id", leadId);
}

export async function updateLeadFields(
  leadId: string,
  fields: Partial<Pick<Lead, "name" | "status" | "service_interest" | "budget" | "notes">>
): Promise<void> {
  const patch: Record<string, unknown> = {};
  for (const key of ["name", "status", "service_interest", "budget", "notes"] as const) {
    if (fields[key] !== undefined) patch[key] = fields[key];
  }
  if (Object.keys(patch).length === 0) return;
  await supabase.from("leads").update(patch).eq("id", leadId);
}

export async function setStatus(leadId: string, status: LeadStatus): Promise<void> {
  await updateLeadFields(leadId, { status });
}
