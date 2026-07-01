import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

// =====================================================================
// Gerador de pílulas de conhecimento por IA + template de e-mail Cranium.
//
// A IA gera SÓ o conteúdo (título, parágrafos, CTA). O HTML bonito é montado
// aqui, no design system da Cranium (roxo, cabeçalho com gradiente, card,
// rodapé) — o mesmo padrão do e-mail de confirmação de reunião.
// =====================================================================

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// ---- Identidade Cranium (email-safe) ----
const BRAND = "#7C3AED";
const BRAND_DARK = "#5B21B6";
const DEEP = "#2D0F52";
const TINT = "#EDE9FE";
const TEXT = "#1F2937";
const MUTED = "#6B7280";
const BG = "#F4F1FB";
const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Temas padrão de pílulas para corretores de plano de saúde.
export const TEMAS_PADRAO = [
  "Tráfego pago para corretor de plano de saúde",
  "Atendimento com IA no WhatsApp",
  "Como escalar vendendo plano de saúde",
  "Follow-up: por que o lead some e como retomar",
  "Montar um funil de vendas previsível",
  "Parar de depender de indicação",
  "Lista fria x lead que levanta a mão",
] as const;

export function escolherTema(index?: number): string {
  if (typeof index === "number" && index >= 0 && index < TEMAS_PADRAO.length) {
    return TEMAS_PADRAO[index];
  }
  return TEMAS_PADRAO[Math.floor(Math.random() * TEMAS_PADRAO.length)];
}

// Conteúdo estruturado que a IA devolve (só a copy, sem HTML).
interface PilulaContent {
  subject: string;
  preheader: string;
  title: string;
  paragraphs: string[];
  cta: string;
}

// Escapa texto para uso seguro dentro do HTML.
function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Monta o e-mail HTML no design system Cranium (table-based, estilos inline).
export function montarEmailPilula(c: {
  title: string;
  paragraphs: string[];
  cta: string;
  preheader?: string;
}): string {
  const paras = c.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${TEXT};font-family:${FONT}">${esc(
          p
        )}</p>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT};color:${TEXT}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(
    c.preheader ?? c.title
  )}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:28px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px -12px rgba(124,58,237,.28)">

          <!-- Cabeçalho -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND},${DEEP});padding:26px 32px">
              <div style="font-size:15px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffffff;font-family:${FONT}">
                CRANIUM <span style="font-weight:400;font-size:12px;letter-spacing:1px;color:#C4B5FD;text-transform:lowercase">digital</span>
              </div>
              <div style="margin-top:14px;display:inline-block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:5px 13px;font-size:11px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:#EDE9FE;font-family:${FONT}">
                Pílula de conhecimento
              </div>
            </td>
          </tr>

          <!-- Título -->
          <tr>
            <td style="padding:28px 32px 4px">
              <div style="font-size:22px;line-height:1.28;font-weight:700;color:${BRAND_DARK};font-family:${FONT}">${esc(
                c.title
              )}</div>
            </td>
          </tr>

          <!-- Corpo -->
          <tr>
            <td style="padding:16px 32px 4px">${paras}</td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:8px 32px 28px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background:${TINT};border:1px solid rgba(124,58,237,.18);border-radius:12px">
                <tr>
                  <td style="padding:16px 18px">
                    <div style="font-size:15px;font-weight:700;color:${BRAND_DARK};font-family:${FONT}">${esc(
                      c.cta
                    )}</div>
                    <div style="font-size:12.5px;color:${MUTED};margin-top:4px;font-family:${FONT}">É só responder este e-mail.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="padding:18px 32px;background:${BG};border-top:1px solid #E5E1F3">
              <div style="font-size:12px;color:${MUTED};font-family:${FONT}">
                <strong style="color:${DEEP}">Cranium Digital</strong> · Inteligência de quem vive o mercado.
              </div>
              <div style="font-size:11px;color:${MUTED};margin-top:6px;font-family:${FONT}">
                Você recebe este e-mail por fazer parte da nossa lista. Para não receber mais, responda com "sair".
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Gera uma pílula: chama o Claude para a COPY e embrulha no template Cranium.
// Retorna { subject, html } pronto para createCampaign.
export async function gerarPilula(theme: string): Promise<{ subject: string; html: string }> {
  const prompt = `Você é copywriter da Cranium Digital, agência de marketing especializada em corretores de plano de saúde.

Escreva o CONTEÚDO de um e-mail curto de "pílula de conhecimento" para CORRETORES sobre: "${theme}".

VOZ (obrigatório):
- Fale "você" com o corretor, tom direto de colega experiente. Frases curtas.
- SEM travessão (use vírgula, ponto ou dois-pontos). SEM jargão de agência. Sem emoji.
- Não use "{nome}" nem saudação com nome (o e-mail vai para uma lista).

Devolva SÓ um JSON puro (sem markdown, sem texto fora do JSON), exatamente neste formato:
{
  "subject": "assunto chamativo, máx 55 caracteres",
  "preheader": "1 frase de prévia da caixa de entrada, máx 90 caracteres",
  "title": "título/manchete do e-mail, curto e forte",
  "paragraphs": ["parágrafo 1 (gancho)", "parágrafo 2 (dica prática)", "parágrafo 3 (fechamento)"],
  "cta": "chamada leve no fim, 1 linha, ex: Quer ver como fazer isso no seu WhatsApp?"
}
Regras: paragraphs deve ter de 2 a 4 itens, cada um curto (1 a 3 frases). Texto puro, sem HTML.`;

  const response = await client.messages.create({
    model: config.agentModel,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `[email-content] gerarPilula: Claude nao devolveu JSON valido. Inicio: ${rawText.slice(0, 200)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`[email-content] gerarPilula: falha ao parsear JSON: ${(e as Error).message}`);
  }

  const p = parsed as Partial<PilulaContent>;
  if (
    typeof p.subject !== "string" ||
    typeof p.title !== "string" ||
    !Array.isArray(p.paragraphs) ||
    p.paragraphs.length === 0
  ) {
    throw new Error(`[email-content] gerarPilula: resposta do Claude fora do formato esperado`);
  }

  const paragraphs = p.paragraphs.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  const cta = typeof p.cta === "string" && p.cta.trim() ? p.cta.trim() : "Quer ver como aplicar isso no seu dia a dia?";
  const preheader = typeof p.preheader === "string" ? p.preheader.trim() : p.title.trim();

  const html = montarEmailPilula({
    title: p.title.trim(),
    paragraphs,
    cta,
    preheader,
  });

  return { subject: p.subject.trim(), html };
}
