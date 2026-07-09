import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getMetaConfig, getMakeSecret } from '@/src/crm/integrations';
import {
  verifySignature,
  parseLeadgenPayload,
  parseMakeLead,
  parseFieldData,
  fetchSingleLead,
  upsertMetaLead,
  upsertMakeLead,
  MetaError,
} from '@/src/crm/meta';
import { iniciarAtendimento } from '@/src/handler';
import { throttle, clientIp } from '@/src/lib/rate-limit';

// Cap de payload para o leadgen (bytes). Payloads do Make/Meta nao chegam perto disso.
const LEADGEN_PAYLOAD_CAP = 64 * 1024; // 64 KB
// Requests por minuto por IP. O Make manda um POST por lead gerado — 30/min e generoso.
const LEADGEN_RATE_LIMIT = 30;

// Ingresso de leads do Facebook/Instagram Lead Ads. Endpoint de MAQUINA — protegido
// por secret/assinatura, nunca por sessao (e o middleware ja exclui /api/*).
//
// CAMINHO PRINCIPAL — Make:
//   No Make, crie um cenario: "Facebook Lead Ads (Watch Leads)" -> modulo HTTP "Make a request"
//   POST https://SEU_PORTAL/api/leadgen
//   Header: x-make-secret: <secret gerado na aba Integracoes>   (ou ?token=<secret>)
//   Body (JSON): os campos do lead. Aceitamos dois formatos:
//     a) o lead cru do Meta com "field_data": [{ "name": "...", "values": ["..."] }]
//     b) objeto plano: { "name": "...", "phone": "...", "<pergunta>": "<resposta>", ...,
//                        "leadgen_id": "...", "form_id": "...", "ad_id": "...", "campaign_id": "..." }
//   Criamos o lead (idempotente por leadgen_id, senao por telefone) com source='meta_lead_ads'
//   e form_data = todas as respostas, e disparamos o opener outbound (agente -> sendText).
//
// CAMINHO LEGADO — webhook direto do Meta (app de dev): mantido. Identificado pelo header
//   "x-hub-signature-256"; validamos a assinatura HMAC com o App Secret e buscamos o lead
//   na Graph API. O GET abaixo mantem o handshake de verificacao do Meta.

// GET — handshake de verificacao do webhook direto do Meta.
// O Meta chama com ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const cfg = await getMetaConfig();
  if (mode === 'subscribe' && token && cfg.verifyToken && token === cfg.verifyToken) {
    // Texto puro — o Meta espera o challenge exato no corpo.
    return new NextResponse(challenge ?? '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return new NextResponse('forbidden', { status: 403 });
}

// Comparacao em tempo constante (evita timing attacks no secret do Make).
function secretMatches(provided: string, expected: string): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  // --- Cap de payload -------------------------------------------------------
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > LEADGEN_PAYLOAD_CAP) {
    return NextResponse.json({ error: 'payload muito grande' }, { status: 413 });
  }

  // --- Rate limit por IP ----------------------------------------------------
  const ip = clientIp(req);
  const rl = await throttle({ key: `leadgen:${ip}`, limit: LEADGEN_RATE_LIMIT, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate limit excedido' }, { status: 429 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  // Caminho legado: assinatura presente -> webhook direto do Meta.
  if (signature) {
    return handleMetaWebhook(rawBody, signature);
  }

  // Caminho principal: POST do Make. Valida o secret (header ou ?token=).
  const url = new URL(req.url);
  const provided = req.headers.get('x-make-secret') ?? url.searchParams.get('token') ?? '';
  const secret = await getMakeSecret();
  if (!secretMatches(provided, secret)) {
    return NextResponse.json({ error: 'secret invalido' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'payload invalido (JSON esperado)' }, { status: 400 });
  }

  const parsed = parseMakeLead(body);
  if (!parsed.phone && !parsed.leadgenId) {
    return NextResponse.json(
      { error: 'payload sem telefone nem leadgen_id — nada para criar' },
      { status: 400 }
    );
  }

  try {
    const { lead, created } = await upsertMakeLead(parsed);
    // So abre atendimento em lead recem-criado — Make pode reenviar o mesmo lead.
    if (created) {
      // Nao bloqueia a resposta ao Make: dispara o opener em background.
      void iniciarAtendimento(lead, parsed.formData).catch((e) =>
        console.error(`[api/leadgen] iniciarAtendimento falhou para ${lead.id}:`, e)
      );
    }
    return NextResponse.json({ ok: true, lead_id: lead.id, created });
  } catch (e) {
    console.error('[api/leadgen] POST (Make):', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'erro interno' },
      { status: 500 }
    );
  }
}

// Webhook direto do Meta — valida assinatura, busca cada lead na Graph API e faz upsert.
async function handleMetaWebhook(rawBody: string, signature: string | null) {
  const cfg = await getMetaConfig();
  if (!verifySignature(rawBody, signature, cfg.appSecret)) {
    return NextResponse.json({ error: 'assinatura invalida' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'payload invalido' }, { status: 400 });
  }

  const changes = parseLeadgenPayload(body);
  if (changes.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  let errors = 0;
  for (const change of changes) {
    try {
      const raw = await fetchSingleLead(cfg, change.leadgenId);
      raw.form_id = raw.form_id ?? change.formId;
      raw.ad_id = raw.ad_id ?? change.adId;
      const { lead, created } = await upsertMetaLead(raw);
      if (created) {
        void iniciarAtendimento(lead, parseFieldData(raw.field_data).formData).catch((e) =>
          console.error(`[api/leadgen] iniciarAtendimento (Meta) falhou para ${lead.id}:`, e)
        );
      }
      processed++;
    } catch (e) {
      errors++;
      const msg = e instanceof MetaError ? e.message : (e as Error).message;
      console.error(`[api/leadgen] falha no leadgen ${change.leadgenId}:`, msg);
    }
  }

  // 200 sempre que a assinatura foi valida — evita reentregas em massa do Meta.
  return NextResponse.json({ ok: true, processed, errors });
}
