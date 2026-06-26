import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseWebhook } from "../src/whatsapp/evolution";
import { getEvolutionConfig } from "../src/crm/integrations";
import { handleInbound } from "../src/handler";
import { guardMethod } from "./_lib/validate";
import { ok, serverError } from "./_lib/response";

// POST /api/webhook — ingresso de mensagens do WhatsApp via Evolution API (ADR-004).
// A Evolution chama esta URL no evento `messages.upsert`. O payload e normalizado
// por parseWebhook (src/whatsapp/evolution.ts) -> InboundMessage[] -> handleInbound.
//
// Make NAO e mais o canal de WhatsApp (ADR-004). O ingresso do Facebook Lead Ads
// continua em /api/leadgen — NAO confundir.
//
// Processamento sincrono (ADR-002): aguarda handleInbound antes de responder 200.
// Fire-and-forget nao funciona em serverless — a funcao congela ao retornar.
// maxDuration: 60s em vercel.json (cobre a latencia do agente Claude).
//
// Idempotencia: handleInbound chama addMessage com external_id (key.id da Evolution);
// reentregas recebem 200 idempotente, sem duplicar resposta.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardMethod(req, res, "POST")) return;

  // --- Validacao de origem -------------------------------------------------
  // A Evolution nao manda a apikey nos webhooks por padrao; protegemos com um
  // token que o usuario cola na URL do webhook (?token=...) ou envia no header
  // "apikey". Resolve env PRIMEIRO, integrations_config como override.
  const cfg = await getEvolutionConfig();
  const isProd = process.env.NODE_ENV === "production";

  if (cfg.webhookToken) {
    const provided =
      (typeof req.query?.token === "string" ? req.query.token : undefined) ??
      (typeof req.headers["apikey"] === "string" ? (req.headers["apikey"] as string) : undefined);
    if (provided !== cfg.webhookToken) {
      return res.status(401).json({ error: "token invalido" });
    }
  } else if (isProd) {
    // Producao sem token configurado: recusa. Este ingress grava no banco e
    // aciona a Claude (custo) — nao pode ir a ar aberto. Defina EVOLUTION_WEBHOOK_TOKEN.
    console.error("[webhook] ERRO: EVOLUTION_WEBHOOK_TOKEN nao configurado em producao — request recusado");
    return res.status(401).json({ error: "webhook nao autenticado: configure EVOLUTION_WEBHOOK_TOKEN" });
  }
  // Dev sem token: fail-open intencional — facilita testes locais.

  // parseWebhook ignora grupos/status/mensagens sem texto -> pode retornar [].
  const messages = parseWebhook(req.body);

  try {
    // Um payload messages.upsert pode trazer varias mensagens — processa todas.
    for (const msg of messages) {
      await handleInbound(msg);
    }
    // 200 sempre que a origem foi validada (mesmo com 0 mensagens uteis) —
    // evita reentregas em massa da Evolution.
    return ok(res);
  } catch (e) {
    return serverError(res, e);
  }
}
