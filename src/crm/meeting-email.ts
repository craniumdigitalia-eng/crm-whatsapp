import { Lead } from "../types";
import { getEmailProvider } from "./email-provider";
import { getCorretorLandingUrl } from "./integrations";

// =====================================================================
// Email TRANSACIONAL de confirmacao de reuniao (Meet + Connect).
//
// Diferente das campanhas (src/crm/email.ts), este e um disparo 1:1 acionado
// pelo agente apos agendar uma reuniao no Google Calendar. Reusa apenas o
// provider plugavel (getEmailProvider) — sem tracking/descadastro de campanha.
//
// Identidade Cranium (roxo #7C3AED, tipografia Geist). HTML com estilos inline
// para compatibilidade com clientes de email. Nunca quebra o agendamento: se
// faltar email do lead, ou der erro no envio, apenas loga.
// =====================================================================

const BRAND = "#7C3AED"; // roxo Cranium
const BRAND_DARK = "#5B21B6";
const TEXT = "#1F2937";
const MUTED = "#6B7280";
const BG = "#F4F1FB";

// Fontes: Geist (marca) com fallbacks seguros para clientes de email.
const FONT =
  "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface MeetingConfirmationData {
  meetLink?: string; // link da sala do Google Meet (pode faltar se a sala nao foi criada)
  startISO: string | Date; // inicio da reuniao
  durationMin?: number; // duracao em minutos (default 30)
}

// Dias da semana em PT-BR (Date.getDay no fuso de Brasilia via Intl).
const WEEKDAYS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

// Formata o inicio da reuniao em PT-BR amigavel, ex.: "quinta, 03/07 às 15h"
// (ou "às 15h30" quando ha minutos). Sempre no fuso de Brasilia.
export function formatMeetingWhen(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const tz = "America/Sao_Paulo";
  // Extrai os componentes ja no fuso de Brasilia.
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const hour = get("hour");
  const minute = get("minute");
  // weekday do Intl pode vir abreviado/localizado; derivamos pelo dia da semana real.
  const weekday = WEEKDAYS[weekdayInTz(date, tz)];
  const hora = minute === "00" ? `${hour}h` : `${hour}h${minute}`;
  return `${weekday}, ${day}/${month} às ${hora}`;
}

// Dia da semana (0=domingo) no fuso informado.
function weekdayInTz(date: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? new Date(date).getDay();
}

// Escapa texto para interpolar com seguranca no HTML do email.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Primeiro nome do lead para a saudacao (cai em "tudo bem?" generico se vazio).
function greetingName(lead: Lead): string {
  const first = lead.name?.trim().split(/\s+/)[0];
  return first || "";
}

