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

// Mock do calendar: agendar_reuniao chama createEvent — espionamos sem bater no Google.
// CalendarError e preservado para o teste do caminho de erro.
jest.mock("../crm/calendar", () => ({
  createEvent: jest.fn(),
  CalendarError: class CalendarError extends Error {},
}));

import { applyTool } from "./agent";
import { updateLeadFields } from "../crm/leads";
import { createEvent, CalendarError } from "../crm/calendar";
import { Lead } from "../types";

const mockUpdate = updateLeadFields as jest.Mock;
const mockCreateEvent = createEvent as jest.Mock;

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

// Data/hora 1h no futuro, em ISO com fuso de Brasilia.
function futureIso(): string {
  return new Date(Date.now() + 60 * 60_000).toISOString();
}

// agendar_reuniao com data futura cria o evento e marca o lead como qualificado.
test("agendar_reuniao cria o evento e qualifica o lead", async () => {
  mockCreateEvent.mockResolvedValue({ id: "evt-1", htmlLink: "https://cal/evt-1" });
  const leadComEmail = { id: "lead-1", phone: "5511999990001", email: "corretor@ex.com" } as Lead;

  const result = await applyTool(leadComEmail, "agendar_reuniao", { data_hora_iso: futureIso() });

  expect(result.handoff).toBe(false);
  expect(mockCreateEvent).toHaveBeenCalledTimes(1);
  // attendee = email do lead quando houver.
  expect(mockCreateEvent.mock.calls[0][0]).toEqual(
    expect.objectContaining({ attendees: ["corretor@ex.com"] })
  );
  expect(mockUpdate).toHaveBeenCalledWith(
    leadComEmail.id,
    expect.objectContaining({ status: "qualificado" })
  );
  expect(result.content).toMatch(/Reuniao criada/i);
});

// agendar_reuniao com data no passado NAO chama o Google e pede reconfirmacao.
test("agendar_reuniao rejeita data no passado", async () => {
  const past = new Date(Date.now() - 60 * 60_000).toISOString();
  const result = await applyTool(lead, "agendar_reuniao", { data_hora_iso: past });

  expect(mockCreateEvent).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(result.content).toMatch(/passado/i);
});

// Erro do Google nao quebra: volta orientacao para transferir_para_humano.
test("agendar_reuniao trata erro do Calendar sem lancar", async () => {
  mockCreateEvent.mockRejectedValue(new CalendarError("Google Calendar nao conectado"));
  const result = await applyTool(lead, "agendar_reuniao", { data_hora_iso: futureIso() });

  expect(result.handoff).toBe(false);
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(result.content).toMatch(/transferir_para_humano/i);
});
