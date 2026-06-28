// Testes unitarios dos helpers puros da cadencia padrao (toque / fuso BRT /
// dias decorridos / interpolacao). Sem banco, sem rede — so funcoes puras.

import {
  parseCadenceSteps,
  stepAt,
  cadenceMessage,
  brtHour,
  brtDayStartMs,
  elapsedBrtDays,
  DEFAULT_CADENCE,
  type CadenceStep,
} from "./cadence";

describe("parseCadenceSteps", () => {
  test("normaliza toques validos (apara mensagem)", () => {
    const raw = [
      { dueDay: 1, hourBRT: 8, message: "  oi  " },
      { dueDay: 10, hourBRT: 19, message: "ola" },
    ];
    expect(parseCadenceSteps(raw)).toEqual([
      { dueDay: 1, hourBRT: 8, message: "oi" },
      { dueDay: 10, hourBRT: 19, message: "ola" },
    ]);
  });

  test("descarta toques invalidos (dia < 1, hora fora de 0-23, mensagem vazia, tipos errados)", () => {
    const raw = [
      { dueDay: 0, hourBRT: 8, message: "x" }, // dia invalido
      { dueDay: 1, hourBRT: 24, message: "x" }, // hora invalida
      { dueDay: 1, hourBRT: -1, message: "x" }, // hora invalida
      { dueDay: 1.5, hourBRT: 8, message: "x" }, // dia nao inteiro
      { dueDay: 2, hourBRT: 12, message: "   " }, // mensagem vazia
      { dueDay: "a", hourBRT: 8, message: "z" }, // dia nao numerico
      { dueDay: 34, hourBRT: 21, message: "ok" }, // valido
    ];
    expect(parseCadenceSteps(raw)).toEqual([{ dueDay: 34, hourBRT: 21, message: "ok" }]);
  });

  test("aceita hora 0 (meia-noite) como valida", () => {
    expect(parseCadenceSteps([{ dueDay: 1, hourBRT: 0, message: "x" }])).toEqual([
      { dueDay: 1, hourBRT: 0, message: "x" },
    ]);
  });

  test("[K3] ordena por dueDay ascendente (defensivo contra edicao fora de ordem)", () => {
    const raw = [
      { dueDay: 10, hourBRT: 9, message: "c" },
      { dueDay: 1, hourBRT: 8, message: "a" },
      { dueDay: 4, hourBRT: 12, message: "b" },
    ];
    expect(parseCadenceSteps(raw)?.map((s) => s.dueDay)).toEqual([1, 4, 10]);
  });

  test("retorna null quando nao ha toque utilizavel", () => {
    expect(parseCadenceSteps([])).toBeNull();
    expect(parseCadenceSteps([{ dueDay: 0, hourBRT: 8, message: "" }])).toBeNull();
    expect(parseCadenceSteps("nao-array")).toBeNull();
    expect(parseCadenceSteps(null)).toBeNull();
  });

  test("o DEFAULT_CADENCE e valido, cobre 3 fases e termina por volta do dia 118", () => {
    const parsed = parseCadenceSteps(DEFAULT_CADENCE);
    expect(parsed).not.toBeNull();
    // 7 (fase 1) + 7 (fase 2: 10..28) + 15 (fase 3: 34..118 a cada 6) = 29 toques.
    expect(parsed).toHaveLength(29);
    // dueDay estritamente crescente.
    const days = DEFAULT_CADENCE.map((s) => s.dueDay);
    expect(days[0]).toBe(1);
    expect(days[days.length - 1]).toBe(118);
    for (let i = 1; i < days.length; i++) expect(days[i]).toBeGreaterThan(days[i - 1]);
  });

  test("DEFAULT — fase 1 dias/horas alternadas; fase 2 horas 9/14/19; fase 3 horas 10/15/20", () => {
    // Fase 1: dias 1-7 com horas 8,12,19,21,8,12,19.
    expect(DEFAULT_CADENCE.slice(0, 7).map((s) => [s.dueDay, s.hourBRT])).toEqual([
      [1, 8], [2, 12], [3, 19], [4, 21], [5, 8], [6, 12], [7, 19],
    ]);
    // Fase 2: dias 10..28 (passo 3), horas rotacionando 9/14/19.
    expect(DEFAULT_CADENCE.slice(7, 14).map((s) => [s.dueDay, s.hourBRT])).toEqual([
      [10, 9], [13, 14], [16, 19], [19, 9], [22, 14], [25, 19], [28, 9],
    ]);
    // Fase 3: dias 34..118 (passo 6), horas rotacionando 10/15/20.
    expect(DEFAULT_CADENCE.slice(14, 17).map((s) => [s.dueDay, s.hourBRT])).toEqual([
      [34, 10], [40, 15], [46, 20],
    ]);
    expect(DEFAULT_CADENCE[DEFAULT_CADENCE.length - 1]).toMatchObject({ dueDay: 118 });
  });
});

