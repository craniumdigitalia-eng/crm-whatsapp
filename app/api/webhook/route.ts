import { NextResponse } from 'next/server';
import { parseWebhook, parseGroupWebhook } from '@/src/whatsapp/evolution';
import { getEvolutionConfig } from '@/src/crm/integrations';
import { handleInbound } from '@/src/handler';
import { handleGroupMessage } from '@/src/crm/demands';
import { storeGroupMessage, ensureGroupCached } from '@/src/crm/groupchat';
import { throttle, clientIp } from '@/src/lib/rate-limit';

// POST /api/webhook — ingresso de mensagens do WhatsApp via Evolution API (ADR-004).
// A Evolution chama esta URL no evento `messages.upsert`. O payload e normalizado
// por parseWebhook (src/whatsapp/evolution.ts) -> InboundMessage[] -> handleInbound.
//
// Make NAO e mais o canal de WhatsApp (ADR-004). O ingresso do Facebook Lead Ads
// continua em /api/leadgen — NAO confundir.
//
// Endpoint de MAQUINA — protegido pelo token da Evolution (?token= ou header "apikey"),
// nunca por sessao (o middleware ja exclui /api/*). NAO usa requireUser.
//
// Processamento sincrono (ADR-002): aguarda handleInbound antes de responder 200.
// Fire-and-forget nao funciona em serverless — a funcao congela ao retornar.
// maxDuration: 60s (cobre a latencia do agente Claude).
//
// Idempotencia: handleInbound chama addMessage com external_id (key.id da Evolution);
// reentregas recebem 200 idempotente, sem duplicar resposta.
//
// Hardening (P0-3):
//   - Cap de payload: 64 KB (mensagem WhatsApp nunca chega nem perto disso).
//   - Rate limit: 60 requests/minuto por IP (janela fixa via Supabase).
//     60 rpm = 1 msg/s, suficiente para uso real. Ataques de loop ou DDoS sao bloqueados.
export const maxDuration = 60;

// Cap de payload para o webhook (bytes). Mensagens WhatsApp sao muito menores que isso.
const WEBHOOK_PAYLOAD_CAP = 64 * 1024; // 64 KB
// Requests por minuto por IP permitidas neste endpoint.
const WEBHOOK_RATE_LIMIT = 60;

export async function POST(req: Request) {
  // --- Cap de payload -------------------------------------------------------
  // Verifica antes de chamar req.json() para evitar alocar memoria com payload gigante.
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > WEBHOOK_PAYLOAD_CAP) {
    return NextResponse.json({ error: 'payload muito grande' }, { status: 413 });
  }

  // --- Rate limit por IP ----------------------------------------------------
  // Prioridade maxima: cada POST aciona o agente Claude (custo). 60 rpm por IP
  // cobre qualquer uso legítimo da Evolution; bloqueia loops maliciosos.
  const ip = clientIp(req);
  const rl = await throttle({ key: `webhook:${ip}`, limit: WEBHOOK_RATE_LIMIT, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate limit excedido' }, { status: 429 });
  }

  // --- Validacao de origem -------------------------------------------------
  // A Evolution nao manda a apikey nos webhooks por padrao; protegemos com um
  // token que o usuario cola na URL do webhook (?token=...) ou envia no header
  // "apikey". Resolve env PRIMEIRO, integrations_config como override.
  const cfg = await getEvolutionConfig();
  const isProd = process.env.NODE_ENV === 'production';
  const url = new URL(req.url);

  if (cfg.webhookToken) {
    const provided =
      url.searchParams.get('token') ?? req.headers.get('apikey') ?? undefined;
    if (provided !== cfg.webhookToken) {
      return NextResponse.json({ error: 'token invalido' }, { status: 401 });
    }
  } else if (isProd) {
    // Producao sem token configurado: recusa. Este ingress grava no banco e
    // aciona a Claude (custo) — nao pode ir a ar aberto. Defina EVOLUTION_WEBHOOK_TOKEN.
    console.error(
      '[webhook] ERRO: EVOLUTION_WEBHOOK_TOKEN nao configurado em producao — request recusado'
    );
    return NextResponse.json(
      { error: 'webhook nao autenticado: configure EVOLUTION_WEBHOOK_TOKEN' },
      { status: 401 }
    );
  }
  // Dev sem token: fail-open intencional — facilita testes locais.

  // parseWebhook ignora grupos/status/mensagens sem texto -> pode retornar [].
  const body = await req.json().catch(() => ({}));
  const messages = parseWebhook(body);
  const groupMessages = parseGroupWebhook(body);

  try {
    // Um payload messages.upsert pode trazer varias mensagens — processa todas.
    for (const msg of messages) {
      await handleInbound(msg);
    }
    // Mensagens de GRUPO: grava no historico (inbox da aba Grupos) e roteia para
    // o quadro de Demandas (gatilho "demanda"). Nao passam pelo agente de leads.
    for (const gm of groupMessages) {
      await ensureGroupCached(gm.groupJid);
      await storeGroupMessage({
        externalId: gm.externalId,
        groupJid: gm.groupJid,
        direction: gm.fromMe ? 'out' : 'in',
        senderPhone: gm.senderPhone,
        senderName: gm.senderName,
        body: gm.text,
      });
      await handleGroupMessage(gm);
    }
    // 200 sempre que a origem foi validada (mesmo com 0 mensagens uteis) —
    // evita reentregas em massa da Evolution.
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/webhook]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}
