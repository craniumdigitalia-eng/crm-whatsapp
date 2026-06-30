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
  email: string | null;
  status: LeadStatus;
  service_interest: string | null;
  budget: string | null;
  notes: string | null;
  photo_url?: string | null; // URL da foto de perfil do WhatsApp (migration 010)
  follow_up_count: number;
  last_direction: "in" | "out" | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

// Atribuicao / origem do lead (Story 5.14 — Meta Lead Ads).
// Selecionada separadamente de LEAD_COLS (colunas da migration 003);
// os campos sao opcionais para nao quebrar leads pre-migration.
export interface LeadAttribution {
  source: string | null; // ex: 'meta_lead_ads'
  form_id: string | null;
  leadgen_id: string | null;
  ad_id: string | null;
  campaign_id: string | null;
  // Respostas do formulario instantaneo: { "Qual seu interesse?": "Plano PME", ... }
  form_data: Record<string, string> | null;
}

export interface Message {
  id: string; // UUID
  lead_id: string; // UUID — FK para leads.id
  direction: "in" | "out";
  body: string;
  external_id: string | null; // ID externo (Evolution/Make) para deduplicacao de reentregas
  created_at: string;
}

// Etiqueta (Story 5.12) — catalogo de tags aplicaveis aos leads.
export interface Tag {
  id: string; // UUID
  name: string; // unico
  color: string; // hex CSS, default '#7C3AED'
  created_at: string;
}

// Item de checklist de um lead (Story 5.13).
export interface ChecklistItem {
  id: string; // UUID
  lead_id: string; // UUID — FK para leads.id
  text: string;
  done: boolean;
  position: number; // ordem dentro do lead
  created_at: string;
  updated_at: string;
}
