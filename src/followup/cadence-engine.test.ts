// Testes do motor (runFollowUpCheck) em modo CADENCIA: gates de dia (dueDay) e
// hora (BRT), maximo 1 toque/dia e encerramento automatico no ultimo toque.
// Relogio fixado com fake timers; deps mockadas.

jest.mock("../config", () => ({
  config: {
    followupMax: 30,
    followupIntervalMs: 24 * 60 * 60 * 1000,
    followupBatch: 50,
    companyName: "empresa teste",
    // Necessario porque cadence.ts (real) importa ../db, que cria o client.
    supabaseUrl: "http://localhost:54321",
    supabaseServiceRoleKey: "test-service-role-key",
  },
}));

jest.mock("../crm/leads", () => ({
  listFollowUpCandidates: jest.fn(),
  claimFollowUp: jest.fn(),
  addMessage: jest.fn(),
  setStatus: jest.fn(),
  updateLeadFields: jest.fn(),
}));

jest.mock("../whatsapp/evolution", () => ({ sendText: jest.fn() }));

jest.mock("../crm/followup-schedule", () => ({
  getDueFollowUps: jest.fn(),
  markSent: jest.fn(),
  markError: jest.fn(),
}));

// Cadencia: helpers reais (brtHour/brtDayStartMs/elapsedBrtDays/cadenceMessage),
// so getCadence e sobrescrito para devolver uma cadencia conhecida e HABILITADA.
jest.mock("./cadence", () => {
  const actual = jest.requireActual("./cadence");
  return { ...actual, getCadence: jest.fn() };
});

import { runFollowUpCheck } from "./scheduler";
import {
  listFollowUpCandidates,
  claimFollowUp,
  addMessage,
  setStatus,
  updateLeadFields,
} from "../crm/leads";
import { sendText } from "../whatsapp/evolution";
import { getCadence, CLOSURE_NOTE } from "./cadence";

const mockList = listFollowUpCandidates as jest.Mock;
const mockClaim = claimFollowUp as jest.Mock;
const mockSend = sendText as jest.Mock;
const mockSetStatus = setStatus as jest.Mock;
const mockUpdate = updateLeadFields as jest.Mock;
const mockGetCadence = getCadence as jest.Mock;

// Cadencia de teste: 2 toques. Toque 0: dia 1, 8h. Toque 1: dia 4, 12h.
const STEPS = [
  { dueDay: 1, hourBRT: 8, message: "D1 {nome}" },
  { dueDay: 4, hourBRT: 12, message: "D4 {nome}" },
];

function lead(
  overrides: Partial<{ follow_up_count: number; last_message_at: string; created_at: string }> = {}
) {
  return {
    id: "lead-1",
    phone: "5511999990001",
    name: "Carlos Lima",
    status: "em_atendimento",
    service_interest: null,
    budget: null,
    notes: null,
    follow_up_count: 0,
    last_direction: "out" as const,
    last_message_at: "2026-06-24T20:00:00Z", // ontem (BRT)
    created_at: "2026-06-20T10:00:00Z", // bem no passado por padrao
    updated_at: "2026-06-24T20:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (addMessage as jest.Mock).mockResolvedValue(true);
  mockSetStatus.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  mockSend.mockResolvedValue(undefined);
  mockClaim.mockResolvedValue(true);
  mockGetCadence.mockResolvedValue({ steps: STEPS, enabled: true });
});

afterEach(() => {
  jest.useRealTimers();
});

test("toque 0: dispara apos o dia e a hora do toque, com {nome} interpolado", () => {
  jest.setSystemTime(new Date("2026-06-25T15:00:00Z")); // 12h BRT; elapsed >> 1
  mockList.mockResolvedValue([lead({ follow_up_count: 0 })]);

  return runFollowUpCheck(50).then((result) => {
    expect(mockClaim).toHaveBeenCalledWith("lead-1", 0, 2, expect.any(Number));
    expect(mockSend).toHaveBeenCalledWith("5511999990001", "D1 Carlos");
    expect(result.sent).toBe(1);
  });
});

