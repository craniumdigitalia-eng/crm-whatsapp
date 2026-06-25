import { db } from "../db";
import { Lead, Message, LeadStatus } from "../types";

export function findLeadByPhone(phone: string): Lead | undefined {
  return db.prepare("SELECT * FROM leads WHERE phone = ?").get(phone) as Lead | undefined;
}

export function getLead(id: number): Lead | undefined {
  return db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as Lead | undefined;
}

export function getOrCreateLead(phone: string, name?: string): Lead {
  const existing = findLeadByPhone(phone);
  if (existing) {
    if (name && !existing.name) {
      db.prepare("UPDATE leads SET name = ?, updated_at = datetime('now') WHERE id = ?").run(
        name,
        existing.id
      );
      existing.name = name;
    }
    return existing;
  }
  const info = db
    .prepare("INSERT INTO leads (phone, name, status) VALUES (?, ?, 'novo')")
    .run(phone, name ?? null);
  return getLead(info.lastInsertRowid as number)!;
}

export function listLeads(): Lead[] {
  return db.prepare("SELECT * FROM leads ORDER BY updated_at DESC").all() as Lead[];
}

export function getMessages(leadId: number): Message[] {
  return db
    .prepare("SELECT * FROM messages WHERE lead_id = ? ORDER BY id ASC")
    .all(leadId) as Message[];
}

export function addMessage(leadId: number, direction: "in" | "out", body: string): void {
  db.prepare("INSERT INTO messages (lead_id, direction, body) VALUES (?, ?, ?)").run(
    leadId,
    direction,
    body
  );
  db.prepare(
    "UPDATE leads SET last_direction = ?, last_message_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(direction, leadId);
}

// Quando o lead responde, zera o contador de follow-up.
export function resetFollowUp(leadId: number): void {
  db.prepare("UPDATE leads SET follow_up_count = 0, updated_at = datetime('now') WHERE id = ?").run(
    leadId
  );
}

export function incrementFollowUp(leadId: number): void {
  db.prepare(
    "UPDATE leads SET follow_up_count = follow_up_count + 1, updated_at = datetime('now') WHERE id = ?"
  ).run(leadId);
}

export function updateLeadFields(
  leadId: number,
  fields: Partial<Pick<Lead, "name" | "status" | "service_interest" | "budget" | "notes">>
): void {
  const allowed = ["name", "status", "service_interest", "budget", "notes"] as const;
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  values.push(leadId);
  db.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function setStatus(leadId: number, status: LeadStatus): void {
  updateLeadFields(leadId, { status });
}
