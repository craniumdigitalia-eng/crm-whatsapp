import {
  parseBudgetBRL,
  parsePeriod,
  sinceForPeriod,
  buildFunnel,
  bucketByDay,
  avgFirstResponseMinutes,
  sourceLabel,
  FUNNEL_STAGES,
  type MsgLite,
} from "./metrics";
import type { LeadStatus } from "../types";

// Helper: contagens por status zeradas, com overrides.
function counts(over: Partial<Record<LeadStatus, number>>): Record<LeadStatus, number> {
  return {
    novo: 0,
    em_atendimento: 0,
    qualificado: 0,
    proposta: 0,
    fechado: 0,
    perdido: 0,
    humano: 0,
    ...over,
  };
}

describe("parseBudgetBRL", () => {
  it("parseia formato brasileiro com R$ e milhar", () => {
    expect(parseBudgetBRL("R$ 2.400")).toBe(2400);
    expect(parseBudgetBRL("R$ 1.234.567")).toBe(1234567);
  });
  it("parseia decimal com vírgula", () => {
    expect(parseBudgetBRL("R$ 2.400,50")).toBe(2400.5);
    expect(parseBudgetBRL("199,90")).toBe(199.9);
  });
  it("parseia número simples e sufixo k/mil", () => {
    expect(parseBudgetBRL("2400")).toBe(2400);
    expect(parseBudgetBRL("2k")).toBe(2000);
    expect(parseBudgetBRL("3 mil")).toBe(3000);
  });
  it("trata ponto decimal isolado (não milhar)", () => {
    expect(parseBudgetBRL("2.5")).toBe(2.5);
  });
  it("retorna null para texto sem número ou vazio", () => {
    expect(parseBudgetBRL(null)).toBeNull();
    expect(parseBudgetBRL("")).toBeNull();
    expect(parseBudgetBRL("a combinar")).toBeNull();
    expect(parseBudgetBRL("R$ 0")).toBeNull();
  });
});

describe("parsePeriod", () => {
  it("aceita valores válidos e cai em 30d por padrão", () => {
    expect(parsePeriod("7d")).toBe("7d");
    expect(parsePeriod("all")).toBe("all");
    expect(parsePeriod("xyz")).toBe("30d");
    expect(parsePeriod(null)).toBe("30d");
  });
});

describe("sinceForPeriod", () => {
  it("retorna null para 'all' e ISO no passado para janelas", () => {
    const now = Date.parse("2026-06-26T00:00:00.000Z");
    expect(sinceForPeriod("all", now)).toBeNull();
    expect(sinceForPeriod("7d", now)).toBe("2026-06-19T00:00:00.000Z");
    expect(sinceForPeriod("30d", now)).toBe("2026-05-27T00:00:00.000Z");
  });
});

describe("buildFunnel", () => {
  it("banco vazio: tudo zero, conversões null", () => {
    const f = buildFunnel(counts({}));
    expect(f.stages).toHaveLength(FUNNEL_STAGES.length);
    expect(f.stages.every((s) => s.reached === 0 && s.current === 0)).toBe(true);
    expect(f.conversions.every((c) => c.rate === null)).toBe(true);
  });

  it("reached é cumulativo (monotônico decrescente) e conversões corretas", () => {
    // 10 novo, 6 qualificado, 3 proposta, 1 fechado
    const f = buildFunnel(counts({ novo: 10, qualificado: 6, proposta: 3, fechado: 1 }));
    const byStatus = Object.fromEntries(f.stages.map((s) => [s.status, s.reached]));
    expect(byStatus.novo).toBe(20); // 10+6+3+1
    expect(byStatus.em_atendimento).toBe(10); // 6+3+1
    expect(byStatus.qualificado).toBe(10);
    expect(byStatus.proposta).toBe(4); // 3+1
    expect(byStatus.fechado).toBe(1);

    const conv = Object.fromEntries(f.conversions.map((c) => [`${c.from}->${c.to}`, c.rate]));
    expect(conv["qualificado->proposta"]).toBeCloseTo(4 / 10);
    expect(conv["proposta->fechado"]).toBeCloseTo(1 / 4);
  });

  it("perdido/humano não entram nas contagens do funil feliz", () => {
    const f = buildFunnel(counts({ novo: 5, perdido: 4, humano: 2 }));
    expect(f.stages.find((s) => s.status === "novo")!.reached).toBe(5);
  });
});

describe("bucketByDay", () => {
  it("preenche todos os dias do intervalo, inclusive os zerados", () => {
    const from = Date.parse("2026-06-01T10:00:00Z");
    const to = Date.parse("2026-06-03T20:00:00Z");
    const pts = bucketByDay(
      ["2026-06-01T11:00:00Z", "2026-06-03T09:00:00Z", "2026-06-03T23:00:00Z"],
      from,
      to
    );
    expect(pts).toEqual([
      { date: "2026-06-01", count: 1 },
      { date: "2026-06-02", count: 0 },
      { date: "2026-06-03", count: 2 },
    ]);
  });
  it("intervalo vazio retorna lista vazia ou única", () => {
    const t = Date.parse("2026-06-10T00:00:00Z");
    expect(bucketByDay([], t, t)).toEqual([{ date: "2026-06-10", count: 0 }]);
  });
});

describe("avgFirstResponseMinutes", () => {
  it("média de minutos entre 1ª in e 1ª out posterior", () => {
    const byLead = new Map<string, MsgLite[]>();
    // lead A: in 10:00, out 10:30 -> 30 min
    byLead.set("A", [
      { direction: "in", created_at: "2026-06-01T10:00:00Z" },
      { direction: "out", created_at: "2026-06-01T10:30:00Z" },
    ]);
    // lead B: in 09:00, out 10:00 -> 60 min (ignora out anterior à in)
    byLead.set("B", [
      { direction: "out", created_at: "2026-06-01T08:00:00Z" },
      { direction: "in", created_at: "2026-06-01T09:00:00Z" },
      { direction: "out", created_at: "2026-06-01T10:00:00Z" },
    ]);
    expect(avgFirstResponseMinutes(byLead)).toBeCloseTo(45); // (30+60)/2
  });

  it("ignora leads sem resposta out e retorna null quando ninguém respondeu", () => {
    const byLead = new Map<string, MsgLite[]>();
    byLead.set("A", [{ direction: "in", created_at: "2026-06-01T10:00:00Z" }]);
    expect(avgFirstResponseMinutes(byLead)).toBeNull();
  });
});

describe("sourceLabel", () => {
  it("mapeia origens conhecidas e trata vazio", () => {
    expect(sourceLabel("meta_lead_ads")).toBe("Meta Lead Ads");
    expect(sourceLabel("whatsapp")).toBe("WhatsApp direto");
    expect(sourceLabel(null)).toBe("Sem origem");
    expect(sourceLabel("")).toBe("Sem origem");
    expect(sourceLabel("indicacao")).toBe("indicacao");
  });
});
