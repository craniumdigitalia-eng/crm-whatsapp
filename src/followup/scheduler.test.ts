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
}));

jest.mock("../whatsapp/evolution", () => ({
  sendText: jest.fn(),
}));

import { runFollowUpCheck } from "./scheduler";
import { listFollowUpCandidates, claimFollowUp, addMessage, setStatus } from "../crm/leads";
import { sendText } from "../whatsapp/evolution";

const mockList = listFollowUpCandidates as jest.Mock;
const mockClaim = claimFollowUp as jest.Mock;
const mockSend = sendText as jest.Mock;
const mockAddMsg = addMessage as jest.Mock;
const mockSetStatus = setStatus as jest.Mock;

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
});

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
