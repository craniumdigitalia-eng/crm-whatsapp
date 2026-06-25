// Tipos compartilhados das funcoes serverless (Vercel + Supabase).
export type LeadStatus =
  | "novo"
  | "em_atendimento"
  | "qualificado"
  | "proposta"
  | "fechado"
  | "perdido"
  | "humano";

// Estagios em que o agente de IA responde automaticamente.
export const AUTO_STATUSES: LeadStatus[] = ["novo", "em_atendimento", "qualificado"];

export interface Lead {
  id: string; // uuid no Supabase
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
  id: string;
  lead_id: string;
  direction: "in" | "out";
  body: string;
  created_at: string;
}
