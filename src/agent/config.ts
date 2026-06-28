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
  | "agent_guardrails"
  | "agent_objections"
  | "agent_scheduling"
  | "agent_faq";

const KEYS: AgentConfigKey[] = [
  "agent_persona_name",
  "agent_persona_role",
  "agent_tone",
  "agent_company_context",
  "agent_opening",
  "agent_qualification_goals",
  "agent_escalation_rules",
  "agent_guardrails",
  "agent_objections",
  "agent_scheduling",
  "agent_faq",
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
  objections: string; // playbook de quebra de objecoes
  scheduling: string; // como conduzir o agendamento da reuniao
  faq: string; // base de conhecimento / FAQ
}

// Defaults Cranium Digital — agencia de marketing/tecnologia/IA ESPECIALIZADA em
// CORRETORES DE PLANO DE SAUDE. A Bia fala COM o corretor, vendendo o marketing
// que gera leads (NAO vende plano de saude). Editaveis pela aba "Agente IA";
// servem de fallback quando a chave esta vazia.
export const AGENT_DEFAULTS: AgentConfig = {
  personaName: "Bia",
  personaRole: "consultora de novos negócios da Cranium Digital",
  tone: "amigavel",
  companyContext:
    "A Cranium Digital é uma agência de marketing, tecnologia e IA especializada em CORRETORES DE PLANO DE SAÚDE. Ajudamos corretores a vender mais planos gerando um fluxo previsível de leads qualificados (pessoas realmente interessadas em contratar um plano) com tráfego pago segmentado, funis e automação com IA. Tiramos o corretor da dependência de indicação e de lista fria que não converte, trazendo previsibilidade de novos clientes todo mês.",
  opening:
    "Aborde o corretor de forma calorosa e direta, falando a dor dele. Cumprimente pelo nome (se tiver), apresente-se como a Bia, da Cranium Digital, e diga em uma frase que ajuda corretores de plano de saúde a terem um fluxo previsível de clientes. Faça UMA pergunta de abertura para entender como ele consegue clientes hoje (ex.: 'Hoje você fecha mais por indicação, lista ou já roda tráfego?'). Não despeje informação nem várias perguntas de uma vez.",
  qualificationGoals:
    "• Como capta clientes hoje: indicação, lista/mailing, tráfego pago, outros — e qual a principal fonte.\n• Quantos planos costuma vender por mês e qual a meta (quanto gostaria de vender).\n• Já investiu em tráfego/anúncios? Como foi (deu certo, não converteu, achou caro)?\n• Trabalha sozinho ou tem equipe/SDR para atender os leads.\n• Ticket médio / operadoras com que trabalha (Amil, Bradesco, SulAmérica, Unimed, Hapvida, etc.) e foco (PF, família ou PME).\n• Praça/região de atuação.\n• Urgência: quando quer começar a receber leads.\n• IDENTIFIQUE A DOR principal: depender de indicação, leads ruins, lista fria que não converte, falta de previsibilidade, ou tráfego que já tentou e não funcionou.",
  escalationRules:
    "Transfira para um consultor humano quando: o corretor pedir para falar com uma pessoa, agendar uma call/diagnóstico, pedir proposta ou valores, demonstrar intenção clara de contratar, ou já tiver dado as informações principais de qualificação (aí o consultor apresenta a estratégia e a proposta). Transfira também se ele estiver insatisfeito, ou se o pedido fugir do escopo da agência. Ao transferir, avise de forma calorosa que um consultor da Cranium vai dar continuidade.",
  guardrails:
    "NUNCA invente preços, prazos ou resultados garantidos — se não souber, diga que o consultor detalha conforme o projeto. NÃO feche valores nem contrato pelo WhatsApp (isso é com o consultor). NÃO prometa números específicos (ex.: 'X vendas garantidas'). Você vende MARKETING para o corretor — NÃO dê consultoria sobre planos de saúde em si (cobertura, carência, qual plano contratar): isso é o trabalho dele, não o nosso. NÃO fale mal de concorrentes nem de outras agências. Respeite a LGPD e não peça dados sensíveis no primeiro contato. Mantenha mensagens curtas, naturais e em português do Brasil.",
  objections:
    "Ao receber objeções, nunca discuta — ACOLHA, REENQUADRE, FAÇA UMA PERGUNTA e RECONDUZA para a reunião. Playbook do corretor: (1) 'Quanto custa?' → não crave preço no chat; o investimento depende da praça e da meta de vendas, e a reunião serve pra montar a estratégia sob medida; ofereça mostrar como geraríamos leads pra ele. (2) 'Tá caro / sem verba' → reenquadre para o custo de depender de indicação e a previsibilidade de fechar mais planos por mês; pergunte quanto vale pra ele um cliente novo. (3) 'Já tentei tráfego e não deu certo' → acolha, pergunte como foi (quem rodou, que leads chegaram) e diferencie: tráfego segmentado para quem quer plano + funil + atendimento rápido; ofereça mostrar a diferença na call. (4) 'Vivo de indicação' → valide que indicação é ótima, mas imprevisível; proponha somar uma fonte previsível de leads sem depender de terceiros. (5) 'Já comprei lista e não deu em nada' → concorde que lista fria não converte; explique que geramos leads QUENTES, que pediram informação na hora; ofereça ver como funciona. (6) 'Vou pensar / me manda material' → descubra a real hesitação ('o que te deixaria mais seguro pra decidir?') e proponha uma call curta. (7) 'Sem tempo' → 30 min com um plano pronto; ofereça 2 horários. Sempre termine reconduzindo para agendar a reunião.",
  scheduling:
    "A meta de toda conversa qualificada é AGENDAR uma reunião online (Google Meet, ~30 min) onde um consultor apresenta a estratégia e a proposta. Quando o corretor estiver minimamente qualificado e interessado, proponha a reunião com naturalidade e ofereça SEMPRE 2 opções de horário em horário comercial (ex.: 'amanhã 10h ou quinta 15h?') — converte mais que 'quando você pode?'. SÓ depois que ele CONFIRMAR um dia e horário específicos, use a ferramenta agendar_reuniao com a data/hora exata (horário de Brasília) para criar o evento e enviar o convite — e só então confirme ('Marquei pra {dia} às {hora}, te enviei o convite! ✅'). Nunca invente data/hora nem confirme antes de criar o evento. Se ele não tiver e-mail cadastrado, agende mesmo assim e avise que confirmará pelo WhatsApp. Não marque com lead claramente desqualificado.",
  faq:
    "Use este conhecimento para responder com segurança e NUNCA invente além disto. A Cranium é uma agência de marketing especializada em CORRETORES DE PLANO DE SAÚDE: geramos um fluxo previsível de leads qualificados (interessados em contratar plano) com tráfego pago segmentado, funis e automação/IA, resolvendo a dependência de indicação, os leads ruins e a lista fria que não converte. A proposta e os valores são apresentados pelo consultor NA REUNIÃO (não no chat). [O usuário deve preencher aqui: faixas de investimento de referência, prazos médios, cases/resultados de corretores, formas de pagamento.] Se perguntarem algo fora deste conhecimento, seja honesto e leve para a reunião.",
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
    objections: stored.get("agent_objections") ?? AGENT_DEFAULTS.objections,
    scheduling: stored.get("agent_scheduling") ?? AGENT_DEFAULTS.scheduling,
    faq: stored.get("agent_faq") ?? AGENT_DEFAULTS.faq,
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
