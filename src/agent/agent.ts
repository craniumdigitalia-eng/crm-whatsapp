import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { systemPrompt, buildSystemPrompt } from "./prompt";
import type { AgentConfig } from "./config";
import { Lead, Message, LeadStatus } from "../types";
import { updateLeadFields, getLeadAttribution } from "../crm/leads";
import { createEvent, CalendarError } from "../crm/calendar";
import { sendMeetingConfirmation } from "../crm/meeting-email";

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
        email: {
          type: "string",
          description:
            "E-mail do lead, quando ele informar (ou confirmar). Use para salvar o e-mail que vai receber o convite/confirmacao da reuniao. Grave exatamente como o lead passou.",
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
  {
    name: "agendar_reuniao",
    description:
      "Cria a reuniao online no Google Calendar e envia o convite. Use SOMENTE depois que o lead CONFIRMAR um dia e horario especificos (nunca invente data/hora). Apos sucesso, confirme ao lead que enviou o convite. Se a ferramenta retornar erro, NAO prometa o agendamento — reconfirme o horario com o lead ou use transferir_para_humano.",
    input_schema: {
      type: "object",
      properties: {
        data_hora_iso: {
          type: "string",
          description:
            "Data e hora de inicio da reuniao em ISO 8601 no horario de Brasilia (ex.: '2026-07-02T15:00:00-03:00'). Deve ser uma data/hora FUTURA e em horario comercial.",
        },
        duracao_min: {
          type: "number",
          description:
            "Duracao do BLOQUEIO na agenda em minutos (default 60). NAO reduza para 20: ao lead comunicamos uma call rapida de ~20 min, mas reservamos 60 min de margem na agenda. So altere se o lead pedir explicitamente uma reuniao mais longa.",
        },
        titulo: {
          type: "string",
          description: "Titulo opcional do evento. Se vazio, usa 'Reuniao Cranium × {nome do lead}'.",
        },
        observacoes: {
          type: "string",
          description: "Observacoes/contexto para a descricao do evento (ex.: resumo da qualificacao). Opcional.",
        },
      },
      required: ["data_hora_iso"],
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

export interface ToolOutcome {
  handoff: boolean;
  // Conteudo do tool_result devolvido ao modelo. Para a maioria basta "ok";
  // para agendar_reuniao descreve sucesso/erro para o agente saber como seguir.
  content: string;
}

// Formata um instante no fuso de Brasilia para confirmar ao lead (ex.: "02/07 às 15:00").
function formatBR(date: Date): string {
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Bloco de contexto especifico do lead, anexado ao system prompt. Informa ao
// agente se ja temos e-mail e a ORIGEM do lead — base da regra de coleta de
// e-mail antes de agendar. No dry-run (previa) nao toca no banco: usa so o lead
// em memoria e nao assume origem de formulario.
async function leadContextBlock(lead: Lead, dryRun?: boolean): Promise<string> {
  const emailLinha = lead.email?.trim()
    ? `E-mail no cadastro: ${lead.email.trim()}`
    : `E-mail no cadastro: nenhum`;

  // Origem: meta_lead_ads = veio do FORMULARIO (provavelmente ja temos e-mail).
  // Tambem aproveita um e-mail vindo no form_data, caso o lead nao tenha email salvo.
  let veioDeFormulario = false;
  let emailFormulario: string | undefined;
  if (!dryRun) {
    try {
      const attr = await getLeadAttribution(lead.id);
      veioDeFormulario = attr?.source === "meta_lead_ads";
      if (attr?.form_data) {
        const hit = Object.entries(attr.form_data).find(
          ([k, v]) => /e-?mail/i.test(k) && v && v.includes("@")
        );
        emailFormulario = hit?.[1];
      }
    } catch {
      // tolerante: sem atribuicao, trata como WhatsApp/CTWA.
    }
  }

  const origem = veioDeFormulario
    ? "Origem: FORMULARIO (Meta Lead Ads) — em geral ja temos o e-mail dele; apenas CONFIRME antes de agendar."
    : "Origem: WhatsApp/CTWA — pode nao ter e-mail; PERGUNTE o melhor e-mail antes de agendar se ainda nao tiver.";

  const formularioLinha =
    emailFormulario && !lead.email?.trim()
      ? `\n- E-mail informado no formulario: ${emailFormulario} (confirme com o lead e salve via atualizar_lead)`
      : "";

  return `

CONTEXTO DESTE LEAD (use para a COLETA DE E-MAIL antes de agendar)
- ${emailLinha}${formularioLinha}
- ${origem}
- Antes de usar agendar_reuniao, garanta um e-mail valido do lead: se ja houver, confirme ("vou te enviar a confirmacao e o link no e-mail {email}, certo?"); se nao houver, peca ("me passa seu melhor e-mail pra eu te enviar o convite com o link da call?") e salve com atualizar_lead (campo email). So agende depois disso.`;
}

export async function applyTool(lead: Lead, name: string, input: any): Promise<ToolOutcome> {
  if (name === "atualizar_lead") {
    await updateLeadFields(lead.id, {
      service_interest: input.service_interest,
      email: typeof input.email === "string" && input.email.trim() ? input.email.trim() : undefined,
      budget: input.budget,
      notes: input.notes,
      status: input.status as LeadStatus | undefined,
    });
    return { handoff: false, content: "ok" };
  }
  if (name === "transferir_para_humano") {
    // O resumo da transferencia e o proprio resumo de qualificacao (formato estruturado) —
    // vira o notes do lead. Se vier vazio, preserva o resumo que o agente ja mantinha em notes.
    const fields: Partial<Pick<Lead, "status" | "notes">> = { status: "humano" };
    if (input.resumo) fields.notes = input.resumo;
    await updateLeadFields(lead.id, fields);
    return { handoff: true, content: "ok" };
  }
  if (name === "agendar_reuniao") {
    // Valida a data/hora: precisa ser parseavel e futura. Erros voltam como tool_result
    // (nao lancam) para o agente reconfirmar o horario ou cair pro transferir_para_humano.
    const start = new Date(input.data_hora_iso);
    if (isNaN(start.getTime())) {
      return {
        handoff: false,
        content:
          "Nao foi possivel agendar: data/hora invalida. Peca ao lead para confirmar um dia e horario validos antes de tentar de novo.",
      };
    }
    if (start.getTime() <= Date.now()) {
      return {
        handoff: false,
        content:
          "Nao foi possivel agendar: a data/hora informada esta no passado. Reconfirme com o lead um horario futuro.",
      };
    }

    // BLOQUEIO na agenda: default 60 min (margem de seguranca). Ao lead comunicamos
    // ~20 min — ver COMMUNICATED_MIN no email/prompt. So muda se o lead pedir mais tempo.
    const durationMin =
      typeof input.duracao_min === "number" && input.duracao_min > 0 ? input.duracao_min : 60;
    const end = new Date(start.getTime() + durationMin * 60_000);
    const quem = lead.name?.trim() || `+${lead.phone}`;
    const summary = (input.titulo as string)?.trim() || `Reuniao Cranium × ${quem}`;
    const description =
      (input.observacoes as string)?.trim() ||
      [`Lead: ${quem}`, `Telefone: ${lead.phone}`, lead.notes ? `\n${lead.notes}` : ""]
        .filter(Boolean)
        .join("\n");

    try {
      const event = await createEvent({
        summary,
        description,
        start,
        end,
        attendees: lead.email ? [lead.email] : undefined,
      });
      // Registra a reuniao no lead: status qualificado + linha de agendamento no resumo
      // (preserva o resumo existente, sem duplicar a linha). Prioriza o link do Meet.
      const quando = formatBR(start);
      const meetLink = event.meetLink || event.hangoutLink;
      const link = meetLink || event.htmlLink;
      const meetingLine = `📅 Reuniao agendada para ${quando}${link ? ` — ${link}` : ""}`;
      // Anexa a linha ao resumo existente (sem duplicar se ja houver agendamento).
      const notes = !lead.notes
        ? meetingLine
        : lead.notes.includes("Reuniao agendada")
          ? lead.notes
          : `${lead.notes}\n${meetingLine}`;
      await updateLeadFields(lead.id, { status: "qualificado", notes });

      // Email TRANSACIONAL de confirmacao (marca Cranium, link do Meet). So envia
      // se o lead tem email; falha de email NAO quebra o agendamento (apenas loga).
      if (lead.email) {
        await sendMeetingConfirmation(lead, {
          meetLink,
          startISO: start,
          // COMUNICADO ao lead: ~20 min (call rapida). O bloqueio na agenda (durationMin=60)
          // e so margem interna — o lead NAO ve os 60 min.
          durationMin: 20,
        }).catch((e) => console.error("[agent] sendMeetingConfirmation:", (e as Error).message));
      }

      return {
        handoff: false,
        content: `Reuniao criada no Google Calendar para ${quando} (bloqueio de ${durationMin} min na agenda — ao lead comunique uma call rapida de ~20 min, NAO os ${durationMin})${
          link ? `, link ${link}` : ""
        }. Convite ${lead.email ? `enviado para ${lead.email}` : "na agenda da Cranium (lead sem e-mail)"}. Confirme ao lead.`,
      };
    } catch (e) {
      const msg = e instanceof CalendarError ? e.message : (e as Error).message;
      console.error("[agent] agendar_reuniao:", msg);
      return {
        handoff: false,
        content: `Nao foi possivel criar o evento agora (${msg}). NAO prometa o agendamento ao lead — use transferir_para_humano para um consultor confirmar a reuniao.`,
      };
    }
  }
  return { handoff: false, content: "ok" };
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
  // Acrescenta o CONTEXTO DESTE LEAD (e-mail + origem) para a coleta de e-mail
  // antes de agendar (confirmar se veio do formulario; perguntar se veio do WhatsApp).
  const system = (opts.config ? buildSystemPrompt(opts.config) : await systemPrompt()) +
    (await leadContextBlock(lead, opts.dryRun));

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
          let content = "ok";
          if (opts.dryRun) {
            // Previa: nao grava no CRM nem cria evento real; so detecta o handoff
            // e simula o resultado do agendamento para o fluxo continuar.
            handoff = handoff || block.name === "transferir_para_humano";
            if (block.name === "agendar_reuniao") {
              content = "Reuniao simulada (previa) — em producao o evento seria criado no Google Calendar. Confirme ao lead.";
            }
          } else {
            const result = await applyTool(lead, block.name, block.input);
            handoff = handoff || result.handoff;
            content = result.content;
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content,
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
