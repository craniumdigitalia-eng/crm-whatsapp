// Testes do provider de email plugavel: selecao por config e envio via Gmail SMTP
// (nodemailer mockado — nada sai de verdade).

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));
jest.mock("nodemailer", () => ({ createTransport: mockCreateTransport }));

import {
  getEmailProvider,
  GmailSmtpProvider,
  DevEmailProvider,
} from "./email-provider";
import type { EmailConfig } from "./integrations";

function cfg(over: Partial<EmailConfig>): EmailConfig {
  return { provider: "dev", apiKey: "", from: "", user: "", appPassword: "", ...over };
}

beforeEach(() => jest.clearAllMocks());

describe("getEmailProvider", () => {
  it("usa o Gmail SMTP quando provider='gmail' com credenciais", async () => {
    const p = await getEmailProvider(
      cfg({ provider: "gmail", user: "bot@gmail.com", appPassword: "abcd1234efgh5678" })
    );
    expect(p).toBeInstanceOf(GmailSmtpProvider);
    expect(p.name).toBe("gmail");
  });

  it("aceita o alias provider='smtp'", async () => {
    const p = await getEmailProvider(
      cfg({ provider: "smtp", user: "bot@gmail.com", appPassword: "x".repeat(16) })
    );
    expect(p).toBeInstanceOf(GmailSmtpProvider);
  });

  it("cai no 'dev' quando provider='gmail' sem credenciais", async () => {
    const p = await getEmailProvider(cfg({ provider: "gmail", user: "", appPassword: "" }));
    expect(p).toBeInstanceOf(DevEmailProvider);
  });

  it("usa 'dev' por padrao", async () => {
    const p = await getEmailProvider(cfg({ provider: "dev" }));
    expect(p).toBeInstanceOf(DevEmailProvider);
  });
});

describe("GmailSmtpProvider.send", () => {
  it("cria o transport do Gmail e envia, devolvendo o messageId", async () => {
    mockSendMail.mockResolvedValue({ messageId: "<abc@gmail>" });
    const p = new GmailSmtpProvider("bot@gmail.com", "senha-de-app", "Bruno <bot@gmail.com>");

    const res = await p.send({
      to: "lead@ex.com",
      subject: "Oi",
      html: "<p>corpo</p>",
      headers: { "X-Test": "1" },
    });

    expect(res.id).toBe("<abc@gmail>");
    expect(mockCreateTransport).toHaveBeenCalledWith({
      service: "gmail",
      auth: { user: "bot@gmail.com", pass: "senha-de-app" },
    });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Bruno <bot@gmail.com>",
        to: "lead@ex.com",
        subject: "Oi",
        html: "<p>corpo</p>",
        headers: { "X-Test": "1" },
      })
    );
  });

  it("usa a conta Gmail como remetente quando nao ha 'from'", async () => {
    mockSendMail.mockResolvedValue({ messageId: "<id>" });
    const p = new GmailSmtpProvider("bot@gmail.com", "senha", "");
    await p.send({ to: "lead@ex.com", subject: "s", html: "h" });
    expect(mockSendMail.mock.calls[0][0].from).toBe("bot@gmail.com");
  });

  it("lanca erro claro quando o envio falha", async () => {
    mockSendMail.mockRejectedValue(new Error("EAUTH invalido"));
    const p = new GmailSmtpProvider("bot@gmail.com", "senha", "");
    await expect(p.send({ to: "lead@ex.com", subject: "s", html: "h" })).rejects.toThrow(
      /Gmail SMTP: falha ao enviar.*EAUTH invalido/
    );
  });

  it("sem credenciais, lanca antes de criar transport", async () => {
    const p = new GmailSmtpProvider("", "", "");
    await expect(p.send({ to: "x@y.com", subject: "s", html: "h" })).rejects.toThrow(
      /sem credenciais/
    );
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });
});
