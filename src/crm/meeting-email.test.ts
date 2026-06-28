// Testes do email transacional de confirmacao de reuniao. Provider e landing URL
// sao mockados — nada de banco nem de envio real.

jest.mock("./email-provider", () => ({
  getEmailProvider: jest.fn(),
}));
jest.mock("./integrations", () => ({
  getCorretorLandingUrl: jest.fn().mockResolvedValue("https://craniumdigital.com.br/corretores"),
}));

import {
  formatMeetingWhen,
  buildMeetingConfirmationHtml,
  sendMeetingConfirmation,
} from "./meeting-email";
import { getEmailProvider } from "./email-provider";
import { Lead } from "../types";

const mockGetProvider = getEmailProvider as jest.Mock;

const lead = {
  id: "lead-1",
  phone: "5511999990001",
  name: "Carlos Souza",
  email: "carlos@corretor.com",
} as Lead;

describe("formatMeetingWhen", () => {
  it("formata data/hora no fuso de Brasilia (hora cheia)", () => {
    // 2026-07-03T18:00:00Z = 15:00 em America/Sao_Paulo (UTC-3).
    const out = formatMeetingWhen("2026-07-03T18:00:00Z");
    expect(out).toMatch(/03\/07 às 15h$/);
    // Deve trazer o nome do dia da semana no inicio.
    expect(out).toMatch(/^(domingo|segunda|terça|quarta|quinta|sexta|sábado),/);
  });

  it("inclui os minutos quando nao for hora cheia", () => {
    const out = formatMeetingWhen("2026-07-03T18:30:00Z");
    expect(out).toMatch(/às 15h30$/);
  });
});

describe("buildMeetingConfirmationHtml", () => {
  const when = "https://meet.google.com/abc-defg-hij";

  it("inclui saudacao com o nome, link do Meet e a landing de corretores", () => {
    const html = buildMeetingConfirmationHtml(
      lead,
      // durationMin = 60 (bloqueio na agenda) — NAO deve aparecer no email.
      { meetLink: when, startISO: "2026-07-03T18:00:00Z", durationMin: 60 },
      "https://craniumdigital.com.br/corretores"
    );
    expect(html).toContain("Carlos"); // primeiro nome na saudacao
    expect(html).toContain(when); // botao do Meet
    expect(html).toContain("https://craniumdigital.com.br/corretores"); // pagina de corretores
    expect(html).toContain("Bruno Castro"); // assinatura
    expect(html).toContain("Cranium Digital");
    expect(html).toMatch(/15h/); // data/hora formatada
    // Comunica ~20 min ao lead; nunca expoe o bloqueio de 60 min.
    expect(html).toContain("cerca de 20 minutos");
    expect(html).not.toContain("60 min");
  });

  it("sem meetLink, nao quebra e orienta sobre o convite da agenda", () => {
    const html = buildMeetingConfirmationHtml(
      lead,
      { startISO: "2026-07-03T18:00:00Z" },
      "https://craniumdigital.com.br"
    );
    expect(html).toContain("Google Agenda");
    expect(html).not.toContain("Entrar na reunião (Google Meet)");
  });
});

describe("sendMeetingConfirmation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("envia pelo provider quando o lead tem email", async () => {
    const send = jest.fn().mockResolvedValue({ id: "msg-1" });
    mockGetProvider.mockResolvedValue({ name: "dev", send });

    const res = await sendMeetingConfirmation(lead, {
      meetLink: "https://meet.google.com/x",
      startISO: "2026-07-03T18:00:00Z",
      durationMin: 30,
    });

    expect(res.sent).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const msg = send.mock.calls[0][0];
    expect(msg.to).toBe("carlos@corretor.com");
    expect(msg.subject).toMatch(/confirmada/i);
    expect(msg.html).toContain("https://meet.google.com/x");
  });

  it("sem email do lead, nao envia e nao quebra", async () => {
    const res = await sendMeetingConfirmation({ ...lead, email: null } as Lead, {
      startISO: "2026-07-03T18:00:00Z",
    });
    expect(res.sent).toBe(false);
    expect(mockGetProvider).not.toHaveBeenCalled();
  });

  it("erro do provider nao lanca — devolve sent=false", async () => {
    mockGetProvider.mockResolvedValue({
      name: "dev",
      send: jest.fn().mockRejectedValue(new Error("falha ESP")),
    });
    const res = await sendMeetingConfirmation(lead, { startISO: "2026-07-03T18:00:00Z" });
    expect(res.sent).toBe(false);
    expect(res.reason).toMatch(/falha ESP/);
  });
});
