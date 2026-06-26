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
// Hoje só 'dev' está implementado; qualquer outro valor cai no 'dev' com um
// aviso (fail-safe — não derruba o envio por falta de ESP). Plugue o real
// adicionando um `case` aqui.
export async function getEmailProvider(cfg?: EmailConfig): Promise<EmailProvider> {
  const c = cfg ?? (await getEmailConfig());
  switch (c.provider) {
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
