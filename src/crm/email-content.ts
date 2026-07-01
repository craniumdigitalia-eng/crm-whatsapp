import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

// =====================================================================
// Gerador de pílulas de conhecimento por IA.
// Chama o Claude com o mesmo cliente/modelo do agente (src/agent/agent.ts).
// Devolve { subject, html } — e-mail-safe, pronto para createCampaign.
// =====================================================================

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// Temas padrão de pílulas para corretores de plano de saúde.
// Usados quando nenhum tema é informado pela rota.
export const TEMAS_PADRAO = [
  "Tráfego pago para corretor de plano de saúde",
  "Atendimento com IA no WhatsApp",
  "Como escalar vendendo plano de saúde",
  "Follow-up: por que o lead some e como retomar",
  "Montar um funil de vendas previsível",
  "Parar de depender de indicação",
  "Lista fria x lead que levanta a mão",
] as const;

// Escolhe um tema da lista padrão (aleatório ou por índice).
export function escolherTema(index?: number): string {
  if (typeof index === "number" && index >= 0 && index < TEMAS_PADRAO.length) {
    return TEMAS_PADRAO[index];
  }
  return TEMAS_PADRAO[Math.floor(Math.random() * TEMAS_PADRAO.length)];
}

// Gera uma pílula de conhecimento via Claude. Retorna { subject, html } onde:
//   subject = assunto chamativo (max ~60 chars)
//   html    = corpo do e-mail, e-mail-safe (estilos inline, sem <script>),
//             com acento roxo (#7C3AED) no título e no CTA.
export async function gerarPilula(theme: string): Promise<{ subject: string; html: string }> {
  const prompt = `Você é copywriter da Cranium Digital, agência especializada em marketing para corretores de plano de saúde.

Escreva um e-mail de "pílula de conhecimento" para CORRETORES sobre o tema: "${theme}".

REGRAS DE VOZ (obrigatórias):
- Escreva em 1ª pessoa, fale "você" com o corretor, tom direto como colega experiente
- Frases curtas, linguagem natural do Brasil
- SEM travessão — (use vírgula, ponto ou dois-pontos no lugar)
- SEM jargão de agência (nada de "stakeholder", "KPI", "ROI", "traction")
- SEM emojis excessivos (no máximo 1, se fizer sentido)

ESTRUTURA DO E-MAIL:
1. Assunto: chamativo e direto (máximo 60 caracteres)
2. Gancho: 1 a 2 frases que fazem o corretor parar e ler
3. Corpo: 2 a 4 parágrafos curtos com 1 dica prática e acionável sobre o tema
4. CTA leve no fim: simples e sem pressão (ex.: "responde aqui que eu te mostro", "quer ver como funciona?")

REGRAS DO HTML:
- E-mail-safe: apenas estilos INLINE, sem <script>, sem <style> em bloco separado
- Estrutura simples: div container centralizado (max-width: 600px), fonte sans-serif
- Título/cabeçalho em roxo (#7C3AED), negrito
- CTA em roxo (#7C3AED), preferencialmente como link ou texto destacado
- Parágrafo de texto em #222, espaçamento legível
- Responsivo (max-width 600px)

FORMATO DA RESPOSTA: JSON puro, sem markdown, sem explicação antes ou depois. Exatamente:
{"subject":"...","html":"..."}`;

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

  // Extrai o objeto JSON da resposta (tolera markdown ```json ... ```).
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `[email-content] gerarPilula: Claude nao devolveu JSON valido. Inicio da resposta: ${rawText.slice(0, 200)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(
      `[email-content] gerarPilula: falha ao parsear JSON do Claude: ${(e as Error).message}`
    );
  }

  const p = parsed as Record<string, unknown>;
  if (typeof p.subject !== "string" || typeof p.html !== "string") {
    throw new Error(
      `[email-content] gerarPilula: resposta do Claude nao contem { subject, html } como strings`
    );
  }

  return {
    subject: p.subject.trim(),
    html: p.html.trim(),
  };
}
