import type { VercelRequest, VercelResponse } from "@vercel/node";
import { config } from "../src/config";
import { parseMakeWebhook } from "../src/whatsapp/evolution";
import { handleInbound } from "../src/handler";
import { guardMethod } from "./_lib/validate";
import { ok, badRequest, serverError } from "./_lib/response";

// POST /api/webhook — recebe mensagens do Make (canal WhatsApp).
// Contrato: { phone, name?, text, id? } — normalizado por parseMakeWebhook (Story 3.1).
//
// Processamento sincrono (ADR-002): aguarda handleInbound antes de responder 200.
// Fire-and-forget nao funciona em serverless — a funcao congela ao retornar.
// maxDuration: 60s configurado em vercel.json (cobre latencia do agente Claude).
//
// Idempotencia: handleInbound chama addMessage com external_id; se a constraint 23505
// (unique external_id) disparar, addMessage retorna false e o handler encerra sem
// reprocessar. Reentrega do Make recebe 200 idempotente, sem duplicata.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardMethod(req, res, "POST")) return;

  // Autenticacao do Make via header "x-make-secret".
  // Fail-closed em producao: sem MAKE_WEBHOOK_SECRET configurado, recusa imediatamente.
  // Este ingress grava no banco e aciona a Claude (custo) — nao pode ir a ar aberto.
  // Em dev (NODE_ENV != "production"), permite sem secret para facilitar testes locais.
  const isProd = process.env.NODE_ENV === "production";

  if (config.makeWebhookSecret) {
    // Secret configurado: valida o header em qualquer ambiente.
    const token = req.headers["x-make-secret"];
    if (token !== config.makeWebhookSecret) {
      return res.status(401).json({ error: "token invalido" });
    }
  } else if (isProd) {
    // Producao sem secret: recusa. Configure MAKE_WEBHOOK_SECRET no painel da Vercel.
    console.error("[webhook] ERRO: MAKE_WEBHOOK_SECRET nao configurado em producao — request recusado");
    return res.status(401).json({ error: "webhook nao autenticado: configure MAKE_WEBHOOK_SECRET" });
  }
  // Dev sem secret: fail-open intencional — permite para testes locais.

  // parseMakeWebhook descarta payloads sem phone ou text (retorna []).
  const messages = parseMakeWebhook(req.body);
  if (messages.length === 0) {
    return badRequest(res, "payload invalido: phone e text sao obrigatorios");
  }

  // Alerta de dedupe degradado: sem id nativo (wamid), o external_id e um hash
  // por segundo — um retry tardio do Make nao sera deduplicado.
  // Correcao: no cenario Make, mapeie message.id (wamid) como campo "id" no payload.
  if (!req.body?.id) {
    console.warn("[webhook] WARN: payload sem id nativo — dedupe degradado; mapeie message.id no cenario Make");
  }

  try {
    await handleInbound(messages[0]);
    return ok(res);
  } catch (e) {
    return serverError(res, e);
  }
}
