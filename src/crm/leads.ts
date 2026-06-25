import { randomUUID } from "crypto";
import { db } from "../db";
import { Lead, Message, LeadStatus } from "../types";

export function findLeadByPhone(phone: string): Lead | undefined {
  return db.prepare("SELECT * FROM leads WHERE phone = ?").get(phone) as Lead | undefined;
}

export function getLead(id: string): Lead | undefined {
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
  const id = randomUUID();
  db.prepare("INSERT INTO leads (id, phone, name, status) VALUES (?, ?, ?, 'novo')").run(
    id,
    phone,
    name ?? null
  );
  return getLead(id)!;
}

export function listLeads(): Lead[] {
  return db.prepare("SELECT * FROM leads ORDER BY updated_at DESC").all() as Lead[];
}

export function getMessages(leadId: string): Message[] {
  return db
    .prepare("SELECT * FROM messages WHERE lead_id = ? ORDER BY id ASC")
    .all(leadId) as Message[];
}

// Insere uma mensagem e atualiza o lead. Retorna true se inserida, false se duplicata (external_id ja existe).
// Mensagens sem externalId (ex.: respostas 'out' do agente) inserem normalmente — indice e parcial.
export function addMessage(
  leadId: string,
  direction: "in" | "out",
  body: string,
  externalId?: string
): boolean {
  const msgId = randomUUID();
  const result = db
    .prepare(
      "INSERT OR IGNORE INTO messages (id, lead_id, direction, body, external_id) VALUES (?, ?, ?, ?, ?)"
    )
    .run(msgId, leadId, direction, body, externalId ?? null);

  // changes == 0 significa conflito no indice unico — mensagem ja existia.
  if (result.changes === 0) return false;

  db.prepare(
    "UPDATE leads SET last_direction = ?, last_message_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(direction, leadId);

  return true;
}

// Quando o lead responde, zera o contador de follow-up.
export function resetFollowUp(leadId: string): void {
  db.prepare("UPDATE leads SET follow_up_count = 0, updated_at = datetime('now') WHERE id = ?").run(
    leadId
  );
}

// Claim atomico de um slot de follow-up (padrao "claim-then-send").
// Incrementa follow_up_count SOMENTE se o lead ainda esta elegivel no momento do claim:
//   - last_direction = 'out'          (lead nao respondeu desde o ultimo envio)
//   - last_message_at expirou         (intervalo de followupIntervalMs ja passou)
//   - follow_up_count == expectedCount (optimistic lock — evita duplo-claim em corrida de cron)
//   - follow_up_count < maxCount      (limite de retomadas ainda nao atingido)
// Ao vencer, reescreve last_message_at para agora — reinicia o relógio do intervalo,
// fechando a janela de claims sequenciais rapidos (ex.: 0->1 e 1->2 no mesmo ciclo).
// O addMessage('out') posterior reescreve last_message_at com timestamp marginalmente
// posterior, sem efeito colateral.
// Retorna true se o claim foi bem-sucedido (changes > 0), false caso contrario.
// Semantica portavel: no Postgres equivale a UPDATE ... WHERE ... RETURNING id.
export function claimFollowUp(
  leadId: string,
  expectedCount: number,
  maxCount: number,
  intervalMs: number
): boolean {
  const modifier = `-${Math.floor(intervalMs / 1000)} seconds`;
  const result = db
    .prepare(
      `UPDATE leads
          SET follow_up_count = follow_up_count + 1,
              last_message_at = datetime('now'),
              updated_at      = datetime('now')
        WHERE id              = ?
          AND last_direction  = 'out'
          AND last_message_at IS NOT NULL
          AND last_message_at < datetime('now', ?)
          AND follow_up_count = ?
          AND follow_up_count < ?`
    )
    .run(leadId, modifier, expectedCount, maxCount);
  return result.changes > 0;
}

export function updateLeadFields(
  leadId: string,
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

export function setStatus(leadId: string, status: LeadStatus): void {
  updateLeadFields(leadId, { status });
}