// Monta o HTML completo do email de confirmacao (marca Cranium, inline styles).
export function buildMeetingConfirmationHtml(
  lead: Lead,
  data: MeetingConfirmationData,
  landingUrl: string
): string {
  const nome = greetingName(lead);
  const saudacao = nome ? `Olá, ${esc(nome)}!` : "Olá!";
  const when = formatMeetingWhen(data.startISO);
  const duracao = data.durationMin && data.durationMin > 0 ? data.durationMin : 30;
  const meet = data.meetLink ? esc(data.meetLink) : "";
  const landing = esc(landingUrl);

  // Botao do Meet (so aparece se houver link). Botao grande, alto contraste.
  const meetButton = meet
    ? `
        <tr>
          <td align="center" style="padding:8px 0 4px">
            <a href="${meet}"
               style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;
                      font-weight:600;font-size:16px;line-height:1;padding:16px 28px;border-radius:12px;
                      font-family:${FONT}">
              🎥 Entrar na reunião (Google Meet)
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 0 8px">
            <span style="font-size:12px;color:${MUTED};font-family:${FONT}">
              O link também estará no convite do seu Google Agenda.
            </span>
          </td>
        </tr>`
    : `
        <tr>
          <td align="center" style="padding:8px 0 12px">
            <span style="font-size:14px;color:${MUTED};font-family:${FONT}">
              O link da sala chega no convite do seu Google Agenda. 🎥
            </span>
          </td>
        </tr>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>Sua reunião com a Cranium Digital</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT};color:${TEXT}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(124,58,237,0.10)">
          <!-- Cabeçalho da marca -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND},${BRAND_DARK});padding:28px 32px">
              <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#E9D5FF;font-weight:600">
                Cranium Digital
              </div>
              <div style="font-size:22px;color:#ffffff;font-weight:700;margin-top:6px;line-height:1.3">
                Sua reunião está confirmada 🎥
              </div>
            </td>
          </tr>

          <!-- Corpo -->
          <tr>
            <td style="padding:28px 32px 8px">
              <p style="margin:0 0 14px;font-size:16px;line-height:1.5">
                ${saudacao}
              </p>
              <p style="margin:0 0 18px;font-size:16px;line-height:1.5;color:${TEXT}">
                Tudo certo! Sua reunião com a <strong>Cranium Digital</strong> foi agendada.
                Aqui estão os detalhes:
              </p>

              <!-- Card de data/hora -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background:${BG};border-radius:12px;margin:0 0 20px">
                <tr>
                  <td style="padding:18px 20px">
                    <div style="font-size:13px;color:${MUTED};text-transform:uppercase;letter-spacing:.5px;font-weight:600">
                      Quando
                    </div>
                    <div style="font-size:20px;color:${BRAND_DARK};font-weight:700;margin-top:4px;text-transform:capitalize">
                      ${esc(when)}
                    </div>
                    <div style="font-size:13px;color:${MUTED};margin-top:4px">
                      Duração de ${duracao} minutos · online pelo Google Meet
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Botão do Meet -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${meetButton}
              </table>
            </td>
          </tr>

          <!-- O que esperar -->
          <tr>
            <td style="padding:8px 32px 0">
              <div style="font-size:15px;font-weight:700;color:${TEXT};margin-bottom:8px">
                O que esperar da nossa conversa
              </div>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${TEXT}">
                Vamos entender como você capta clientes hoje e te mostrar, na prática, como gerar
                um fluxo previsível de leads qualificados todo mês. Sem enrolação — você sai da call
                com clareza dos próximos passos para vender mais.
              </p>
            </td>
          </tr>

          <!-- Sobre a Cranium -->
          <tr>
            <td style="padding:0 32px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="border:1px solid #EDE9FE;border-radius:12px">
                <tr>
                  <td style="padding:18px 20px">
                    <div style="font-size:15px;font-weight:700;color:${BRAND_DARK};margin-bottom:6px">
                      Quem é a Cranium Digital
                    </div>
                    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${TEXT}">
                      Somos uma agência de marketing, tecnologia e IA <strong>especializada em corretores
                      de seguros e planos de saúde</strong>. Geramos um fluxo previsível de leads
                      qualificados com tráfego pago segmentado e estruturação do seu processo comercial.
                      <strong>Não vendemos leads nem listas</strong> — construímos a máquina que traz
                      clientes para você todo mês.
                    </p>
                    <a href="${landing}"
                       style="display:inline-block;color:${BRAND};text-decoration:none;font-weight:600;font-size:14px">
                      Conheça nosso trabalho com corretores →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Assinatura -->
          <tr>
            <td style="padding:24px 32px 28px">
              <p style="margin:0;font-size:15px;line-height:1.5;color:${TEXT}">
                Até lá!<br />
                <strong>Bruno Castro</strong><br />
                <span style="color:${MUTED};font-size:13px">Cranium Digital</span>
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="padding:16px 32px;background:${BG}">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};text-align:center">
                Este é um email de confirmação do seu agendamento com a Cranium Digital.<br />
                <a href="${landing}" style="color:${MUTED}">craniumdigital.com.br</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface MeetingEmailResult {
  sent: boolean;
  reason?: string; // motivo quando nao enviado (sem email, erro do provider, etc.)
}

// Envia o email de confirmacao da reuniao ao lead. NUNCA lanca — devolve um
// resultado para o chamador logar; o agendamento nao depende deste envio.
export async function sendMeetingConfirmation(
  lead: Lead,
  data: MeetingConfirmationData
): Promise<MeetingEmailResult> {
  const email = lead.email?.trim();
  if (!email) {
    console.log(`[meeting-email] lead ${lead.id} sem email — confirmacao nao enviada.`);
    return { sent: false, reason: "lead sem email" };
  }

  try {
    const landingUrl = await getCorretorLandingUrl();
    const html = buildMeetingConfirmationHtml(lead, data, landingUrl);
    const subject = "Sua reunião com a Cranium Digital está confirmada 🎥";
    const provider = await getEmailProvider();
    const { id } = await provider.send({ to: email, subject, html });
    console.log(
      `[meeting-email] confirmacao enviada para ${email} (lead ${lead.id}) via ${provider.name} id=${id}`
    );
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[meeting-email] falha ao enviar confirmacao para ${email}:`, msg);
    return { sent: false, reason: msg };
  }
}
