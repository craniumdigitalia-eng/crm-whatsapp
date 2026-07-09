import { getEmailConfig, EmailConfig } from "./integrations";

// =====================================================================
// Motor de envio PLUGÁVEL (migration 007 — Email Marketing).
//
// O resto do módulo (src/crm/email.ts) só conhece a interface EmailProvider.
// Qual provedor (ESP) é usado de fato vem da config (env/integrations_config):
//   EMAIL_PROVIDER = 'dev' (default) | 'resend' | 'sendgrid' | 'brevo' | 'ses'
//   EMAIL_API_KEY  = credencial do ESP
//   EMAIL_FROM     = remetente "Nome <email@dominio>"
//
// >>> COMO PLUGAR UM ESP REAL <<<
// 1. Escreva uma classe que implemente EmailProvider (ver ResendProvider abaixo,
//    deixado como ESQUELETO comentado/documentado — descomente e ajuste).
// 2. Adicione um `case` no switch de getEmailProvider().
// 3. Garanta EMAIL_API_KEY e EMAIL_FROM na aba Email (ou no .env).
// Nenhuma outra parte do código muda — o ponto de extensão é só este arquivo.
// =====================================================================

// Uma mensagem de email a enviar.
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  // Cabeçalhos extras (ex.: List-Unsubscribe, X-Campaign-Id). Opcional.
  headers?: Record<string, string>;
  // Remetente. Se omitido, o provider usa o EMAIL_FROM da config.
  from?: string;
}

// Contrato mínimo de qualquer provedor de envio.
export interface EmailProvider {
  // Nome do provedor (para logs/diagnóstico).
  readonly name: string;
  // Envia uma mensagem e devolve o id atribuído pelo ESP (ou um id sintético no 'dev').
  send(msg: EmailMessage): Promise<{ id: string }>;
}

// ---------------------------------------------------------------------
// Provider DEFAULT: 'dev'. Não envia nada — apenas loga. Usado quando não
// há ESP configurado (ou EMAIL_PROVIDER=dev). Permite rodar todo o fluxo de
// campanha localmente sem mandar email de verdade.
// ---------------------------------------------------------------------
export class DevEmailProvider implements EmailProvider {
  readonly name = "dev";
  constructor(private readonly from: string) {}

  async send(msg: EmailMessage): Promise<{ id: string }> {
    const from = msg.from || this.from || "(sem remetente)";
    const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(
      `[email:dev] (NÃO ENVIADO) de="${from}" para="${msg.to}" assunto="${msg.subject}" ` +
        `html=${msg.html.length}b id=${id}`
    );
    return { id };
  }
}

// ---------------------------------------------------------------------
// Provider REAL: 'gmail'/'smtp' — envia de verdade via Gmail SMTP (nodemailer).
// Requer EMAIL_USER (conta Gmail) e EMAIL_APP_PASSWORD (senha de app de 16 chars,
// gerada em myaccount.google.com/apppasswords — NÃO a senha normal da conta).
// Funciona em serverless (Vercel): é SMTP de saída (porta 465/SSL), sem precisar
// de binário nativo nem de inbound. O transport é criado uma vez por instância.
// ---------------------------------------------------------------------
export class GmailSmtpProvider implements EmailProvider {
  readonly name = "gmail";
  // Lazy: o transport do nodemailer é criado no primeiro send (evita custo na
  // construção e mantém o import fora do caminho do provider 'dev').
  private transport?: import("nodemailer").Transporter;
  constructor(
    private readonly user: string,
    private readonly appPassword: string,
    private readonly from: string
  ) {}

  private async getTransport(): Promise<import("nodemailer").Transporter> {
    if (this.transport) return this.transport;
    const nodemailer = (await import("nodemailer")).default;
    // service:'gmail' já resolve host smtp.gmail.com / porta 465 (SSL).
    // Timeouts explícitos: em serverless sem eles o nodemailer pode segurar a função
    // até o maxDuration da Vercel sem retornar erro acionável.
    this.transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: this.user, pass: this.appPassword },
      connectionTimeout: 10_000,  // tempo máximo para estabelecer a conexão TCP
      greetingTimeout: 10_000,    // tempo máximo para receber o banner SMTP
      socketTimeout: 10_000,      // tempo máximo de inatividade no socket durante o envio
    });
    return this.transport;
  }

  async send(msg: EmailMessage): Promise<{ id: string }> {
    if (!this.user || !this.appPassword) {
      throw new Error("Gmail SMTP sem credenciais (EMAIL_USER / EMAIL_APP_PASSWORD).");
    }
    try {
      const transport = await this.getTransport();
      // Remetente: EMAIL_FROM se houver; senão a própria conta Gmail. O Gmail
      // exige que o endereço de envio seja a conta autenticada.
      const from = msg.from || this.from || this.user;
      const info = await transport.sendMail({
        from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        headers: msg.headers,
      });
      return { id: info.messageId };
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(`Gmail SMTP: falha ao enviar para ${msg.to} — ${detail}`);
    }
  }
}

// ---------------------------------------------------------------------
// ESQUELETO de provider real (Resend) — DEIXADO COMENTADO de propósito.
// O provedor específico (Resend/SendGrid/Brevo/SES) será informado depois.
// Para ativar: descomente, ajuste o endpoint/payload do ESP escolhido, e
// adicione o `case` correspondente em getEmailProvider().
//
// class ResendProvider implements EmailProvider {
//   readonly name = "resend";
//   constructor(private readonly apiKey: string, private readonly from: string) {}
//   async send(msg: EmailMessage): Promise<{ id: string }> {
//     const res = await fetch("https://api.resend.com/emails", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${this.apiKey}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         from: msg.from || this.from,
//         to: msg.to,
//         subject: msg.subject,
//         html: msg.html,
//         headers: msg.headers,
//       }),
//     });
//     if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
//     const data = (await res.json()) as { id?: string };
//     return { id: data.id ?? "" };
//   }
// }
// ---------------------------------------------------------------------

// Resolve o provider efetivo a partir da config (env/integrations_config).
// 'gmail'/'smtp' envia de verdade (nodemailer); 'dev' (ou faltando credencial)
// só loga. Qualquer valor desconhecido cai no 'dev' com um aviso (fail-safe —
// não derruba o envio por má configuração). Plugue outros ESP adicionando um `case`.
export async function getEmailProvider(cfg?: EmailConfig): Promise<EmailProvider> {
  const c = cfg ?? (await getEmailConfig());
  switch (c.provider) {
    case "gmail":
    case "smtp":
      if (!c.user || !c.appPassword) {
        console.warn(
          `[email] provider "${c.provider}" sem EMAIL_USER/EMAIL_APP_PASSWORD — usando 'dev' (só loga).`
        );
        return new DevEmailProvider(c.from || c.user);
      }
      return new GmailSmtpProvider(c.user, c.appPassword, c.from);
    // case "resend":
    //   if (!c.apiKey) break; // sem credencial -> cai no dev
    //   return new ResendProvider(c.apiKey, c.from);
    case "dev":
    case "":
      return new DevEmailProvider(c.from);
    default:
      console.warn(
        `[email] provider "${c.provider}" não implementado ainda — usando 'dev' (só loga). ` +
          `Plugue o ESP em src/crm/email-provider.ts.`
      );
      return new DevEmailProvider(c.from);
  }
}
