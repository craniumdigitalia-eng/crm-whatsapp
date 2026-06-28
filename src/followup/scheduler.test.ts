// Testes unitarios de runFollowUpCheck (AC6 — Story 3.4).
// Todas as dependencias externas sao mockadas: sem banco, sem rede.

// Mock do config — valores fixos para os testes.
jest.mock("../config", () => ({
  config: {
    followupMax: 3,
    followupIntervalMs: 60 * 60 * 1000, // 1 hora
    followupBatch: 50,
    companyName: "empresa teste",
  },
}));

// Mocks dos repositorios e do canal de saida.
jest.mock("../crm/leads", () => ({
  listFollowUpCandidates: jest.fn(),
  claimFollowUp: jest.fn(),
  addMessage: jest.fn(),
  setStatus: jest.fn(),
  updateLeadFields: jest.fn(),
}));

jest.mock("../whatsapp/evolution", () => ({
  sendText: jest.fn(),
}));

// Follow-up agendado (migration 008) — mockado para nao carregar src/db.ts (Supabase)
// na suite. scheduler.ts importa este modulo desde a integracao do cron.
jest.mock("../crm/followup-schedule", () => ({
  getDueFollowUps: jest.fn(),
  markSent: jest.fn(),
  markError: jest.fn(),
}));

// Cadencia padrao — mockada DESABILITADA para que estes testes exercitem o
// fallback ROTATION (config.followupMax=3 etc.), preservando suas asserts.
// O mock tambem evita carregar src/db.ts (Supabase) via cadence.ts.
// A modalidade cadencia tem cobertura propria em cadence.test.ts.
jest.mock("./cadence", () => ({
  getCadence: jest.fn().mockResolvedValue({ steps: [], enabled: false }),
  cadenceMessage: jest.fn(),
  brtHour: jest.fn(),
  brtDayStartMs: jest.fn(),
  elapsedBrtDays: jest.fn(),
  CLOSURE_NOTE: "encerrado",
}));

import { runFollowUpCheck, runScheduledFollowUps } from "./scheduler";
import { listFollowUpCandidates, claimFollowUp, addMessage, setStatus } from "../crm/leads";
import { getDueFollowUps, markSent, markError } from "../crm/followup-schedule";
import { sendText } from "../whatsapp/evolution";

const mockList = listFollowUpCandidates as jest.Mock;
const mockClaim = claimFollowUp as jest.Mock;
const mockSend = sendText as jest.Mock;
const mockAddMsg = addMessage as jest.Mock;
const mockSetStatus = setStatus as jest.Mock;
const mockGetDue = getDueFollowUps as jest.Mock;
const mockMarkSent = markSent as jest.Mock;
const mockMarkError = markError as jest.Mock;

// Fabrica de lead de teste com intervalo ja vencido (last_message_at = 2 horas atras).
function makeExpiredLead(overrides: Partial<{
  id: string;
  phone: string;
  name: string | null;
  follow_up_count: number;
  last_message_at: string;
}> = {}) {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  return {
    id: "lead-1",
    phone: "5511999990001",
    name: "Teste",
    status: "em_atendimento",
    service_interest: null,
    budget: null,
    notes: null,
    follow_up_count: 0,
    last_direction: "out" as const,
    last_message_at: twoHoursAgo,
    created_at: twoHoursAgo,
    updated_at: twoHoursAgo,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Defaults felizes: addMessage e setStatus resolvem sem erro.
  mockAddMsg.mockResolvedValue(true);
  mockSetStatus.mockResolvedValue(undefined);
  mockSend.mockResolvedValue(undefined);
  // Follow-up agendado: claim (markSent) bem-sucedido por padrao.
  mockMarkSent.mockResolvedValue(true);
  mockMarkError.mockResolvedValue(undefined);
});

// Fabrica de follow-up agendado vencido (com lead embutido).
function makeDue(overrides: Partial<{
  id: string;
  lead_id: string;
  message: string;
  lead: { id: string; name: string | null; phone: string } | null;
}> = {}) {
  return {
    id: "fup-1",
    lead_id: "lead-1",
    scheduled_at: new Date(Date.now() - 60 * 1000).toISOString(),
    message: "Oi! Retomando nossa conversa.",
    status: "pendente" as const,
    created_by: null,
    created_at: new Date().toISOString(),
    sent_at: null,
    lead: { id: "lead-1", name: "Teste", phone: "5511999990001" },
    ...overrides,
  };
}

// AC6-1: lead com intervalo vencido recebe exatamente 1 retomada por ciclo.
test("lead com intervalo vencido recebe 1 retomada", async () => {
  const lead = makeExpiredLead();
  mockList.mockResolvedValue([lead]);
  mockClaim.mockResolvedValue(true);

  const result = await runFollowUpCheck(50);

  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend).toHaveBeenCalledWith(lead.phone, expect.any(String));
  expect(mockAddMsg).toHaveBeenCalledWith(lead.id, "out", expect.any(String));
  expect(result.sent).toBe(1);
  expect(result.skipped).toBe(0);
  expect(result.errors).toBe(0);
});

