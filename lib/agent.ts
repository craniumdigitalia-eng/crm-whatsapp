import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import { systemPrompt } from "./prompt";
import { Lead, Message, LeadStatus } from "./types";
import { updateLeadFields } from "./leads";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// Modelos que suportam adaptive thinking + effort (Opus 4.6+/Sonnet 4.6/Fable 5).
const supportsEffort = /opus-4-(6|7|8)|sonnet-4-6|fable-5/.test(config.agentModel);

const tools = [
  {
    name: "atualizar_lead",
    description:
      "Registra ou atualiza informacoes de qualificacao do lead no CRM. Use sempre que descobrir o servico desejado, orcamento, ou quiser anotar algo util.",
    input_schema: {
      type: "object",
      properties: {
        service_interest: { type: "string", description: "Servico/projeto que o lead deseja." },
        budget: { type: "string", description: "Nocao de orcamento informada pelo lead, se houver." },
        notes: { type: "string", description: "Anotacoes uteis sobre o contexto/necessidade do lead." },
        status: {
          type: "string",
          enum: ["em_atendimento", "qualificado"],
          description: "Use 'qualificado' quando ja entendeu o servico e tem nocao de objetivo ou orcamento.",
        },
      },
    },
  },
  {
    name: "transferir_para_humano",
    description:
      "Transfere o atendimento para um especialista humano. Use quando o lead pedir falar com alguem, quiser proposta formal, demonstrar intencao clara de contratar, ou a conversa exigir um especialista.",
    input_schema: {
      type: "object",
      properties: {
        resumo: { type: "string", description: "Resumo do caso para o especialista que vai assumir." },
      },
      required: ["resumo"],
    },
  },
];

function historyToMessages(history: Message[]): any[] {
  return history.map((m) => ({
    role: m.direction === "in" ? "user" : "assistant",
    content: m.body,
  }));
}

async function applyTool(lead: Lead, name: string, input: any): Promise<{ handoff: boolean }> {
  if (name === "atualizar_lead") {
    await updateLeadFields(lead.id, {
      service_interest: input.service_interest,
      budget: input.budget,
      notes: input.notes,
      status: input.status as LeadStatus | undefined,
    });
    return { handoff: false };
  }
  if (name === "transferir_para_humano") {
    const note = input.resumo ? `[Transferido p/ humano] ${input.resumo}` : "[Transferido p/ humano]";
    await updateLeadFields(lead.id, { status: "humano", notes: note });
    return { handoff: true };
  }
  return { handoff: false };
}

export interface AgentResult {
  reply: string;
  handoff: boolean;
}

export async function generateReply(lead: Lead, history: Message[]): Promise<AgentResult> {
  const messages: any[] = historyToMessages(history);
  let handoff = false;

  for (let i = 0; i < 5; i++) {
    const params: any = {
      model: config.agentModel,
      max_tokens: 1024,
      system: systemPrompt(),
      tools,
      messages,
    };
    if (supportsEffort) {
      params.thinking = { type: "adaptive" };
      params.output_config = { effort: "low" };
    }

    const response = await client.messages.create(params);

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await applyTool(lead, block.name, block.input);
          handoff = handoff || result.handoff;
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "ok" });
        }
      }
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { reply, handoff };
  }

  return { reply: "", handoff };
}
