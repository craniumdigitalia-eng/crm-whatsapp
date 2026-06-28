// Testes do motor (runFollowUpCheck) em modo CADENCIA: gates de dia (dueDay) e
// hora (BRT), maximo 1 toque/dia, fast-forward do indice ao retomar ([K1]) e
// encerramento automatico. Relogio fixado com fake timers; deps mockadas.

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
  claimFollowUpTo: jest.fn(),
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

// Cadencia: helpers reais (brtHour/brtDayStartMs/elapsedBrtDays/cadenceMessage +
// DEFAULT_CADENCE); so getCadence e sobrescrito para devolver uma cadencia
// conhecida e HABILITADA.
jest.mock("./cadence", () => {
  const actual = jest.requireActual("./cadence");
  return { ...actual, getCadence: jest.fn() };
});

import { runFollowUpCheck } from "./scheduler";
import {
  listFollowUpCandidates,
  claimFollowUp,
  claimFollowUpTo,
  addMessage,
  setStatus,
  updateLeadFields,
} from "../crm/leads";
import { sendText } from "../whatsapp/evolution";
import { getCadence, CLOSURE_NOTE, DEFAULT_CADENCE } from "./cadence";

const mockList = listFollowUpCandidates as jest.Mock;
const mockClaimTo = claimFollowUpTo as jest.Mock;
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
  (claimFollowUp as jest.Mock).mockResolvedValue(true);
  mockSetStatus.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  mockSend.mockResolvedValue(undefined);
  mockClaimTo.mockResolvedValue(true);
  mockGetCadence.mockResolvedValue({ steps: STEPS, enabled: true });
});

afterEach(() => {
  jest.useRealTimers();
});

test("toque 0: dispara apos o dia e a hora, com {nome} interpolado e claim +1", () => {
  jest.setSystemTime(new Date("2026-06-25T15:00:00Z")); // 12h BRT
  // Criado 23/06 → elapsed 2: so o toque 0 (dueDay 1) venceu (o toque 1 e dueDay 4).
  mockList.mockResolvedValue([lead({ follow_up_count: 0, created_at: "2026-06-23T12:00:00Z" })]);

  return runFollowUpCheck(50).then((result) => {
    // Sem atraso: claim avanca de 0 -> 1.
    expect(mockClaimTo).toHaveBeenCalledWith("lead-1", 0, 1, 2, expect.any(Number));
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
    expect(mockClaimTo).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });
});

test("gate de HORA: antes da hora do toque nao dispara (sem claim)", () => {
  jest.setSystemTime(new Date("2026-06-25T13:00:00Z")); // 10h BRT (< 12h do toque 1)
  mockList.mockResolvedValue([lead({ follow_up_count: 1 })]); // dueDay 4, elapsed grande

  return runFollowUpCheck(50).then((result) => {
    expect(mockClaimTo).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });
});

test("ja contatado hoje: nao dispara de novo (max 1/dia), sem claim", () => {
  jest.setSystemTime(new Date("2026-06-25T15:00:00Z")); // 12h BRT
  // last hoje 10h BRT (13:00Z) — depois da meia-noite BRT de hoje (03:00Z).
  mockList.mockResolvedValue([lead({ follow_up_count: 0, last_message_at: "2026-06-25T13:00:00Z" })]);

  return runFollowUpCheck(50).then((result) => {
    expect(mockClaimTo).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });
});

test("[K1] fast-forward: lead que conversou ~1 mes e sumiu recebe SO 1 toque (o de hoje)", () => {
  jest.setSystemTime(new Date("2026-06-25T15:00:00Z")); // 12h BRT
  // Cadencia DEFAULT real (29 toques). Lead criado ha 30 dias, follow_up_count=0
  // (ficou conversando, indice congelado). elapsed=30 → o toque "de hoje" e o de
  // maior dueDay <= 30, que e o dia 28 (indice 13).
  mockGetCadence.mockResolvedValue({ steps: DEFAULT_CADENCE, enabled: true });
  mockList.mockResolvedValue([
    lead({ follow_up_count: 0, created_at: "2026-05-26T12:00:00Z", last_message_at: "2026-06-24T20:00:00Z" }),
  ]);

  return runFollowUpCheck(50).then((result) => {
    // NAO despeja o backlog: 1 unico envio.
    expect(mockSend).toHaveBeenCalledTimes(1);
    // Claim salta o indice de 0 direto para 14 (envia so o toque 13).
    expect(mockClaimTo).toHaveBeenCalledWith("lead-1", 0, 14, DEFAULT_CADENCE.length, expect.any(Number));
    // Nao encerra (ainda ha toques pela frente).
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result.sent).toBe(1);
  });
});

test("lead frio normal: indice acompanha os dias, sem salto (claim +1)", () => {
  jest.setSystemTime(new Date("2026-06-25T15:00:00Z")); // 12h BRT
  // Criado ontem (24/06) → elapsed 1 → toque do dia = indice 0 (dueDay 1).
  mockGetCadence.mockResolvedValue({ steps: DEFAULT_CADENCE, enabled: true });
  mockList.mockResolvedValue([
    lead({ follow_up_count: 0, created_at: "2026-06-24T12:00:00Z", last_message_at: "2026-06-24T20:00:00Z" }),
  ]);

  return runFollowUpCheck(50).then((result) => {
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockClaimTo).toHaveBeenCalledWith("lead-1", 0, 1, DEFAULT_CADENCE.length, expect.any(Number));
    expect(result.sent).toBe(1);
  });
});

test("ultimo toque da cadencia → encerra com status perdido + nota de encerramento", () => {
  jest.setSystemTime(new Date("2026-06-25T15:00:00Z")); // 12h BRT (>= 12h do toque 1)
  mockList.mockResolvedValue([lead({ follow_up_count: 1 })]); // ultimo toque (2 toques)

  return runFollowUpCheck(50).then(() => {
    expect(mockClaimTo).toHaveBeenCalledWith("lead-1", 1, 2, 2, expect.any(Number));
    expect(mockSend).toHaveBeenCalledWith("5511999990001", "D4 Carlos");
    expect(mockUpdate).toHaveBeenCalledWith("lead-1", { status: "perdido", notes: CLOSURE_NOTE });
    // Encerramento usa updateLeadFields (com nota), nao setStatus puro.
    expect(mockSetStatus).not.toHaveBeenCalled();
  });
});