test("gate de DIA: antes do dueDay nao dispara (sem claim)", () => {
  jest.setSystemTime(new Date("2026-06-25T15:00:00Z")); // 12h BRT
  // Criado hoje → elapsed 0 < dueDay 1 do toque 0.
  mockList.mockResolvedValue([
    lead({ follow_up_count: 0, created_at: "2026-06-25T09:00:00Z", last_message_at: "2026-06-25T09:00:00Z" }),
  ]);

  return runFollowUpCheck(50).then((result) => {
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });
});

test("gate de HORA: antes da hora do toque nao dispara (sem claim)", () => {
  jest.setSystemTime(new Date("2026-06-25T13:00:00Z")); // 10h BRT (< 12h do toque 1)
  mockList.mockResolvedValue([lead({ follow_up_count: 1 })]); // dueDay 4, elapsed grande

  return runFollowUpCheck(50).then((result) => {
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });
});

test("ja contatado hoje: nao dispara de novo (max 1/dia), sem claim", () => {
  jest.setSystemTime(new Date("2026-06-25T15:00:00Z")); // 12h BRT
  // last hoje 10h BRT (13:00Z) — depois da meia-noite BRT de hoje (03:00Z).
  mockList.mockResolvedValue([lead({ follow_up_count: 0, last_message_at: "2026-06-25T13:00:00Z" })]);

  return runFollowUpCheck(50).then((result) => {
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });
});

test("gate de DIA respeita o dueDay do passo mesmo com follow_up_count avancado (fases 2/3)", () => {
  jest.setSystemTime(new Date("2026-06-25T15:00:00Z")); // 12h BRT
  // Cadencia onde o passo de indice 7 (fim da semana 1) so vence no dia 10.
  const steps = [
    ...Array.from({ length: 7 }, (_, i) => ({ dueDay: i + 1, hourBRT: 8, message: `S${i + 1}` })),
    { dueDay: 10, hourBRT: 8, message: "P2 {nome}" }, // indice 7, dueDay 10
  ];
  mockGetCadence.mockResolvedValue({ steps, enabled: true });

  // Lead ja em follow_up_count=7, mas com apenas 9 dias → passo dueDay=10 NAO dispara.
  // created 16/06 (12h BRT) → elapsed 9 dias em 25/06.
  mockList.mockResolvedValue([
    lead({ follow_up_count: 7, created_at: "2026-06-16T15:00:00Z", last_message_at: "2026-06-24T20:00:00Z" }),
  ]);

  return runFollowUpCheck(50)
    .then((result) => {
      expect(mockClaim).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);

      // Agora o lead tem 10 dias (created 15/06) → o passo dueDay=10 dispara.
      jest.clearAllMocks();
      mockClaim.mockResolvedValue(true);
      mockSend.mockResolvedValue(undefined);
      (addMessage as jest.Mock).mockResolvedValue(true);
      mockGetCadence.mockResolvedValue({ steps, enabled: true });
      mockList.mockResolvedValue([
        lead({ follow_up_count: 7, created_at: "2026-06-15T15:00:00Z", last_message_at: "2026-06-24T20:00:00Z" }),
      ]);
      return runFollowUpCheck(50);
    })
    .then((result2) => {
      expect(mockClaim).toHaveBeenCalledWith("lead-1", 7, 8, expect.any(Number));
      expect(mockSend).toHaveBeenCalledWith("5511999990001", "P2 Carlos");
      expect(result2.sent).toBe(1);
    });
});

test("ultimo toque da cadencia → encerra com status perdido + nota de encerramento", () => {
  jest.setSystemTime(new Date("2026-06-25T15:00:00Z")); // 12h BRT (>= 12h do toque 1)
  mockList.mockResolvedValue([lead({ follow_up_count: 1 })]); // ultimo toque (2 toques)

  return runFollowUpCheck(50).then(() => {
    expect(mockSend).toHaveBeenCalledWith("5511999990001", "D4 Carlos");
    expect(mockUpdate).toHaveBeenCalledWith("lead-1", { status: "perdido", notes: CLOSURE_NOTE });
    // Encerramento usa updateLeadFields (com nota), nao setStatus puro.
    expect(mockSetStatus).not.toHaveBeenCalled();
  });
});
