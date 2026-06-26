import { supabase } from "../db";
import { config } from "../config";

// =====================================================================
// Configuracao do Agente de IA (persona / abordagem / qualificacao).
// Mesmo padrao das integracoes (Meta/Evolution/Email): os valores vivem
// na tabela integrations_config (key/value) e o usuario edita pela aba
// "Agente IA". NAO precisa de migration nova.
//
// Tudo tem um DEFAULT sensato (Cranium Digital — agencia de marketing) para o
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
    "Tom consultivo de especialista: faça perguntas inteligentes, demonstre domínio de marketing/do serviço e conduza o lead com segurança até a melhor solução. Pouco ou nenhum emoji.",
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

// Defaults Cranium Digital — agencia de marketing/tecnologia/IA. O SDR qualifica
// leads que querem contratar SERVICOS DE MARKETING (nao vende plano de saude).
// Editaveis pela aba "Agente IA"; servem de fallback quando a chave esta vazia.
export const AGENT_DEFAULTS: AgentConfig = {
  personaName: "Bia",
  personaRole: "consultora de novos negócios da Cranium Digital",
  tone: "amigavel",
  companyContext:
    "A Cranium Digital é uma agência de marketing, tecnologia e IA. Ajudamos empresas a venderem mais com tráfego pago (Meta e Google Ads), gestão de redes sociais, criação de sites e landing pages, branding e identidade visual, além de automação e inteligência artificial. Nosso diferencial é unir marketing, tecnologia e dados — estratégia criativa com performance de verdade.",
  opening:
    "Aborde o lead que acabou de chegar de forma calorosa e pessoal: cumprimente pelo nome (se tiver), apresente-se como a Bia, da Cranium Digital, e diga que vai ajudar a entender como a agência pode impulsionar o negócio dele. Faça UMA pergunta de abertura para entender o desafio ou o serviço que ele procura (ex.: tráfego pago, redes sociais, site, branding ou automação/IA). Não despeje informação nem várias perguntas de uma vez.",
  qualificationGoals:
    "• Serviço de interesse: tráfego pago (Meta/Google Ads), gestão de redes sociais, site/landing page, branding ou automação/IA.\n• Segmento e tipo de negócio do lead (o que vende, B2B ou B2C).\n• Objetivo principal: mais vendas, geração de leads, reconhecimento de marca, etc.\n• Situação atual: já investe em marketing/anúncios? Tem agência ou faz internamente? O que funciona ou não hoje.\n• Faixa de investimento mensal (em mídia e/ou serviço).\n• Urgência / quando pretende começar.",
  escalationRules:
    "Transfira para um consultor humano quando: o lead pedir para falar com uma pessoa ou agendar uma reunião/diagnóstico; pedir proposta, orçamento ou valores; demonstrar intenção clara de contratar; ou já tiver dado as informações principais de qualificação (aí o consultor apresenta a proposta). Transfira também se o lead estiver insatisfeito, ou se o pedido fugir do escopo de serviços da agência. Ao transferir, avise o lead de forma calorosa que um consultor da equipe vai dar continuidade com a proposta.",
  guardrails:
    "NUNCA invente preços, prazos ou resultados garantidos — se não souber, diga que um consultor vai detalhar de acordo com o projeto. NÃO feche valores nem contrato pelo WhatsApp (isso é com o consultor). NÃO prometa números específicos de retorno (ex.: 'X vendas garantidas'). NÃO fale mal de concorrentes nem de outras agências. NÃO peça dados sensíveis desnecessários no primeiro atendimento; respeite a LGPD e seja transparente que é um atendimento inicial. Mantenha mensagens curtas, naturais e em português do Brasil.",
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
