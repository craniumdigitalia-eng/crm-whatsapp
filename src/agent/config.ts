import { supabase } from "../db";
import { config } from "../config";

// =====================================================================
// Configuracao do Agente de IA (persona / abordagem / qualificacao).
// Mesmo padrao das integracoes (Meta/Evolution/Email): os valores vivem
// na tabela integrations_config (key/value) e o usuario edita pela aba
// "Agente IA". NAO precisa de migration nova.
//
// Tudo tem um DEFAULT sensato (Cranium Digital — planos de saude) para o
// agente funcionar de cara, mesmo sem nada salvo. O system prompt e montado
// dinamicamente a partir daqui (ver ./prompt.ts).
// =====================================================================

export type AgentConfigKey =
  | "agent_persona_name"
  | "agent_persona_role"
  | "agent_tone"
  | "agent_company_context"
  | "agent_opening"
  | "agent_qualification_goals"
  | "agent_escalation_rules"
  | "agent_guardrails";

const KEYS: AgentConfigKey[] = [
  "agent_persona_name",
  "agent_persona_role",
  "agent_tone",
  "agent_company_context",
  "agent_opening",
  "agent_qualification_goals",
  "agent_escalation_rules",
  "agent_guardrails",
];

// Tom de voz do agente. O valor salvo e uma destas chaves; o texto injetado
// no prompt vem de TONE_GUIDANCE.
export type AgentTone = "amigavel" | "profissional" | "consultivo";

export const TONE_OPTIONS: { value: AgentTone; label: string }[] = [
  { value: "amigavel", label: "Amigável e informal" },
  { value: "profissional", label: "Profissional" },
  { value: "consultivo", label: "Consultivo" },
];

const TONE_GUIDANCE: Record<AgentTone, string> = {
  amigavel:
    "Tom amigável e informal, como uma conversa de WhatsApp entre pessoas próximas. Use linguagem leve e acolhedora. Emojis com moderação (no máximo 1 por mensagem, quando fizer sentido).",
  profissional:
    "Tom profissional e cordial, claro e objetivo. Mantenha a simpatia, mas sem gírias. Use emojis com muita parcimônia ou evite.",
  consultivo:
    "Tom consultivo de especialista: faça perguntas inteligentes, demonstre domínio de planos de saúde e conduza o lead com segurança até a melhor solução. Pouco ou nenhum emoji.",
};

function isTone(v: string | undefined): v is AgentTone {
  return v === "amigavel" || v === "profissional" || v === "consultivo";
}

export interface AgentConfig {
  personaName: string; // nome que a IA assina / assume
  personaRole: string; // como a IA se apresenta
  tone: AgentTone;
  companyContext: string; // sobre a empresa e o que oferece
  opening: string; // 1a mensagem / como abordar o lead novo
  qualificationGoals: string; // o que descobrir
  escalationRules: string; // quando transferir para humano
  guardrails: string; // o que a IA NUNCA deve fazer
}

