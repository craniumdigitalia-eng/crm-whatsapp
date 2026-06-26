import { NextResponse } from 'next/server';
import { getMetaConfig } from '@/src/crm/integrations';
import {
  verifySignature,
  parseLeadgenPayload,
  fetchSingleLead,
  upsertMetaLead,
  MetaError,
} from '@/src/crm/meta';

// Webhook leadgen do Meta (tempo real). Story 5.14.
// Configure no painel do app Meta:
//   Callback URL:  https://SEU_DOMINIO/api/leadgen
//   Verify Token:  o mesmo valor de META_VERIFY_TOKEN (ou salvo na aba Integracoes)
//   Campo:         leadgen (na Pagina)

// GET — handshake de verificacao do webhook.
// O Meta chama com ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
// Respondemos o challenge em texto puro se o verify_token bater.
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

// POST — notificacao de novo lead. Valida assinatura, busca o lead na Graph
// API e cria/atualiza no CRM (idempotente por leadgen_id).
export async function POST(req: Request) {
  // Corpo cru e obrigatorio para validar a assinatura HMAC.
  const rawBody = await req.text();
  const cfg = await getMetaConfig();

  const signature = req.headers.get('x-hub-signature-256');
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

  // Responde 200 rapido mesmo sem mudancas (o Meta reenvia em caso de erro).
  if (changes.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  let errors = 0;
  for (const change of changes) {
    try {
      const raw = await fetchSingleLead(cfg, change.leadgenId);
      // Garante os ids de atribuicao mesmo se a Graph API nao os trouxer.
      raw.form_id = raw.form_id ?? change.formId;
      raw.ad_id = raw.ad_id ?? change.adId;
      await upsertMetaLead(raw);
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
