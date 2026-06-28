import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { systemPrompt, buildSystemPrompt } from "./prompt";
import type { AgentConfig } from "./config";
import { Lead, Message, LeadStatus } from "../types";
import { updateLeadFields } from "../crm/leads";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// Modelos que suportam adaptive thinking + effort (Opus 4.6+/Sonnet 4.6/Fable 5).
const supportsEffort = /opus-4-(6|7|8)|sonnet-4-6|fable-5/.test(config.agentModel);

const tools = [
  {
    name: "atualizar_lead",
    description:
      "Registra ou atualiza os dados do lead no CRM. Use A CADA resposta do lead que traga informacao nova: servico/interesse, orcamento, e SEMPRE atualizando o resumo (notes) com o que foi dito. Tambem ajuste o status conforme o desfecho da conversa.",
    input_schema: {
      type: "object",
      properties: {
        service_interest: {
          type: "string",
          description: "Servico/produto que o lead deseja (ex: 'plano de saude familiar', 'seguro de vida').",
        },
        budget: { type: "string", description: "Nocao de orcamento/valor informada pelo lead, se houver." },
        notes: {
          type: "string",
          description:
            "Resumo conciso e estruturado da qualificacao do lead, no formato definido nas instrucoes (servico, objetivo, situacao atual, proximo passo). REESCREVA o resumo inteiro (estado atual) a cada atualizacao — nao anexe nem empilhe historico. Ao agendar uma reuniao, inclua a linha 'Reuniao agendada' com o horario combinado.",
        },
        status: {
          type: "string",
          enum: ["em_atendimento", "qualificado", "perdido"],
          description:
            "Ajuste conforme o desfecho: 'qualificado' quando entendeu o servico e tem nocao de objetivo ou orcamento (use tambem ao AGENDAR uma reuniao, registrando 'Reuniao agendada' no notes); 'perdido' quando o lead disser claramente que NAO tem interesse.",
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
        resumo: {
          type: "string",
          description:
            "Resumo da qualificacao para o especialista que vai assumir, no mesmo formato estruturado do campo notes, com o Status indicando a transferencia. Vira o resumo (notes) do lead.",
        },
      },
      required: ["resumo"],
    },
  },
];

function historyToMessages(history: Message[]): Anthropic.MessageParam[] {
  // Mapeia o historico do CRM para o formato de mensagens da API.
  return history.map((m) => ({
    role: m.direction === "in" ? ("user" as const) : ("assistant" as const),
    content: m.body,
  }));
}

export async function applyTool(lead: Lead, name: string, input: any): Promise<{ handoff: boolean }> {
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
    // O resumo da transferencia e o proprio resumo de qualificacao (formato estruturado) —
    // vira o notes do lead. Se vier vazio, preserva o resumo que o agente ja mantinha em notes.
    const fields: Partial<Pick<Lead, "status" | "notes">> = { status: "humano" };
    if (input.resumo) fields.notes = input.resumo;
    await updateLeadFields(lead.id, fields);
    return { handoff: true };
  }
  return { handoff: false };
}

export interface AgentResult {
  reply: string;
  handoff: boolean;
}

export interface GenerateOptions {
  // Sobrescreve a config do agente (usado pela previa "testar" da aba Agente IA
  // para refletir edicoes ainda nao salvas). Se ausente, le a config salva.
  config?: AgentConfig;
  // Dry-run: NAO executa as ferramentas no CRM (nao grava nada). A previa usa isso
  // para testar a resposta sem efeitos colaterais. O handoff vira so um sinal.
  dryRun?: boolean;
}

// Gera a resposta do agente para a ultima mensagem do lead.
export async function generateReply(
  lead: Lead,
  history: Message[],
  opts: GenerateOptions = {}
): Promise<AgentResult> {
  // any[] porque o historico mistura mensagens de texto e blocos de conteudo (tool_use/thinking).
  const messages: any[] = historyToMessages(history);
  let handoff = false;

  // Monta o system prompt uma vez (config override na previa, ou a config salva).
  const system = opts.config ? buildSystemPrompt(opts.config) : await systemPrompt();

  // Loop agentic: executa ferramentas ate o modelo dar a resposta final.
  for (let i = 0; i < 5; i++) {
    const params: any = {
      model: config.agentModel,
      max_tokens: 1024,
      system,
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
          if (opts.dryRun) {
            // Previa: nao grava no CRM; so detecta a intencao de handoff.
            handoff = handoff || block.name === "transferir_para_humano";
          } else {
            const result = await applyTool(lead, block.name, block.input);
            handoff = handoff || result.handoff;
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: "ok",
          });
        }
      }
      // Preserva o conteudo do assistente (inclui blocos de thinking) e devolve os resultados.
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Resposta final: junta os blocos de texto.
    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { reply, handoff };
  }

  return { reply: "", handoff };
}