// AC6-2: lead que respondeu (claim falhou) nao recebe retomada.
test("lead que respondeu nao recebe retomada (claim falhou)", async () => {
  mockList.mockResolvedValue([makeExpiredLead()]);
  mockClaim.mockResolvedValue(false); // simulacoes de lead que respondeu entre leitura e claim

  const result = await runFollowUpCheck(50);

  expect(mockSend).not.toHaveBeenCalled();
  expect(result.sent).toBe(0);
  expect(result.skipped).toBe(1);
});

// AC6-3: lead que atingiu FOLLOWUP_MAX (3) vira "perdido".
test("lead na ultima retomada vira perdido", async () => {
  // follow_up_count = 2 → newCount = 3 = followupMax → isLast = true
  const lead = makeExpiredLead({ follow_up_count: 2 });
  mockList.mockResolvedValue([lead]);
  mockClaim.mockResolvedValue(true);

  await runFollowUpCheck(50);

  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSetStatus).toHaveBeenCalledWith(lead.id, "perdido");
});

// Lead ainda dentro do intervalo e pulado sem tentar claim.
test("lead dentro do intervalo e pulado sem claim", async () => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const lead = makeExpiredLead({ last_message_at: fiveMinAgo });
  mockList.mockResolvedValue([lead]);

  const result = await runFollowUpCheck(50);

  expect(mockClaim).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
  expect(result.skipped).toBe(1);
});

// Falha de envio conta como erro mas nao impede a transicao para perdido no ultimo ciclo.
test("falha de envio na ultima retomada ainda transita para perdido", async () => {
  const lead = makeExpiredLead({ follow_up_count: 2 });
  mockList.mockResolvedValue([lead]);
  mockClaim.mockResolvedValue(true);
  mockSend.mockRejectedValue(new Error("rede indisponivel"));

  const result = await runFollowUpCheck(50);

  expect(result.errors).toBe(1);
  expect(mockSetStatus).toHaveBeenCalledWith(lead.id, "perdido");
});

// Multiplos leads: cada um recebe uma retomada independente.
test("dois leads vencidos recebem retomadas independentes", async () => {
  const lead1 = makeExpiredLead({ id: "lead-1", phone: "5511000000001" });
  const lead2 = makeExpiredLead({ id: "lead-2", phone: "5511000000002" });
  mockList.mockResolvedValue([lead1, lead2]);
  mockClaim.mockResolvedValue(true);

  const result = await runFollowUpCheck(50);

  expect(mockSend).toHaveBeenCalledTimes(2);
  expect(result.sent).toBe(2);
});

// =====================================================================
// runScheduledFollowUps — follow-ups AGENDADOS por lead (migration 008).
// =====================================================================

// Item vencido e enviado e marcado como enviado.
test("agendado vencido e enviado via canal e marcado como enviado", async () => {
  const due = makeDue();
  mockGetDue.mockResolvedValue([due]);

  const result = await runScheduledFollowUps();

  expect(mockMarkSent).toHaveBeenCalledWith(due.id); // claim antes do envio
  expect(mockSend).toHaveBeenCalledWith(due.lead!.phone, due.message);
  expect(mockAddMsg).toHaveBeenCalledWith(due.lead_id, "out", due.message);
  expect(result.sent).toBe(1);
  expect(result.errors).toBe(0);
});

// Claim perdido (outro ciclo pegou): nao envia.
test("agendado ja reivindicado por outro ciclo nao e reenviado", async () => {
  mockGetDue.mockResolvedValue([makeDue()]);
  mockMarkSent.mockResolvedValue(false); // claim falhou

  const result = await runScheduledFollowUps();

  expect(mockSend).not.toHaveBeenCalled();
  expect(result.sent).toBe(0);
});

// Falha de envio: marca erro e nao aborta os demais itens.
test("falha de envio de um agendado marca erro e nao aborta os demais", async () => {
  const due1 = makeDue({ id: "fup-1", lead_id: "lead-1", lead: { id: "lead-1", name: "A", phone: "5511000000001" } });
  const due2 = makeDue({ id: "fup-2", lead_id: "lead-2", lead: { id: "lead-2", name: "B", phone: "5511000000002" } });
  mockGetDue.mockResolvedValue([due1, due2]);
  mockSend.mockRejectedValueOnce(new Error("rede indisponivel"));

  const result = await runScheduledFollowUps();

  expect(mockMarkError).toHaveBeenCalledWith(due1.id);
  expect(mockSend).toHaveBeenCalledTimes(2); // segue para o segundo item
  expect(result.sent).toBe(1);
  expect(result.errors).toBe(1);
});

// Lead sem telefone (removido): marca erro sem tentar enviar.
test("agendado sem telefone do lead vira erro sem enviar", async () => {
  mockGetDue.mockResolvedValue([makeDue({ lead: null })]);

  const result = await runScheduledFollowUps();

  expect(mockSend).not.toHaveBeenCalled();
  expect(mockMarkError).toHaveBeenCalled();
  expect(result.errors).toBe(1);
});