// Defaults Cranium Digital — corretora/parceira de planos de saude.
// Editaveis pela aba "Agente IA"; servem de fallback quando a chave esta vazia.
export const AGENT_DEFAULTS: AgentConfig = {
  personaName: "Pâmella",
  personaRole: "consultora de planos de saúde da Cranium Digital",
  tone: "amigavel",
  companyContext:
    "A Cranium Digital ajuda pessoas e empresas a encontrarem o plano de saúde ideal, com atendimento humano e sem custo de consultoria. Trabalhamos com as principais operadoras do mercado (Amil, Bradesco Saúde, SulAmérica, Unimed, Hapvida, Porto Seguro, entre outras) e comparamos coberturas, redes credenciadas e preços para indicar a melhor opção para cada perfil — planos individuais, familiares e empresariais (PME).",
  opening:
    "Aborde o lead que acabou de chegar de forma calorosa e pessoal: cumprimente pelo nome (se tiver), apresente-se rapidamente e diga que vai ajudar a encontrar o melhor plano de saúde. Faça UMA pergunta de abertura para entender o que ele procura (ex.: se o plano é para ele, para a família ou para a empresa). Não despeje informação nem várias perguntas de uma vez.",
  qualificationGoals:
    "• Tipo de plano: individual, familiar ou empresarial (PME).\n• Número de vidas (quantas pessoas vão usar o plano).\n• Faixa etária dos beneficiários (e idades das crianças/idosos, se houver).\n• Cidade/UF (a rede credenciada e o preço variam por região).\n• Se já tem plano hoje e qual (operadora) — e o motivo de querer trocar.\n• Preferências importantes: hospitais/médicos de preferência, com ou sem coparticipação, acomodação (enfermaria/apartamento).\n• Noção de orçamento mensal e urgência (quando pretende contratar).",
  escalationRules:
    "Transfira para um especialista humano quando: o lead pedir para falar com uma pessoa; pedir cotação/proposta formal ou valores fechados; demonstrar intenção clara de contratar; já tiver dado as informações principais de qualificação; o caso for complexo (portabilidade de carências, doença preexistente, plano empresarial com muitas vidas) ou exigir negociação. Ao transferir, avise o lead de forma calorosa que um especialista da equipe vai dar continuidade com as opções e os valores.",
  guardrails:
    "NUNCA invente preços, coberturas, carências, reembolsos ou condições de um plano — se não souber, diga que um especialista vai confirmar os valores e detalhes. NUNCA prometa aprovação, isenção de carência ou cobertura de algo específico. NÃO dê orientação médica nem opine sobre tratamentos/doenças. NÃO peça dados sensíveis desnecessários (CPF, RG, cartão) no primeiro atendimento. Respeite a LGPD e seja transparente que é um atendimento inicial. Responda sempre em português do Brasil.",
};

// Le todas as chaves do agente de uma vez. Tolerante: se a tabela ainda nao
// existe (ou da erro), volta tudo nos defaults sem quebrar o atendimento.
export async function getAgentConfig(): Promise<AgentConfig> {
  const stored = new Map<string, string>();
  try {
    const { data, error } = await supabase
      .from("integrations_config")
      .select("key, value")
      .in("key", KEYS);
    if (error) {
      console.warn(`[agent/config] getAgentConfig: ${error.message}`);
    } else {
      for (const row of (data ?? []) as { key: string; value: string | null }[]) {
        if (row.value && row.value.trim()) stored.set(row.key, row.value.trim());
      }
    }
  } catch (e) {
    console.warn(`[agent/config] getAgentConfig:`, e);
  }

  const tone = stored.get("agent_tone");
  return {
    personaName: stored.get("agent_persona_name") ?? AGENT_DEFAULTS.personaName,
    personaRole: stored.get("agent_persona_role") ?? AGENT_DEFAULTS.personaRole,
    tone: isTone(tone) ? tone : AGENT_DEFAULTS.tone,
    companyContext: stored.get("agent_company_context") ?? AGENT_DEFAULTS.companyContext,
    opening: stored.get("agent_opening") ?? AGENT_DEFAULTS.opening,
    qualificationGoals:
      stored.get("agent_qualification_goals") ?? AGENT_DEFAULTS.qualificationGoals,
    escalationRules: stored.get("agent_escalation_rules") ?? AGENT_DEFAULTS.escalationRules,
    guardrails: stored.get("agent_guardrails") ?? AGENT_DEFAULTS.guardrails,
  };
}

// Texto do tom de voz injetado no system prompt.
export function toneGuidance(tone: AgentTone): string {
  return TONE_GUIDANCE[tone] ?? TONE_GUIDANCE[AGENT_DEFAULTS.tone];
}

// Grava (upsert) os campos do agente. Diferente das integracoes, aqui PERMITIMOS
// salvar string vazia: gravar "" equivale a "voltar ao default" (getAgentConfig
// trata vazio como ausente e cai no AGENT_DEFAULTS). Chaves nao enviadas (undefined)
// sao preservadas como estao.
export async function setAgentConfig(
  values: Partial<Record<AgentConfigKey, string>>
): Promise<void> {
  const rows = (Object.entries(values) as [AgentConfigKey, string | undefined][])
    .filter(([key, v]) => KEYS.includes(key) && typeof v === "string")
    .map(([key, value]) => ({ key, value: (value as string).trim() }));
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("integrations_config")
    .upsert(rows, { onConflict: "key" });
  if (error) throw error;
}

// Conveniencia para a UI: o nome da empresa (do env) usado nos textos.
export const companyName = config.companyName;