describe("stepAt", () => {
  const steps: CadenceStep[] = [
    { dueDay: 1, hourBRT: 8, message: "a" },
    { dueDay: 10, hourBRT: 12, message: "b" },
  ];

  test("retorna o toque pelo indice (follow_up_count 0-based)", () => {
    expect(stepAt(steps, 0)).toEqual(steps[0]);
    expect(stepAt(steps, 1)).toEqual(steps[1]);
  });

  test("retorna null quando o toque nao existe (cadencia esgotada)", () => {
    expect(stepAt(steps, 2)).toBeNull();
    expect(stepAt(steps, 99)).toBeNull();
  });
});

describe("brtHour", () => {
  test("converte UTC para a hora local de Brasilia (UTC-3)", () => {
    expect(brtHour(new Date("2026-06-25T11:00:00Z"))).toBe(8); // 11 UTC = 8 BRT
    expect(brtHour(new Date("2026-06-25T15:00:00Z"))).toBe(12);
    expect(brtHour(new Date("2026-06-25T22:00:00Z"))).toBe(19);
    expect(brtHour(new Date("2026-06-26T00:00:00Z"))).toBe(21); // virou o dia em UTC, ainda 21 BRT
  });
});

describe("brtDayStartMs", () => {
  test("meia-noite BRT = 03:00 UTC do mesmo dia", () => {
    const start = brtDayStartMs(new Date("2026-06-25T15:00:00Z"));
    expect(new Date(start).toISOString()).toBe("2026-06-25T03:00:00.000Z");
  });

  test("antes das 03:00 UTC o 'dia BRT' ainda e o dia anterior", () => {
    const start = brtDayStartMs(new Date("2026-06-25T02:00:00Z"));
    expect(new Date(start).toISOString()).toBe("2026-06-24T03:00:00.000Z");
  });
});

describe("elapsedBrtDays", () => {
  test("conta dias de calendario BRT desde a criacao", () => {
    const created = "2026-06-20T18:00:00Z"; // 15h BRT do dia 20
    expect(elapsedBrtDays(created, new Date("2026-06-20T20:00:00Z"))).toBe(0); // mesmo dia
    expect(elapsedBrtDays(created, new Date("2026-06-21T12:00:00Z"))).toBe(1);
    expect(elapsedBrtDays(created, new Date("2026-06-27T12:00:00Z"))).toBe(7);
  });

  test("ignora a hora do dia (conta por dia de calendario, nao 24h corridas)", () => {
    // Criado 23h BRT (dia 20); 8h BRT do dia seguinte ja conta como 1 dia.
    const created = "2026-06-21T02:00:00Z"; // 23h BRT do dia 20
    expect(elapsedBrtDays(created, new Date("2026-06-21T11:00:00Z"))).toBe(1); // 8h BRT dia 21
  });

  test("data de criacao invalida → 0", () => {
    expect(elapsedBrtDays("nao-data", new Date("2026-06-25T12:00:00Z"))).toBe(0);
  });
});

describe("cadenceMessage", () => {
  const steps: CadenceStep[] = [{ dueDay: 1, hourBRT: 8, message: "Bom dia {nome}! Tudo bem?" }];

  test("interpola {nome} com o primeiro nome do lead", () => {
    expect(cadenceMessage(steps, 0, "Maria Silva")).toBe("Bom dia Maria! Tudo bem?");
  });

  test("sem nome, nao deixa lacuna ('dia !' vira 'dia!')", () => {
    expect(cadenceMessage(steps, 0, null)).toBe("Bom dia! Tudo bem?");
    expect(cadenceMessage(steps, 0, "")).toBe("Bom dia! Tudo bem?");
  });

  test("retorna null quando o toque nao existe", () => {
    expect(cadenceMessage(steps, 5, "Maria")).toBeNull();
  });

  test("substitui multiplas ocorrencias de {nome}", () => {
    const s: CadenceStep[] = [{ dueDay: 1, hourBRT: 8, message: "{nome}, {nome} de novo" }];
    expect(cadenceMessage(s, 0, "Joao Souza")).toBe("Joao, Joao de novo");
  });
});
