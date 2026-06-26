// Testes unitarios de applyTool — aplicacao das ferramentas do agente no CRM.
// Sem chamada real a Claude: config e o repositorio de leads sao mockados.

// Mock do config — apiKey nao-vazia evita o Anthropic SDK lancar na construcao do client.
jest.mock("../config", () => ({
  config: {
    anthropicApiKey: "test-key",
    agentModel: "claude-opus-4-8",
    companyName: "Empresa Teste",
  },
}));

// Mock do repositorio: so precisamos espionar updateLeadFields.
jest.mock("../crm/leads", () => ({
  updateLeadFields: jest.fn(),
}));

// Mock do db: agent.ts -> prompt.ts -> config.ts importa { supabase } de ../db.
// Sem mock, o cliente Supabase real seria construido na carga (e estouraria com
// o config mockado sem URL). applyTool nao toca no supabase, entao um stub basta.
jest.mock("../db", () => ({ supabase: {} }));

import { applyTool } from "./agent";
import { updateLeadFields } from "../crm/leads";
import { Lead } from "../types";

const mockUpdate = updateLeadFields as jest.Mock;

// Lead minimo de teste.
const lead = { id: "lead-1", phone: "5511999990001" } as Lead;

const RESUMO =
  "📋 Resumo (IA):\n• Servico de interesse: site institucional\n• Objetivo: gerar leads\n• Orcamento: nao informado\n• Status: qualificando\n• Proximo passo: confirmar prazo";

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue(undefined);
});

// atualizar_lead deve repassar o resumo recebido para notes em updateLeadFields.
test("atualizar_lead grava o resumo em notes", async () => {
  const result = await applyTool(lead, "atualizar_lead", {
    service_interest: "site institucional",
    notes: RESUMO,
    status: "qualificado",
  });

  expect(result.handoff).toBe(false);
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  expect(mockUpdate).toHaveBeenCalledWith(
    lead.id,
    expect.objectContaining({ notes: RESUMO, service_interest: "site institucional", status: "qualificado" })
  );
});

// transferir_para_humano grava o resumo em notes (o resumo vira o notes do lead) e marca status humano.
test("transferir_para_humano grava o resumo em notes e marca handoff", async () => {
  const result = await applyTool(lead, "transferir_para_humano", { resumo: RESUMO });

  expect(result.handoff).toBe(true);
  expect(mockUpdate).toHaveBeenCalledWith(lead.id, { status: "humano", notes: RESUMO });
});

// transferir_para_humano sem resumo preserva o notes existente (nao sobrescreve com vazio).
test("transferir_para_humano sem resumo preserva o notes (so muda o status)", async () => {
  const result = await applyTool(lead, "transferir_para_humano", {});

  expect(result.handoff).toBe(true);
  expect(mockUpdate).toHaveBeenCalledWith(lead.id, { status: "humano" });
});
