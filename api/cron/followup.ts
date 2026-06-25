import type { VercelRequest, VercelResponse } from "@vercel/node";
import { config } from "../../src/config";
import { runFollowUpCheck } from "../../src/followup/scheduler";

// GET /api/cron/followup — motor de follow-up disparado pelo Vercel Cron (vercel.json).
// Tambem aceita POST para disparo manual (testes/depuracao).
//
// Auth: header Authorization: Bearer {CRON_SECRET}.
// A Vercel injeta o header automaticamente nas chamadas de Cron; validar garante que
// apenas a plataforma (ou chamadores autorizados) podem acionar o ciclo.
//
// Batch: processa ate config.followupBatch leads por invocacao (padrao 50).
// Evita estourar o timeout da funcao serverless em bases grandes.
// Para volumes maiores, reduzir FOLLOWUP_BATCH ou aumentar a frequencia do cron.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "metodo nao permitido" });
  }

  // Rejeita se CRON_SECRET nao estiver configurado ou o token nao bater.
  const expected = config.cronSecret;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
    return res.status(401).json({ error: "nao autorizado" });
  }

  try {
    const { sent, skipped, errors } = await runFollowUpCheck(config.followupBatch);
    console.log(`[cron/followup] ciclo concluido — enviados: ${sent}, pulados: ${skipped}, erros: ${errors}`);
    return res.status(200).json({ ok: true, sent, skipped, errors });
  } catch (e) {
    console.error("[cron/followup] erro no ciclo:", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "erro interno" });
  }
}
