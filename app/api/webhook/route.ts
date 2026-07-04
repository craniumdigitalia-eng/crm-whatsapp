import { NextResponse } from 'next/server';
import { parseWebhook, parseGroupWebhook } from '@/src/whatsapp/evolution';
import { getEvolutionConfig } from '@/src/crm/integrations';
import { handleInbound } from '@/src/handler';
import { handleGroupMessage } from '@/src/crm/demands';
import { storeGroupMessage, ensureGroupCached } from '@/src/crm/groupchat';

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
export const maxDuration = 60;

export async function POST(req: Request) {
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
