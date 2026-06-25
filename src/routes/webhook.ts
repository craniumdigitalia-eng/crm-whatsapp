import { Router } from "express";
import { parseWebhook } from "../whatsapp/evolution";
import { handleInbound } from "../handler";

export const webhookRouter = Router();

// Endpoint que a Evolution API chama quando chega mensagem.
// Configure na Evolution o webhook apontando para: http://SEU_HOST:PORT/webhook/evolution
webhookRouter.post("/evolution", (req, res) => {
  // Responde imediatamente para nao segurar a Evolution; processa em background.
  res.sendStatus(200);

  try {
    const messages = parseWebhook(req.body);
    for (const msg of messages) {
      handleInbound(msg).catch((e) => console.error("[webhook] erro ao processar:", e));
    }
  } catch (e) {
    console.error("[webhook] erro ao parsear payload:", e);
  }
});
