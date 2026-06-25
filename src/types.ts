// Estagios do funil (pipeline) do CRM.
export type LeadStatus =
  | "novo" // acabou de chegar, agente vai atender
  | "em_atendimento" // agente conversando
  | "qualificado" // agente coletou interesse/orcamento
  | "proposta" // proposta enviada
  | "fechado" // virou cliente
  | "perdido" // nao avancou
  | "humano"; // um humano assumiu (agente pausado)

export const STATUS_LABELS: Record<LeadStatus, string> = {
  novo: "Novo",
  em_atendimento: "Em atendimento",
  qualificado: "Qualificado",
  proposta: "Proposta",
  fechado: "Fechado",
  perdido: "Perdido",
  humano: "Atend. humano",
};

// Estagios em que o agente de IA deve responder automaticamente.
export const AUTO_STATUSES: LeadStatus[] = ["novo", "em_atendimento", "qualificado"];

export interface Lead {
  id: string; // UUID (TEXT no SQLite, uuid no Supabase/Postgres)
  phone: string;
  name: string | null;
  status: LeadStatus;
  service_interest: string | null;
  budget: string | null;
  notes: string | null;
  follow_up_count: number;
  last_direction: "in" | "out" | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string; // UUID
  lead_id: string; // UUID — FK para leads.id
  direction: "in" | "out";
  body: string;
  external_id: string | null; // ID externo (Evolution/Make) para deduplicacao de reentregas
  created_at: string;
}
